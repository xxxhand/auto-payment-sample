import { DiscountCalculator, DiscountComputationContext, DiscountComputationResult, clampDiscount } from './discount-calculator.interface';
import { DiscountType } from '../../../enums/promotion.enums';
import { Promotion } from '../../../value-objects/promotion.model';

export class ThresholdBonusDiscountCalculator implements DiscountCalculator {
  order = 25;
  supports(promotion: Promotion): boolean {
    return promotion.discount?.type === DiscountType.THRESHOLD_BONUS && Array.isArray(promotion.discount?.thresholdRules);
  }
  compute(ctx: DiscountComputationContext): DiscountComputationResult {
    const rules = [...(ctx.promotion.discount?.thresholdRules || [])].sort((a, b) => a.min - b.min);
    let applied = rules[0];
    for (const r of rules) {
      if (ctx.baseAmount >= r.min) applied = r;
      else break;
    }
    if (!applied) {
      return { discountAmount: 0, finalAmount: ctx.baseAmount, effectiveType: DiscountType.THRESHOLD_BONUS };
    }
    let discountAmount = 0;
    if (applied.bonusType === 'AMOUNT') {
      discountAmount = clampDiscount(ctx.baseAmount, applied.value);
    } else {
      let percent = applied.value;
      if (percent < 0) percent = 0;
      if (percent > 100) percent = 100;
      discountAmount = clampDiscount(ctx.baseAmount, Math.round((ctx.baseAmount * percent) / 100));
    }
    return {
      discountAmount,
      finalAmount: ctx.baseAmount - discountAmount,
      effectiveType: DiscountType.THRESHOLD_BONUS,
      metadata: { appliedMin: applied.min, bonusType: applied.bonusType },
    };
  }
}
