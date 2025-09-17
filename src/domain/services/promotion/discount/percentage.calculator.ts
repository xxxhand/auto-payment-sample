import { DiscountCalculator, DiscountComputationContext, DiscountComputationResult, clampDiscount } from '../discount/discount-calculator.interface';
import { DiscountType } from '../../../enums/promotion.enums';
import { Promotion } from '../../../value-objects/promotion.model';

export class PercentageDiscountCalculator implements DiscountCalculator {
  order = 15;
  supports(promotion: Promotion): boolean {
    return promotion.discount?.type === DiscountType.PERCENTAGE;
  }
  compute(ctx: DiscountComputationContext): DiscountComputationResult {
    let percent = ctx.promotion.discount?.value ?? 0;
    if (percent < 0) percent = 0;
    if (percent > 100) percent = 100;
    const raw = Math.round((ctx.baseAmount * percent) / 100);
    const discountAmount = clampDiscount(ctx.baseAmount, raw);
    return { discountAmount, finalAmount: ctx.baseAmount - discountAmount, effectiveType: DiscountType.PERCENTAGE, metadata: { percent } };
  }
}
