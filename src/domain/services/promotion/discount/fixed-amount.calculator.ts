import { DiscountCalculator, DiscountComputationContext, DiscountComputationResult, clampDiscount } from '../discount/discount-calculator.interface';
import { DiscountType } from '../../../enums/promotion.enums';
import { Promotion } from '../../../value-objects/promotion.model';

export class FixedAmountDiscountCalculator implements DiscountCalculator {
  order = 10;
  supports(promotion: Promotion): boolean {
    return promotion.discount?.type === DiscountType.FIXED_AMOUNT;
  }
  compute(ctx: DiscountComputationContext): DiscountComputationResult {
    const raw = ctx.promotion.discount?.value ?? 0;
    const discountAmount = clampDiscount(ctx.baseAmount, raw);
    return { discountAmount, finalAmount: ctx.baseAmount - discountAmount, effectiveType: DiscountType.FIXED_AMOUNT };
  }
}
