import { DiscountType, PromotionStatus, PromotionType } from '../enums/promotion.enums';

export interface PromotionPeriod {
  startAt: string; // ISO8601
  endAt: string; // ISO8601
}

export interface PromotionScope {
  productIds?: string[];
  planIds?: string[];
}

export interface PromotionDiscountTier {
  threshold: number;
  value: number;
} // value meaning depends on context (percentage or fixed amount)
export interface PromotionThresholdBonusRule {
  min: number;
  bonusType: 'AMOUNT' | 'PERCENTAGE';
  value: number;
}

export interface PromotionDiscount {
  type: DiscountType;
  /**
   * value: currency units (FIXED_AMOUNT), percentage 0-100 (PERCENTAGE), cycles count (FREE_CYCLES)
   * For TIERED / THRESHOLD_BONUS this may be omitted in favor of tiers / thresholdRules
   */
  value?: number;
  currency?: string; // required when type = FIXED_AMOUNT
  maxCycles?: number; // how many cycles to apply (for cyclical capped discounts / FREE_CYCLES scope)
  tiers?: PromotionDiscountTier[]; // for TIERED
  thresholdRules?: PromotionThresholdBonusRule[]; // for THRESHOLD_BONUS
}

export interface PromotionEligibility {
  newCustomerOnly?: boolean;
  minOrderAmount?: number;
  regions?: string[];
  customerSegments?: string[];
}

export interface PromotionUsage {
  globalLimit?: number; // null/undefined means unlimited
  perCustomerLimit?: number; // typical 1 for per-customer once
}

export interface PromotionStackingPolicy {
  exclusive: boolean; // true => cannot stack with others
}

export interface PromotionUsageCounters {
  globalLimit?: number;
  perCustomerLimit?: number;
  globalUsed?: number; // snapshot to avoid aggregation cost
}

export interface Promotion {
  id: string;
  name: string;
  type: PromotionType;
  priority: number; // larger means higher priority
  scope?: PromotionScope;
  discount: PromotionDiscount;
  period: PromotionPeriod;
  eligibility?: PromotionEligibility;
  usage?: PromotionUsage; // legacy naming kept for backward compat
  usageCounters?: PromotionUsageCounters; // new extended counters
  status: PromotionStatus;
  code?: string; // present when type = CODE
  stacking?: PromotionStackingPolicy;
  metadata?: Record<string, any>;
}

export interface SubscriptionAppliedPromotion {
  promotionId: string;
  code?: string;
  cyclesApplied?: number;
  cyclesRemaining?: number;
  appliedAt: string; // ISO8601
  pricingSnapshot?: {
    baseAmount: number;
    discountAmount: number;
    finalAmount: number;
    currency: string;
  };
}

export interface ValidatePromotionResult {
  isValid: boolean;
  reasons: string[];
  promotion?: Pick<Promotion, 'id' | 'code' | 'name' | 'priority' | 'type'>;
  discount?: PromotionDiscount;
  validPeriod?: PromotionPeriod;
  usage?: {
    remainingForCustomer?: number; // 0/1 for per-customer once or actual remaining count
    globalRemaining?: number | null; // null for unlimited
  };
  estimatedSavings?: number; // added for selection logic
}
