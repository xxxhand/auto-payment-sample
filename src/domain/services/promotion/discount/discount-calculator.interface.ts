import { Promotion } from '../../../value-objects/promotion.model';
import { PromotionUsageRecord } from '../../../interfaces/promotion-usage.repository';
import { DiscountType } from '../../../enums/promotion.enums';

export interface DiscountComputationContext {
  promotion: Promotion;
  baseAmount: number;
  currency: string;
  cycleNumber?: number;
  now: Date;
  usageRecord?: PromotionUsageRecord | null;
}

export interface DiscountComputationResult {
  discountAmount: number;
  finalAmount: number;
  freeCycleApplied?: boolean;
  cyclesRemaining?: number;
  effectiveType: DiscountType | string;
  metadata?: Record<string, any>;
}

export interface DiscountCalculator {
  supports(promotion: Promotion): boolean;
  compute(ctx: DiscountComputationContext): DiscountComputationResult;
  order?: number;
}

export function clampDiscount(base: number, discount: number): number {
  if (discount <= 0) return 0;
  if (discount >= base) return base;
  return discount;
}
