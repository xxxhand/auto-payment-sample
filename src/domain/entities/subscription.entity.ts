import { BaseEntity } from './base-entity.abstract';
import { SubscriptionStatus, PlanChangeType, CancellationReason } from '../enums/codes.const';
import { Money, BillingCycleVO, BillingPeriod, SubscriptionStateMachine, TransitionContext, TransitionResult } from '../value-objects';

/**
 * 狀態歷史項目
 */
interface StatusHistoryItem {
  fromStatus: SubscriptionStatus;
  toStatus: SubscriptionStatus;
  changedAt: Date;
  reason?: string;
  actor?: string;
}

/**
 * 重試狀態
 */
interface RetryState {
  retryCount: number;
  maxRetries: number;
  lastRetryDate?: Date;
  nextRetryDate?: Date;
  gracePeriodExtensions: number;
  maxGraceExtensions: number;
  // 向後兼容屬性
  failureCount?: number;
  lastSuccessDate?: Date;
  lastFailureDate?: Date;
}

/**
 * 方案變更資訊
 */
interface PendingPlanChange {
  targetPlanId: string;
  changeType: PlanChangeType;
  requestedAt: Date;
  effectiveAt: Date;
  reason?: string;
}

/**
 * 套用的優惠資訊
 */
interface AppliedPromotion {
  promotionId: string;
  appliedAt: Date;
  cycleNumber: number;
  discountAmount: Money;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
}

/**
 * 取消資訊
 */
interface CancellationInfo {
  cancelledAt: Date;
  reason: CancellationReason;
  cancelledBy: string;
  refundRequested: boolean;
  refundAmount?: Money;
}

/**
 * 增強版訂閱實體 - 完整領域模型
 * 實現文檔中複雜的訂閱聚合設計
 */
export class SubscriptionEntity extends BaseEntity {
  /** 業務識別碼 (unique) */
  public subscriptionId: string = '';

  /** 所屬客戶 ID */
  public customerId: string = '';

  /** 產品 ID */
  public productId: string = '';

  /** 方案 ID */
  public planId: string = '';

  /** 支付方式 ID */
  public paymentMethodId: string = '';

  /** 訂閱狀態 */
  public status: SubscriptionStatus = SubscriptionStatus.PENDING;

  /** 狀態變更歷史 */
  public statusHistory: StatusHistoryItem[] = [];

  /** 計費週期 */
  public billingCycle: BillingCycleVO;

  /** 當前計費期間 */
  public currentPeriod: BillingPeriod;

  /** 定價資訊 */
  public pricing: {
    baseAmount: Money;
    currency: string;
    taxAmount?: Money;
  };

  /** 重試資訊 */
  public retryState: RetryState;

  /** 方案變更 */
  public pendingPlanChange?: PendingPlanChange;

  /** 套用的優惠 */
  public appliedPromotions: AppliedPromotion[] = [];

  /** 取消資訊 */
  public cancellation?: CancellationInfo;

  /** 試用期結束日期 */
  public trialEndDate?: Date;

  /** 訂閱開始日期 */
  public startDate: Date = new Date();

  /** 訂閱結束日期（可選） */
  public endDate?: Date;

  /** 訂閱描述 */
  public description?: string;

  /** 訂閱元資料 */
  public metadata: Record<string, any> = {};

  constructor(customerId: string, productId: string, planId: string, paymentMethodId: string, baseAmount: Money, billingCycle: BillingCycleVO);
  constructor(customerId: string, paymentMethodId: string, planName: string, amount: number, billingCycle: string);
  constructor(
    customerId: string,
    productIdOrPaymentMethodId: string,
    planIdOrPlanName: string,
    paymentMethodIdOrAmount: string | number,
    baseAmountOrBillingCycle: Money | string,
    billingCycle?: BillingCycleVO,
  ) {
    super();
    this.customerId = customerId;

    if (billingCycle && baseAmountOrBillingCycle instanceof Money) {
      // 新的構造函數簽名
      this.productId = productIdOrPaymentMethodId;
      this.planId = planIdOrPlanName;
      this.paymentMethodId = paymentMethodIdOrAmount as string;
      this.billingCycle = billingCycle;

      // 初始化定價
      this.pricing = {
        baseAmount: baseAmountOrBillingCycle,
        currency: baseAmountOrBillingCycle.currency,
      };
    } else {
      // 向後兼容的構造函數簽名
      this.productId = `prod_${planIdOrPlanName.toLowerCase().replace(/\s+/g, '_')}`;
      this.planId = planIdOrPlanName;
      this.paymentMethodId = productIdOrPaymentMethodId;

      const amount = paymentMethodIdOrAmount as number;
      const cycle = baseAmountOrBillingCycle as string;

      this.billingCycle = BillingCycleVO.fromString(cycle);

      // 初始化定價
      this.pricing = {
        baseAmount: new Money(amount, 'TWD'),
        currency: 'TWD',
      };
    }

    // 初始化計費期間
    const now = new Date();
    const nextBillingDate = this.billingCycle.calculateNextBillingDate(now);
    this.currentPeriod = new BillingPeriod(now, nextBillingDate);

    // 初始化重試狀態
    this.retryState = {
      retryCount: 0,
      maxRetries: 3,
      gracePeriodExtensions: 0,
      maxGraceExtensions: 2,
    };

    // 生成業務ID
    this.subscriptionId = this.generateSubscriptionId();
  }

  /**
   * 狀態轉換 - 使用狀態機驗證
   */
  public transitionToStatus(newStatus: SubscriptionStatus, context: TransitionContext = {}): TransitionResult {
    const result = SubscriptionStateMachine.validateTransition(this.status, newStatus, context);

    if (result.isValid) {
      const oldStatus = this.status;
      this.status = newStatus;

      // 記錄狀態歷史
      this.statusHistory.push({
        fromStatus: oldStatus,
        toStatus: newStatus,
        changedAt: context.timestamp || new Date(),
        reason: context.reason,
        actor: context.actor,
      });

      this.touch();
    }

    return result;
  }

  /**
   * 啟用訂閱
   */
  public activate(context: TransitionContext = {}): TransitionResult {
    return this.transitionToStatus(SubscriptionStatus.ACTIVE, {
      ...context,
      reason: context.reason || 'Subscription activated',
    });
  }

  /**
   * 暫停訂閱
   */
  public pause(reason?: string, actor?: string): TransitionResult {
    return this.transitionToStatus(SubscriptionStatus.PAUSED, {
      reason: reason || 'Subscription paused by user',
      actor,
    });
  }

  /**
   * 恢復訂閱
   */
  public resume(actor?: string): TransitionResult {
    return this.transitionToStatus(SubscriptionStatus.ACTIVE, {
      reason: 'Subscription resumed',
      actor,
    });
  }

  /**
   * 取消訂閱
   */
  public cancel(reason: CancellationReason, actor?: string, refundRequested: boolean = false): TransitionResult {
    const result = this.transitionToStatus(SubscriptionStatus.CANCELED, {
      reason: `Cancelled: ${reason}`,
      actor,
    });

    if (result.isValid) {
      this.cancellation = {
        cancelledAt: new Date(),
        reason,
        cancelledBy: actor || 'unknown',
        refundRequested,
      };
      this.endDate = new Date();
    }

    return result;
  }

  /**
   * 進入寬限期
   */
  public enterGracePeriod(gracePeriodEndDate?: Date): TransitionResult {
    const result = this.transitionToStatus(SubscriptionStatus.GRACE_PERIOD, {
      reason: 'Payment failed - entered grace period',
      metadata: { paymentFailed: true },
    });

    if (result.isValid && gracePeriodEndDate) {
      this.retryState.gracePeriodExtensions += 1;
      this.metadata.gracePeriodEndDate = gracePeriodEndDate;
    }

    return result;
  }

  /**
   * 進入重試狀態
   */
  public enterRetryState(nextRetryDate?: Date): TransitionResult {
    const canRetry = this.retryState.retryCount < this.retryState.maxRetries;

    const result = this.transitionToStatus(SubscriptionStatus.RETRY, {
      reason: 'Payment failed - entering retry',
      metadata: {
        isRetriable: canRetry,
        maxRetries: this.retryState.maxRetries,
        currentRetries: this.retryState.retryCount,
      },
    });

    if (result.isValid) {
      this.retryState.retryCount += 1;
      this.retryState.lastRetryDate = new Date();
      this.retryState.nextRetryDate = nextRetryDate;
    }

    return result;
  }

  /**
   * 標記為過期
   */
  public markExpired(reason?: string): TransitionResult {
    const result = this.transitionToStatus(SubscriptionStatus.EXPIRED, {
      reason: reason || 'Subscription expired due to payment failures',
    });

    if (result.isValid) {
      this.endDate = new Date();
    }

    return result;
  }

  /**
   * 處理退款
   */
  public processRefund(refundAmount: Money, actor?: string): TransitionResult {
    const result = this.transitionToStatus(SubscriptionStatus.REFUNDED, {
      reason: 'Subscription refunded',
      actor,
      metadata: { refundApproved: true },
    });

    if (result.isValid && this.cancellation) {
      this.cancellation.refundAmount = refundAmount;
    }

    return result;
  }

  /**
   * 變更方案
   */
  public changePlan(targetPlanId: string, changeType: PlanChangeType, effectiveDate?: Date): void {
    this.pendingPlanChange = {
      targetPlanId,
      changeType,
      requestedAt: new Date(),
      effectiveAt: effectiveDate || new Date(),
      reason: `Plan change to ${targetPlanId}`,
    };
    this.touch();
  }

  /**
   * 執行方案變更
   */
  public executePlanChange(): boolean {
    if (!this.pendingPlanChange) return false;

    const now = new Date();
    if (now >= this.pendingPlanChange.effectiveAt) {
      this.planId = this.pendingPlanChange.targetPlanId;
      this.pendingPlanChange = undefined;
      this.touch();
      return true;
    }

    return false;
  }

  /**
   * 套用優惠
   */
  public applyPromotion(promotionId: string, discountAmount: Money, cycleNumber: number = 1): void {
    const appliedPromotion: AppliedPromotion = {
      promotionId,
      appliedAt: new Date(),
      cycleNumber,
      discountAmount,
      status: 'ACTIVE',
    };

    this.appliedPromotions.push(appliedPromotion);
    this.touch();
  }

  /**
   * 移除優惠
   */
  public removePromotion(promotionId: string): void {
    const promotion = this.appliedPromotions.find((p) => p.promotionId === promotionId);
    if (promotion) {
      promotion.status = 'CANCELLED';
      this.touch();
    }
  }

  /**
   * 更新計費週期
   */
  public updateBillingCycle(newCycle: BillingCycleVO): void {
    this.billingCycle = newCycle;

    // 重新計算當前計費期間
    const newPeriod = newCycle.calculateBillingPeriod(this.currentPeriod.startDate);
    this.currentPeriod = new BillingPeriod(newPeriod.startDate, newPeriod.endDate, this.currentPeriod.cycleNumber);

    this.touch();
  }

  /**
   * 推進到下一個計費週期
   */
  public advanceToNextBillingCycle(): void {
    const nextStartDate = this.billingCycle.calculateNextBillingDate(this.currentPeriod.endDate);
    const period = this.billingCycle.calculateBillingPeriod(nextStartDate);

    this.currentPeriod = new BillingPeriod(period.startDate, period.endDate, this.currentPeriod.cycleNumber + 1);
    this.touch();
  }

  /**
   * 計算當期總金額（含優惠）
   */
  public calculateCurrentPeriodAmount(): Money {
    let totalAmount = this.pricing.baseAmount;

    // 加上稅額
    if (this.pricing.taxAmount) {
      totalAmount = totalAmount.add(this.pricing.taxAmount);
    }

    // 應用活躍的優惠
    const activePromotions = this.appliedPromotions.filter((p) => p.status === 'ACTIVE');
    for (const promotion of activePromotions) {
      totalAmount = totalAmount.subtract(promotion.discountAmount);
    }

    return totalAmount;
  }

  /**
   * 檢查訂閱狀態
   */
  public isActive(): boolean {
    return SubscriptionStateMachine.isActiveState(this.status);
  }

  public isTerminated(): boolean {
    return SubscriptionStateMachine.isTerminalState(this.status);
  }

  public isInTrial(): boolean {
    return this.status === SubscriptionStatus.TRIALING || (this.trialEndDate && new Date() < this.trialEndDate);
  }

  public isInGracePeriod(): boolean {
    return this.status === SubscriptionStatus.GRACE_PERIOD;
  }

  public canRetry(): boolean {
    return this.retryState.retryCount < this.retryState.maxRetries;
  }

  public needsBilling(): boolean {
    if (!this.isActive()) return false;
    if (this.isInTrial()) return false;
    return this.currentPeriod.isExpired();
  }

  public isExpiringSoon(daysThreshold: number = 3): boolean {
    return this.currentPeriod.isExpiringSoon(daysThreshold);
  }

  /**
   * 重置重試狀態
   */
  public resetRetryState(): void {
    this.retryState.retryCount = 0;
    this.retryState.lastRetryDate = undefined;
    this.retryState.nextRetryDate = undefined;
    this.retryState.gracePeriodExtensions = 0;
    delete this.metadata.gracePeriodEndDate;
    this.touch();
  }

  /**
   * 更新支付方式
   */
  public updatePaymentMethod(paymentMethodId: string): void {
    this.paymentMethodId = paymentMethodId;
    this.touch();
  }

  /**
   * 設定試用期
   */
  public setTrialPeriod(trialEndDate: Date): TransitionResult {
    this.trialEndDate = trialEndDate;
    this.touch();

    return this.transitionToStatus(SubscriptionStatus.TRIALING, {
      reason: 'Trial period set',
    });
  }

  /**
   * 結束試用期
   */
  public endTrial(): TransitionResult {
    this.trialEndDate = new Date();
    this.touch();

    return this.transitionToStatus(SubscriptionStatus.ACTIVE, {
      reason: 'Trial period ended',
    });
  }

  /**
   * 更新元資料
   */
  public updateMetadata(metadata: Record<string, any>): void {
    this.metadata = { ...this.metadata, ...metadata };
    this.touch();
  }

  /**
   * 獲取狀態歷史
   */
  public getStatusHistory(): StatusHistoryItem[] {
    return [...this.statusHistory];
  }

  /**
   * 獲取最後狀態變更
   */
  public getLastStatusChange(): StatusHistoryItem | undefined {
    return this.statusHistory[this.statusHistory.length - 1];
  }

  /**
   * 序列化為JSON
   */
  public toJSON(): any {
    return {
      id: this.id,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      subscriptionId: this.subscriptionId,
      customerId: this.customerId,
      productId: this.productId,
      planId: this.planId,
      paymentMethodId: this.paymentMethodId,
      status: this.status,
      statusHistory: this.statusHistory,
      billingCycle: this.billingCycle.toJSON(),
      currentPeriod: this.currentPeriod.toJSON(),
      pricing: {
        baseAmount: this.pricing.baseAmount.toJSON(),
        currency: this.pricing.currency,
        taxAmount: this.pricing.taxAmount?.toJSON(),
      },
      retryState: this.retryState,
      pendingPlanChange: this.pendingPlanChange,
      appliedPromotions: this.appliedPromotions,
      cancellation: this.cancellation,
      trialEndDate: this.trialEndDate?.toISOString(),
      startDate: this.startDate.toISOString(),
      endDate: this.endDate?.toISOString(),
      description: this.description,
      metadata: this.metadata,
    };
  }

  /**
   * 生成訂閱ID
   */
  private generateSubscriptionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `sub_${timestamp}${random}`;
  }

  // ==================== Backward Compatibility Methods ====================
  // These methods provide compatibility with the existing codebase

  public get planName(): string {
    return this.planId; // Using planId as planName for backward compatibility
  }

  public get amount(): number {
    return this.pricing.baseAmount.amount;
  }

  public get currency(): string {
    return this.pricing.currency;
  }

  public get currentPeriodStart(): Date {
    return this.currentPeriod.startDate;
  }

  public get currentPeriodEnd(): Date {
    return this.currentPeriod.endDate;
  }

  public get nextBillingDate(): Date {
    return this.billingCycle.calculateNextBillingDate(this.currentPeriod.endDate);
  }

  public get canceledDate(): Date | null {
    return this.cancellation?.cancelledAt || null;
  }

  public get cancelReason(): string | null {
    return this.cancellation?.reason || null;
  }

  public get consecutiveFailures(): number {
    return this.retryState.failureCount || this.retryState.retryCount;
  }

  public get lastSuccessfulBillingDate(): Date | null {
    return this.retryState.lastSuccessDate || null;
  }

  public get lastFailedBillingDate(): Date | null {
    return this.retryState.lastFailureDate || this.retryState.lastRetryDate || null;
  }

  public get gracePeriodEndDate(): Date | null {
    const gracePeriodEnd = this.metadata.gracePeriodEndDate;
    return gracePeriodEnd ? new Date(gracePeriodEnd) : null;
  }

  /**
   * 更新計費週期 (向後兼容方法)
   */
  public updateBillingPeriod(startDate: Date, endDate: Date, nextBillingDate?: Date): void {
    this.currentPeriod = new BillingPeriod(startDate, endDate);

    // 如果提供了下次計費日期，更新到 metadata 中
    if (nextBillingDate) {
      this.metadata.nextBillingDate = nextBillingDate.toISOString();
    }

    this.touch();
  }

  /**
   * 記錄成功計費 (向後兼容方法)
   */
  public recordSuccessfulBilling(): void {
    this.retryState.lastSuccessDate = new Date();
    this.retryState.failureCount = 0;
    this.retryState.retryCount = 0;

    // 更新到下一個計費週期
    const nextStartDate = this.currentPeriod.endDate;
    const nextPeriod = new BillingPeriod(nextStartDate, this.billingCycle.calculateNextBillingDate(nextStartDate));
    this.currentPeriod = nextPeriod;

    this.touch();
  }

  /**
   * 記錄失敗計費 (向後兼容方法)
   */
  public recordFailedBilling(): void {
    this.retryState.lastFailureDate = new Date();
    this.retryState.failureCount = (this.retryState.failureCount || 0) + 1;
    this.touch();
  }

  /**
   * 標記為過期 (向後兼容方法)
   */
  public markPastDue(gracePeriodEnd: Date): void {
    this.metadata.gracePeriodEndDate = gracePeriodEnd.toISOString();
    this.transitionToStatus(SubscriptionStatus.PAST_DUE, {
      reason: 'Payment failed, entered grace period',
    });
  }
}
