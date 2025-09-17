import { DiscountCalculator, DiscountComputationContext, DiscountComputationResult, clampDiscount } from './discount-calculator.interface';
import { DiscountType } from '../../../enums/promotion.enums';
import { Promotion } from '../../../value-objects/promotion.model';

export class TieredDiscountCalculator implements DiscountCalculator {
  order = 20;
  supports(promotion: Promotion): boolean {
    return promotion.discount?.type === DiscountType.TIERED && Array.isArray(promotion.discount?.tiers);
  }
  compute(ctx: DiscountComputationContext): DiscountComputationResult {
    const tiers = [...(ctx.promotion.discount?.tiers || [])].sort((a, b) => a.threshold - b.threshold);
    let applied = tiers[0];
    for (const t of tiers) {
      if (ctx.baseAmount >= t.threshold) applied = t;
      else break;
    }
    if (!applied) {
      return { discountAmount: 0, finalAmount: ctx.baseAmount, effectiveType: DiscountType.TIERED };
    }
    let percent = applied.value;
    if (percent < 0) percent = 0;
    if (percent > 100) percent = 100;
    const raw = Math.round((ctx.baseAmount * percent) / 100);
    const discountAmount = clampDiscount(ctx.baseAmount, raw);
    return {
      discountAmount,
      finalAmount: ctx.baseAmount - discountAmount,
      effectiveType: DiscountType.TIERED,
      metadata: { appliedThreshold: applied.threshold, percent },
    };
  }
}
