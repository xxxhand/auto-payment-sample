import { Money } from '../value-objects/money';
import { BillingCycleVO } from '../value-objects/billing-cycle';
import { PromotionType, PaymentFailureCategory, RetryStrategyType } from '../enums/codes.const';

/**
 * 優惠規則介面
 */
export interface IPromotionRule {
  type: PromotionType;
  priority: number;
  isApplicable(context: PromotionContext): boolean;
  calculateDiscount(originalAmount: Money, context: PromotionContext): Money;
}

/**
 * 優惠套用上下文
 */
export interface PromotionContext {
  customerId: string;
  productId: string;
  planId: string;
  subscriptionCycle: number;
  isFirstSubscription: boolean;
  customerTags?: string[];
  metadata?: Record<string, any>;
}

/**
 * 優惠計算結果
 */
export interface DiscountResult {
  originalAmount: Money;
  totalDiscount: Money;
  finalAmount: Money;
  appliedPromotions: {
    promotionId: string;
    discountAmount: Money;
    rule: IPromotionRule;
  }[];
}

/**
 * 百分比折扣規則
 */
export class PercentageDiscountRule implements IPromotionRule {
  public readonly type = PromotionType.PERCENTAGE_DISCOUNT;

  constructor(
    public readonly priority: number,
    private readonly discountPercentage: number,
    private readonly applicablePlans?: string[],
    private readonly maxDiscount?: Money,
  ) {}

  isApplicable(context: PromotionContext): boolean {
    if (this.applicablePlans && !this.applicablePlans.includes(context.planId)) {
      return false;
    }
    return true;
  }

  calculateDiscount(originalAmount: Money, context: PromotionContext): Money {
    let discount = originalAmount.percentage(this.discountPercentage);

    // 應用最大折扣限制
    if (this.maxDiscount && discount.isGreaterThan(this.maxDiscount)) {
      discount = this.maxDiscount;
    }

    // 記錄應用上下文以供審計
    if (context.metadata) {
      context.metadata.discountApplied = this.discountPercentage;
    }

    return discount;
  }
}

/**
 * 固定金額折扣規則
 */
export class FixedAmountDiscountRule implements IPromotionRule {
  public readonly type = PromotionType.FIXED_AMOUNT_DISCOUNT;

  constructor(
    public readonly priority: number,
    private readonly discountAmount: Money,
    private readonly minimumAmount?: Money,
  ) {}

  isApplicable(context: PromotionContext): boolean {
    // 記錄檢查的上下文信息
    const isApplicable = true;
    if (context.metadata) {
      context.metadata.fixedAmountRuleChecked = true;
    }
    return isApplicable;
  }

  calculateDiscount(originalAmount: Money, context: PromotionContext): Money {
    // 檢查最低金額要求
    if (this.minimumAmount && originalAmount.isLessThan(this.minimumAmount)) {
      return Money.zero(originalAmount.currency);
    }

    // 折扣不能超過原始金額
    if (this.discountAmount.isGreaterThan(originalAmount)) {
      return originalAmount;
    }

    // 記錄應用上下文
    if (context.metadata) {
      context.metadata.fixedAmountApplied = this.discountAmount.amount;
    }

    return this.discountAmount;
  }
}

/**
 * 首次訂閱優惠規則
 */
export class FirstSubscriptionDiscountRule implements IPromotionRule {
  public readonly type = PromotionType.FIRST_SUBSCRIPTION_DISCOUNT;

  constructor(
    public readonly priority: number,
    private readonly discountPercentage: number,
  ) {}

  isApplicable(context: PromotionContext): boolean {
    return context.isFirstSubscription;
  }

  calculateDiscount(originalAmount: Money, context: PromotionContext): Money {
    // 記錄首次訂閱折扣的應用
    if (context.metadata) {
      context.metadata.firstSubscriptionDiscountApplied = this.discountPercentage;
    }

    return originalAmount.percentage(this.discountPercentage);
  }
}

/**
 * 階段性折扣規則
 */
export class StagedDiscountRule implements IPromotionRule {
  public readonly type = PromotionType.STAGED_DISCOUNT;

  constructor(
    public readonly priority: number,
    private readonly stages: Array<{
      cycleStart: number;
      cycleEnd: number;
      discountPercentage: number;
    }>,
  ) {}

  isApplicable(context: PromotionContext): boolean {
    return this.stages.some((stage) => context.subscriptionCycle >= stage.cycleStart && context.subscriptionCycle <= stage.cycleEnd);
  }

  calculateDiscount(originalAmount: Money, context: PromotionContext): Money {
    const applicableStage = this.stages.find((stage) => context.subscriptionCycle >= stage.cycleStart && context.subscriptionCycle <= stage.cycleEnd);

    if (!applicableStage) {
      return Money.zero(originalAmount.currency);
    }

    // 記錄應用的階段到上下文
    if (context.metadata) {
      context.metadata.appliedStage = applicableStage;
    }

    return originalAmount.percentage(applicableStage.discountPercentage);
  }
}

/**
 * 優惠計算引擎
 * 管理多個優惠規則的套用和計算邏輯
 */
export class PromotionEngine {
  private rules: Map<string, IPromotionRule> = new Map();

  /**
   * 註冊優惠規則
   */
  registerRule(promotionId: string, rule: IPromotionRule): void {
    this.rules.set(promotionId, rule);
  }

  /**
   * 移除優惠規則
   */
  removeRule(promotionId: string): void {
    this.rules.delete(promotionId);
  }

  /**
   * 計算最佳優惠組合
   */
  calculateOptimalDiscount(originalAmount: Money, context: PromotionContext, availablePromotions: string[]): DiscountResult {
    const applicableRules = availablePromotions
      .map((promotionId) => ({
        promotionId,
        rule: this.rules.get(promotionId),
      }))
      .filter((item) => item.rule && item.rule.isApplicable(context))
      .sort((a, b) => b.rule!.priority - a.rule!.priority);

    let totalDiscount = Money.zero(originalAmount.currency);
    const appliedPromotions: DiscountResult['appliedPromotions'] = [];

    // 按優先級套用優惠
    for (const { promotionId, rule } of applicableRules) {
      if (!rule) continue;

      const discount = rule.calculateDiscount(originalAmount, context);
      if (discount.isPositive()) {
        totalDiscount = totalDiscount.add(discount);
        appliedPromotions.push({
          promotionId,
          discountAmount: discount,
          rule,
        });

        // 避免折扣超過原始金額
        if (totalDiscount.isGreaterThan(originalAmount)) {
          totalDiscount = originalAmount;
          break;
        }
      }
    }

    const finalAmount = originalAmount.subtract(totalDiscount);

    return {
      originalAmount,
      totalDiscount,
      finalAmount,
      appliedPromotions,
    };
  }

  /**
   * 獲取適用的優惠清單
   */
  getApplicablePromotions(context: PromotionContext): string[] {
    const applicable: string[] = [];

    for (const [promotionId, rule] of this.rules.entries()) {
      if (rule.isApplicable(context)) {
        applicable.push(promotionId);
      }
    }

    return applicable.sort((a, b) => {
      const ruleA = this.rules.get(a);
      const ruleB = this.rules.get(b);
      return (ruleB?.priority || 0) - (ruleA?.priority || 0);
    });
  }
}

/**
 * 重試配置
 */
export interface RetryConfiguration {
  strategyType: RetryStrategyType;
  maxRetries: number;
  baseDelayMinutes: number;
  maxDelayMinutes: number;
  multiplier?: number; // 指數退避使用
}

/**
 * 重試策略介面
 */
export interface IRetryStrategy {
  calculateNextRetryTime(attemptNumber: number, lastAttemptTime: Date): Date | null;
  shouldRetry(attemptNumber: number, failureCategory: PaymentFailureCategory): boolean;
}

/**
 * 線性重試策略
 */
export class LinearRetryStrategy implements IRetryStrategy {
  constructor(private config: RetryConfiguration) {}

  calculateNextRetryTime(attemptNumber: number, lastAttemptTime: Date): Date | null {
    if (attemptNumber >= this.config.maxRetries) {
      return null;
    }

    const delayMinutes = Math.min(this.config.baseDelayMinutes * (attemptNumber + 1), this.config.maxDelayMinutes);

    return new Date(lastAttemptTime.getTime() + delayMinutes * 60 * 1000);
  }

  shouldRetry(attemptNumber: number, failureCategory: PaymentFailureCategory): boolean {
    if (attemptNumber >= this.config.maxRetries) return false;
    return failureCategory !== PaymentFailureCategory.NON_RETRIABLE;
  }
}

/**
 * 指數退避重試策略
 */
export class ExponentialBackoffRetryStrategy implements IRetryStrategy {
  constructor(private config: RetryConfiguration) {}

  calculateNextRetryTime(attemptNumber: number, lastAttemptTime: Date): Date | null {
    if (attemptNumber >= this.config.maxRetries) {
      return null;
    }

    const multiplier = this.config.multiplier || 2;
    const delayMinutes = Math.min(this.config.baseDelayMinutes * Math.pow(multiplier, attemptNumber), this.config.maxDelayMinutes);

    return new Date(lastAttemptTime.getTime() + delayMinutes * 60 * 1000);
  }

  shouldRetry(attemptNumber: number, failureCategory: PaymentFailureCategory): boolean {
    if (attemptNumber >= this.config.maxRetries) return false;
    return failureCategory !== PaymentFailureCategory.NON_RETRIABLE;
  }
}

/**
 * 固定間隔重試策略
 */
export class FixedIntervalRetryStrategy implements IRetryStrategy {
  constructor(private config: RetryConfiguration) {}

  calculateNextRetryTime(attemptNumber: number, lastAttemptTime: Date): Date | null {
    if (attemptNumber >= this.config.maxRetries) {
      return null;
    }

    return new Date(lastAttemptTime.getTime() + this.config.baseDelayMinutes * 60 * 1000);
  }

  shouldRetry(attemptNumber: number, failureCategory: PaymentFailureCategory): boolean {
    if (attemptNumber >= this.config.maxRetries) return false;
    return failureCategory !== PaymentFailureCategory.NON_RETRIABLE;
  }
}

/**
 * 重試策略工廠
 */
export class RetryStrategyFactory {
  static createStrategy(config: RetryConfiguration): IRetryStrategy {
    switch (config.strategyType) {
      case RetryStrategyType.LINEAR:
        return new LinearRetryStrategy(config);
      case RetryStrategyType.EXPONENTIAL_BACKOFF:
        return new ExponentialBackoffRetryStrategy(config);
      case RetryStrategyType.FIXED_INTERVAL:
        return new FixedIntervalRetryStrategy(config);
      default:
        throw new Error(`Unsupported retry strategy: ${config.strategyType}`);
    }
  }
}

/**
 * 計費規則引擎
 * 管理計費週期、金額計算等業務邏輯
 */
export class BillingRulesEngine {
  /**
   * 計算按比例費用（升級/降級時使用）
   */
  static calculateProrationAmount(fromPlanAmount: Money, toPlanAmount: Money, billingCycle: BillingCycleVO, changeDate: Date, currentPeriodEndDate: Date): Money {
    const totalDays = billingCycle.getTotalCycleDays();
    const remainingDays = Math.ceil((currentPeriodEndDate.getTime() - changeDate.getTime()) / (1000 * 60 * 60 * 24));

    if (remainingDays <= 0) {
      return Money.zero(toPlanAmount.currency);
    }

    // 計算剩餘期間的費用差額
    const priceDifference = toPlanAmount.subtract(fromPlanAmount);
    const prorationFactor = remainingDays / totalDays;

    return priceDifference.multiply(prorationFactor);
  }

  /**
   * 計算寬限期結束日期
   */
  static calculateGracePeriodEndDate(billingFailureDate: Date, billingCycle: BillingCycleVO, gracePeriodDays: number = 3): Date {
    return new Date(billingFailureDate.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000);
  }

  /**
   * 計算下次計費金額（含稅）
   */
  static calculateNextBillingAmount(baseAmount: Money, taxRate: number = 0, appliedDiscounts: Money[] = []): Money {
    let amount = baseAmount;

    // 套用折扣
    for (const discount of appliedDiscounts) {
      amount = amount.subtract(discount);
    }

    // 加上稅額
    if (taxRate > 0) {
      const tax = amount.percentage(taxRate);
      amount = amount.add(tax);
    }

    return amount;
  }

  /**
   * 驗證金額變更是否合理
   */
  static validateAmountChange(
    currentAmount: Money,
    newAmount: Money,
    maxChangePercentage: number = 1000, // 預設最大變更1000%
  ): boolean {
    if (currentAmount.isZero()) return true;

    const changeRatio = Math.abs((newAmount.amount - currentAmount.amount) / currentAmount.amount);
    return changeRatio <= maxChangePercentage / 100;
  }
}
