import { Money } from '../value-objects/money';
import { BillingCycleVO } from '../value-objects/billing-cycle';
import { PromotionEngine, PromotionContext, RetryStrategyFactory, RetryConfiguration } from './business-rules.engine';
import { PaymentFailureCategory } from '../enums/codes.const';

/**
 * 計費服務介面
 */
export interface IBillingService {
  calculateNextBillingDate(currentDate: Date, billingCycle: BillingCycleVO): Date;
  calculateProration(fromAmount: Money, toAmount: Money, daysUsed: number, totalDays: number): Money;
  applyPromotions(baseAmount: Money, context: PromotionContext, availablePromotions: string[]): Money;
}

/**
 * 核心計費服務
 * 處理訂閱計費相關的業務邏輯
 */
export class BillingService implements IBillingService {
  constructor(private readonly promotionEngine: PromotionEngine) {}

  /**
   * 計算下次計費日期
   */
  calculateNextBillingDate(currentDate: Date, billingCycle: BillingCycleVO): Date {
    return billingCycle.calculateNextBillingDate(currentDate);
  }

  /**
   * 計算按比例費用
   */
  calculateProration(fromAmount: Money, toAmount: Money, daysUsed: number, totalDays: number): Money {
    if (totalDays <= 0 || daysUsed <= 0) {
      return Money.zero(toAmount.currency);
    }

    const priceDifference = toAmount.subtract(fromAmount);
    const usageFactor = daysUsed / totalDays;

    return priceDifference.multiply(usageFactor);
  }

  /**
   * 套用優惠折扣
   */
  applyPromotions(baseAmount: Money, context: PromotionContext, availablePromotions: string[]): Money {
    const result = this.promotionEngine.calculateOptimalDiscount(baseAmount, context, availablePromotions);
    return result.finalAmount;
  }

  /**
   * 計算完整的計費金額（含稅和折扣）
   */
  calculateFullBillingAmount(
    baseAmount: Money,
    taxRate: number,
    context: PromotionContext,
    availablePromotions: string[] = [],
  ): {
    baseAmount: Money;
    discountAmount: Money;
    taxableAmount: Money;
    taxAmount: Money;
    finalAmount: Money;
  } {
    // 套用優惠
    const discountResult = this.promotionEngine.calculateOptimalDiscount(baseAmount, context, availablePromotions);
    const discountAmount = discountResult.totalDiscount;
    const taxableAmount = discountResult.finalAmount;

    // 計算稅額
    const taxAmount = taxableAmount.percentage(taxRate);
    const finalAmount = taxableAmount.add(taxAmount);

    return {
      baseAmount,
      discountAmount,
      taxableAmount,
      taxAmount,
      finalAmount,
    };
  }
}

/**
 * 重試管理服務介面
 */
export interface IRetryService {
  shouldRetry(attemptNumber: number, failureCategory: PaymentFailureCategory): boolean;
  calculateNextRetryTime(attemptNumber: number, lastAttemptTime: Date, strategyConfig: RetryConfiguration): Date | null;
  getRetryBackoffDelay(attemptNumber: number, strategyConfig: RetryConfiguration): number;
}

/**
 * 付款重試服務
 * 管理付款失敗後的重試邏輯
 */
export class PaymentRetryService implements IRetryService {
  /**
   * 判斷是否應該重試
   */
  shouldRetry(attemptNumber: number, failureCategory: PaymentFailureCategory): boolean {
    // 不可重試的錯誤類型
    if (failureCategory === PaymentFailureCategory.NON_RETRIABLE) {
      return false;
    }

    return true;
  }

  /**
   * 計算下次重試時間
   */
  calculateNextRetryTime(attemptNumber: number, lastAttemptTime: Date, strategyConfig: RetryConfiguration): Date | null {
    const strategy = RetryStrategyFactory.createStrategy(strategyConfig);
    return strategy.calculateNextRetryTime(attemptNumber, lastAttemptTime);
  }

  /**
   * 獲取退避延遲時間（分鐘）
   */
  getRetryBackoffDelay(attemptNumber: number, strategyConfig: RetryConfiguration): number {
    const strategy = RetryStrategyFactory.createStrategy(strategyConfig);
    const now = new Date();
    const nextRetryTime = strategy.calculateNextRetryTime(attemptNumber, now);

    if (!nextRetryTime) return 0;

    return Math.ceil((nextRetryTime.getTime() - now.getTime()) / (60 * 1000));
  }

  /**
   * 根據失敗類型推薦重試策略
   */
  recommendRetryStrategy(failureCategory: PaymentFailureCategory): RetryConfiguration | null {
    switch (failureCategory) {
      case PaymentFailureCategory.RETRIABLE:
        return {
          strategyType: 'exponential_backoff' as any,
          maxRetries: 5,
          baseDelayMinutes: 5,
          maxDelayMinutes: 60,
          multiplier: 2,
        };

      case PaymentFailureCategory.DELAYED_RETRY:
        return {
          strategyType: 'fixed_interval' as any,
          maxRetries: 3,
          baseDelayMinutes: 1440, // 24小時
          maxDelayMinutes: 1440,
        };

      default:
        return null;
    }
  }
}

/**
 * 訂閱生命週期服務介面
 */
export interface ISubscriptionLifecycleService {
  canUpgrade(currentPlanId: string, targetPlanId: string): boolean;
  canDowngrade(currentPlanId: string, targetPlanId: string): boolean;
  calculateUpgradeProration(currentPlan: any, targetPlan: any, changeDate: Date): Money;
}

/**
 * 訂閱生命週期管理服務
 * 處理訂閱升級、降級等生命週期操作
 */
export class SubscriptionLifecycleService implements ISubscriptionLifecycleService {
  private planHierarchy: Map<string, number> = new Map();

  constructor(planHierarchyConfig: Record<string, number>) {
    for (const [planId, level] of Object.entries(planHierarchyConfig)) {
      this.planHierarchy.set(planId, level);
    }
  }

  /**
   * 檢查是否可以升級
   */
  canUpgrade(currentPlanId: string, targetPlanId: string): boolean {
    const currentLevel = this.planHierarchy.get(currentPlanId);
    const targetLevel = this.planHierarchy.get(targetPlanId);

    if (currentLevel === undefined || targetLevel === undefined) {
      return false;
    }

    return targetLevel > currentLevel;
  }

  /**
   * 檢查是否可以降級
   */
  canDowngrade(currentPlanId: string, targetPlanId: string): boolean {
    const currentLevel = this.planHierarchy.get(currentPlanId);
    const targetLevel = this.planHierarchy.get(targetPlanId);

    if (currentLevel === undefined || targetLevel === undefined) {
      return false;
    }

    return targetLevel < currentLevel;
  }

  /**
   * 計算升級的按比例費用
   */
  calculateUpgradeProration(currentPlan: { amount: Money; billingCycle: BillingCycleVO }, targetPlan: { amount: Money; billingCycle: BillingCycleVO }, changeDate: Date): Money {
    // 確保計費週期相同
    if (currentPlan.billingCycle.type !== targetPlan.billingCycle.type) {
      throw new Error('Cannot calculate proration for different billing cycles');
    }

    const billingCycle = currentPlan.billingCycle;
    const nextBillingDate = billingCycle.calculateNextBillingDate(changeDate);
    const totalDays = billingCycle.getTotalCycleDays();
    const remainingDays = Math.ceil((nextBillingDate.getTime() - changeDate.getTime()) / (1000 * 60 * 60 * 24));

    if (remainingDays <= 0) {
      return Money.zero(targetPlan.amount.currency);
    }

    const priceDifference = targetPlan.amount.subtract(currentPlan.amount);
    const prorationFactor = remainingDays / totalDays;

    return priceDifference.multiply(prorationFactor);
  }

  /**
   * 檢查計劃變更是否需要立即計費
   */
  requiresImmediateBilling(currentPlanId: string, targetPlanId: string): boolean {
    return this.canUpgrade(currentPlanId, targetPlanId);
  }

  /**
   * 計算計劃變更的生效日期
   */
  calculateChangeEffectiveDate(changeType: 'upgrade' | 'downgrade', requestDate: Date): Date {
    switch (changeType) {
      case 'upgrade':
        // 升級立即生效
        return requestDate;
      case 'downgrade':
        // 降級在下個計費週期生效
        return this.calculateNextBillingCycleStart(requestDate);
      default:
        return requestDate;
    }
  }

  /**
   * 計算下個計費週期開始日期
   */
  private calculateNextBillingCycleStart(currentDate: Date): Date {
    // 簡化實現，實際應該根據現有訂閱的計費週期計算
    const nextMonth = new Date(currentDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    return nextMonth;
  }
}
