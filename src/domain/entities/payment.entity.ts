import { BaseEntity } from './base-entity.abstract';
import { PaymentStatus, PaymentFailureCategory, RefundStatus } from '../enums/codes.const';
import { Money } from '../value-objects/money';
import { PaymentStateMachine } from '../value-objects/state-machine';
import { SubscriptionEntity } from './subscription.entity';
import { PaymentSucceeded, PaymentFailed, PaymentRefunded } from '../events/payment.events';
import { RetryPolicy } from '../value-objects/retry-policy';

/**
 * 付款歷史記錄
 */
export interface PaymentStatusHistory {
  fromStatus?: PaymentStatus;
  toStatus: PaymentStatus;
  changedAt: Date;
  reason?: string;
  metadata?: Record<string, any>;
}

/**
 * 重試狀態信息
 */
export interface PaymentRetryState {
  attemptNumber: number;
  maxRetries: number;
  nextRetryAt?: Date;
  lastFailureReason?: string;
  failureCategory?: PaymentFailureCategory;
  retryStrategy: string;
}

/**
 * 付款失敗詳情
 */
export interface PaymentFailureDetails {
  errorCode?: string;
  errorMessage?: string;
  providerErrorCode?: string;
  providerErrorMessage?: string;
  category: PaymentFailureCategory;
  isRetriable: boolean;
  failedAt: Date;
  metadata?: Record<string, any>;
}

/**
 * 退款詳情
 */
export interface RefundDetails {
  refundId: string;
  refundAmount: Money;
  refundedAt: Date;
  reason: string;
  status: RefundStatus;
  providerRefundId?: string;
  metadata?: Record<string, any>;
}

/**
 * 增強的付款實體
 * 實現完整的付款生命週期管理，包括狀態機、重試邏輯、退款處理等
 */
export class PaymentEntity extends BaseEntity {
  /** 所屬訂閱 ID */
  public subscriptionId: string = '';

  /** 所屬客戶 ID */
  public customerId: string = '';

  /** 使用的支付方式 ID */
  public paymentMethodId: string = '';

  /** 計費週期開始日期 */
  public billingPeriodStart: Date = new Date();

  /** 計費週期結束日期 */
  public billingPeriodEnd: Date = new Date();

  /** 支付金額（以分為單位） */
  public amount: number = 0;

  /** 貨幣代碼 */
  public currency: string = 'TWD';

  /** 支付狀態 */
  public status: PaymentStatus = PaymentStatus.PENDING;

  /** 失敗詳情 */
  public failureDetails?: PaymentFailureDetails;

  /** 重試狀態 */
  public retryState?: PaymentRetryState;

  /** 狀態歷史 */
  public statusHistory: PaymentStatusHistory[] = [];

  /** 退款記錄 */
  public refunds?: RefundDetails[];

  /** 第三方支付系統的支付 ID */
  public providerPaymentId?: string;

  /** 第三方支付系統的扣款 ID */
  public providerChargeId?: string;

  /** 嘗試時間 */
  public attemptedAt?: Date;

  /** 成功時間 */
  public succeededAt?: Date;

  /** 失敗時間 */
  public failedAt?: Date;

  /** 到期日 */
  public dueDate: Date = new Date();

  /** 支付元資料 */
  public metadata?: Record<string, any>;

  // 兼容性屬性 - 與現有代碼保持兼容
  public description?: string;
  public externalTransactionId?: string;
  public attemptCount: number = 0;
  public lastAttemptAt?: Date;
  public paidAt?: Date;
  public failureReason?: string;
  public failureCode?: string;
  public refundedAt?: Date;
  public refundedAmount?: number;
  public refundReason?: string;
  public invoiceNumber?: string;
  public receiptNumber?: string;

  // 關聯
  public subscription?: SubscriptionEntity;

  // 私有狀態機實例
  private _stateMachine?: PaymentStateMachine;

  constructor(subscriptionId: string, customerId: string, paymentMethodId: string, amount: number, billingPeriodStart: Date, billingPeriodEnd: Date, currency: string = 'TWD') {
    super();
    this.subscriptionId = subscriptionId;
    this.customerId = customerId;
    this.paymentMethodId = paymentMethodId;
    this.amount = amount;
    this.currency = currency;
    this.billingPeriodStart = billingPeriodStart;
    this.billingPeriodEnd = billingPeriodEnd;
    // 設定到期日為計費週期結束日後 7 天
    this.dueDate = new Date(billingPeriodEnd.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  /**
   * 靜態工廠：建立付款（文件風格）
   */
  static create(params: {
    subscriptionId: string;
    customerId: string;
    paymentMethodId: string;
    amount: Money | number;
    currency?: string;
    periodStart: Date;
    periodEnd: Date;
  }): PaymentEntity {
    const amountNumber = params.amount instanceof Money ? params.amount.amount : params.amount;
    const currency = params.amount instanceof Money ? params.amount.currency : params.currency || 'TWD';
    const entity = new PaymentEntity(params.subscriptionId, params.customerId, params.paymentMethodId, amountNumber, params.periodStart, params.periodEnd, currency);
    if (params.amount instanceof Money) {
      entity.setAmount(params.amount);
    }
    return entity;
  }

  /**
   * 獲取付款金額 Money 物件
   */
  getAmount(): Money {
    return new Money(this.amount, this.currency);
  }

  /**
   * 設定付款金額
   */
  setAmount(money: Money): void {
    this.amount = money.amount;
    this.currency = money.currency;
  }

  /**
   * 獲取狀態機實例
   */
  private getStateMachine(): PaymentStateMachine {
    if (!this._stateMachine) {
      this._stateMachine = new PaymentStateMachine();
    }
    return this._stateMachine;
  }

  /**
   * 檢查是否可以轉換為指定狀態
   */
  canTransitionTo(targetStatus: PaymentStatus): boolean {
    const result = PaymentStateMachine.validateTransition(this.status, targetStatus, this.buildTransitionContext());
    return result.isValid;
  }

  /**
   * 轉換付款狀態
   */
  transitionTo(targetStatus: PaymentStatus, reason?: string, metadata?: Record<string, any>): void {
    const result = PaymentStateMachine.validateTransition(this.status, targetStatus, this.buildTransitionContext());

    if (!result.isValid) {
      throw new Error(`Invalid payment status transition from ${this.status} to ${targetStatus}: ${result.message || 'Unknown error'}`);
    }

    this.recordStatusChange(targetStatus, reason, metadata);
    this.status = targetStatus;

    // 更新相關時間戳記
    this.updateTimestamps(targetStatus);
  }

  /**
   * 標記付款為處理中
   */
  markAsProcessing(providerPaymentId?: string): void {
    this.transitionTo(PaymentStatus.PROCESSING, 'Payment started processing');
    this.providerPaymentId = providerPaymentId;
    this.attemptedAt = new Date();
  }

  /**
   * 標記付款成功
   */
  markAsSucceeded(providerChargeId?: string, metadata?: Record<string, any>): void {
    this.transitionTo(PaymentStatus.SUCCEEDED, 'Payment completed successfully', metadata);
    this.providerChargeId = providerChargeId;
    this.succeededAt = new Date();

    // 清除重試狀態
    this.retryState = undefined;

    // 發佈事件
    this.addDomainEvent(new PaymentSucceeded(this.id, this.subscriptionId, this.getAmount()));
  }

  /**
   * 標記付款失敗
   */
  markAsFailed(failureDetails: Omit<PaymentFailureDetails, 'failedAt'>, shouldRetry: boolean = false): void {
    this.transitionTo(PaymentStatus.FAILED, `Payment failed: ${failureDetails.errorMessage}`);

    this.failureDetails = {
      ...failureDetails,
      failedAt: new Date(),
    };
    this.failedAt = new Date();

    // 發佈事件
    this.addDomainEvent(new PaymentFailed(this.id, this.subscriptionId, failureDetails.errorMessage || 'Unknown failure', failureDetails.category));

    // 如果需要重試，轉換為重試狀態
    if (shouldRetry && failureDetails.isRetriable) {
      this.setupRetry(failureDetails.category);
    }
  }

  /**
   * 設定重試狀態
   */
  private setupRetry(failureCategory: PaymentFailureCategory): void {
    const currentAttempt = this.retryState?.attemptNumber || 0;
    const maxRetries = this.getMaxRetriesForCategory(failureCategory);

    if (currentAttempt < maxRetries) {
      this.retryState = {
        attemptNumber: currentAttempt + 1,
        maxRetries,
        lastFailureReason: this.failureDetails?.errorMessage,
        failureCategory,
        retryStrategy: this.getRetryStrategyForCategory(failureCategory),
        nextRetryAt: this.calculateNextRetryTime(currentAttempt + 1, failureCategory),
      };

      this.transitionTo(PaymentStatus.RETRYING, 'Payment scheduled for retry');
    }
  }

  /**
   * 執行重試
   */
  retry(): void {
    if (!this.retryState) {
      throw new Error('No retry state available');
    }

    if (this.status !== PaymentStatus.RETRYING) {
      throw new Error('Payment is not in retrying state');
    }

    if (this.retryState.nextRetryAt && new Date() < this.retryState.nextRetryAt) {
      throw new Error('Retry not yet due');
    }

    this.transitionTo(PaymentStatus.PENDING, `Retry attempt ${this.retryState.attemptNumber}`);
  }

  /**
   * 取消付款
   */
  cancel(reason?: string): void {
    this.transitionTo(PaymentStatus.CANCELED, reason || 'Payment canceled');
  }

  /**
   * 添加退款記錄
   */
  addRefund(refundDetails: RefundDetails): void {
    if (!this.refunds) {
      this.refunds = [];
    }

    this.refunds.push(refundDetails);

    // 檢查是否為完全退款
    const totalRefunded = this.getTotalRefundedAmount();
    const originalAmount = this.getAmount();

    if (totalRefunded.isEqual(originalAmount)) {
      this.transitionTo(PaymentStatus.REFUNDED, `Full refund completed: ${refundDetails.refundId}`);
    } else if (totalRefunded.isPositive()) {
      this.transitionTo(PaymentStatus.PARTIALLY_REFUNDED, `Partial refund completed: ${refundDetails.refundId}`);
    }

    // 發佈退款事件（僅在成功退款時）
    if (refundDetails.status === RefundStatus.SUCCEEDED) {
      this.addDomainEvent(new PaymentRefunded(this.id, this.subscriptionId, refundDetails.refundId, refundDetails.refundAmount));
    }
  }

  /**
   * 獲取總退款金額
   */
  getTotalRefundedAmount(): Money {
    if (!this.refunds || this.refunds.length === 0) {
      return Money.zero(this.currency);
    }

    return this.refunds.filter((refund) => refund.status === RefundStatus.SUCCEEDED).reduce((total, refund) => total.add(refund.refundAmount), Money.zero(this.currency));
  }

  /**
   * 檢查是否可以退款
   */
  canRefund(amount?: Money): boolean {
    if (this.status !== PaymentStatus.SUCCEEDED && this.status !== PaymentStatus.PARTIALLY_REFUNDED) {
      return false;
    }

    if (!amount) return true;

    const totalRefunded = this.getTotalRefundedAmount();
    const remainingAmount = this.getAmount().subtract(totalRefunded);

    return amount.isLessOrEqual(remainingAmount);
  }

  /**
   * 檢查付款是否逾期
   */
  isOverdue(): boolean {
    return new Date() > this.dueDate && !this.isSuccessful();
  }

  /**
   * 檢查付款是否成功
   */
  isSuccessful(): boolean {
    return this.status === PaymentStatus.SUCCEEDED;
  }

  /**
   * 檢查付款是否失敗
   */
  isFailed(): boolean {
    return this.status === PaymentStatus.FAILED || (this.status === PaymentStatus.RETRYING && !this.canRetry());
  }

  /**
   * 檢查是否可以重試
   */
  canRetry(): boolean {
    if (!this.retryState) return false;

    return this.retryState.attemptNumber < this.retryState.maxRetries && (!this.retryState.nextRetryAt || new Date() >= this.retryState.nextRetryAt);
  }

  /**
   * 檢查是否為終端狀態
   */
  isTerminalStatus(): boolean {
    const terminalStatuses = [PaymentStatus.SUCCEEDED, PaymentStatus.CANCELED, PaymentStatus.REFUNDED];
    return terminalStatuses.includes(this.status);
  }

  /**
   * 獲取逾期天數
   */
  getOverdueDays(): number {
    if (!this.isOverdue()) return 0;

    const now = new Date();
    const diffTime = now.getTime() - this.dueDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * 記錄狀態變更
   */
  private recordStatusChange(newStatus: PaymentStatus, reason?: string, metadata?: Record<string, any>): void {
    if (!this.statusHistory) {
      this.statusHistory = [];
    }

    this.statusHistory.push({
      fromStatus: this.status,
      toStatus: newStatus,
      changedAt: new Date(),
      reason,
      metadata,
    });
  }

  /**
   * 更新相關時間戳記
   */
  private updateTimestamps(status: PaymentStatus): void {
    switch (status) {
      case PaymentStatus.PROCESSING:
        this.attemptedAt = new Date();
        break;
      case PaymentStatus.SUCCEEDED:
        this.succeededAt = new Date();
        break;
      case PaymentStatus.FAILED:
        this.failedAt = new Date();
        break;
    }
  }

  /**
   * 建立狀態轉換上下文
   */
  private buildTransitionContext(): Record<string, any> {
    return {
      retryAttempt: this.retryState?.attemptNumber || 0,
      maxRetries: this.retryState?.maxRetries || 0,
      hasFailureDetails: !!this.failureDetails,
      isRetriable: this.failureDetails?.isRetriable || false,
      overdueDays: this.getOverdueDays(),
    };
  }

  /**
   * 根據失敗類型獲取最大重試次數
   */
  private getMaxRetriesForCategory(category: PaymentFailureCategory): number {
    const policy = RetryPolicy.forCategory(category);
    return policy.config.maxRetries;
  }

  /**
   * 根據失敗類型獲取重試策略
   */
  private getRetryStrategyForCategory(category: PaymentFailureCategory): string {
    const policy = RetryPolicy.forCategory(category);
    return String(policy.config.strategy);
  }

  /**
   * 計算下次重試時間
   */
  private calculateNextRetryTime(attemptNumber: number, category: PaymentFailureCategory): Date {
    const policy = RetryPolicy.forCategory(category);
    const next = policy.nextRetryAt(attemptNumber);
    // 若策略不支援重試，回傳當前時間（表示應立即由上層判斷不重試）
    return next ?? new Date();
  }

  /**
   * 獲取付款摘要信息
   */
  getSummary(): {
    id: string;
    amount: Money;
    status: PaymentStatus;
    isOverdue: boolean;
    canRetry: boolean;
    totalRefunded: Money;
    retryAttempt?: number;
    nextRetryAt?: Date;
  } {
    return {
      id: this.id,
      amount: this.getAmount(),
      status: this.status,
      isOverdue: this.isOverdue(),
      canRetry: this.canRetry(),
      totalRefunded: this.getTotalRefundedAmount(),
      retryAttempt: this.retryState?.attemptNumber,
      nextRetryAt: this.retryState?.nextRetryAt,
    };
  }

  /**
   * JSON 序列化支援
   */
  toJSON(): Record<string, any> {
    return {
      id: this.id,
      subscriptionId: this.subscriptionId,
      customerId: this.customerId,
      paymentMethodId: this.paymentMethodId,
      amount: this.getAmount().toJSON(),
      status: this.status,
      dueDate: this.dueDate,
      attemptedAt: this.attemptedAt,
      succeededAt: this.succeededAt,
      failedAt: this.failedAt,
      isOverdue: this.isOverdue(),
      canRetry: this.canRetry(),
      totalRefunded: this.getTotalRefundedAmount().toJSON(),
      retryState: this.retryState,
      failureDetails: this.failureDetails,
      refunds: this.refunds,
      statusHistory: this.statusHistory,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      // 兼容性屬性
      description: this.description,
      externalTransactionId: this.externalTransactionId,
      attemptCount: this.attemptCount,
      lastAttemptAt: this.lastAttemptAt,
      paidAt: this.paidAt,
      failureReason: this.failureReason,
      failureCode: this.failureCode,
      refundedAt: this.refundedAt,
      refundedAmount: this.refundedAmount,
      refundReason: this.refundReason,
      invoiceNumber: this.invoiceNumber,
      receiptNumber: this.receiptNumber,
    };
  }

  // 兼容性方法

  /**
   * 開始支付嘗試
   */
  startAttempt(): void {
    this.attemptCount = (this.attemptCount || 0) + 1;
    this.lastAttemptAt = new Date();
    this.attemptedAt = new Date();
    this.status = PaymentStatus.PROCESSING;

    this.recordStatusChange(PaymentStatus.PROCESSING, `Attempt ${this.attemptCount}`);
  }

  /**
   * 標記為成功 (兼容性方法)
   */
  markSucceeded(externalTransactionId?: string): void {
    this.markAsSucceeded(externalTransactionId);
  }

  /**
   * 標記為失敗 (兼容性方法)
   */
  markFailed(failureReason?: string, failureCode?: string): void {
    this.markAsFailed({
      errorMessage: failureReason || 'Unknown failure',
      category: PaymentFailureCategory.RETRIABLE,
      errorCode: failureCode,
      isRetriable: true,
    });
  }

  /**
   * 標記為取消
   */
  markCanceled(): void {
    if (!this.canTransitionTo(PaymentStatus.CANCELED)) {
      throw new Error('Cannot cancel payment in current status');
    }

    this.status = PaymentStatus.CANCELED;
    this.updatedAt = new Date();
    this.recordStatusChange(PaymentStatus.CANCELED, 'Payment cancelled');
  }

  /**
   * 處理退款
   */
  processRefund(refundAmount: number, refundReason?: string): void {
    if (this.status !== PaymentStatus.SUCCEEDED) {
      throw new Error('Can only refund successful payments');
    }

    this.refundedAmount = (this.refundedAmount || 0) + refundAmount;
    this.refundedAt = new Date();
    this.refundReason = refundReason;

    const refundDetails: RefundDetails = {
      refundId: `refund_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      refundAmount: new Money(refundAmount, this.currency),
      refundedAt: new Date(),
      reason: refundReason || 'Customer requested refund',
      status: RefundStatus.SUCCEEDED,
    };

    this.addRefund(refundDetails);
  }
}
