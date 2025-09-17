import { DiscountCalculator, DiscountComputationContext, DiscountComputationResult } from './discount-calculator.interface';
import { DiscountType } from '../../../enums/promotion.enums';
import { Promotion } from '../../../value-objects/promotion.model';

export class FreeCyclesDiscountCalculator implements DiscountCalculator {
  order = 5;
  supports(promotion: Promotion): boolean {
    return promotion.discount?.type === DiscountType.FREE_CYCLES;
  }
  compute(ctx: DiscountComputationContext): DiscountComputationResult {
    const cycleNumber = ctx.cycleNumber ?? 0;
    const totalFree = ctx.promotion.discount?.value ?? 0;
    if (cycleNumber < totalFree) {
      const remaining = totalFree - cycleNumber - 1;
      return {
        discountAmount: ctx.baseAmount,
        finalAmount: 0,
        freeCycleApplied: true,
        cyclesRemaining: remaining >= 0 ? remaining : 0,
        effectiveType: DiscountType.FREE_CYCLES,
        metadata: { totalFreeCycles: totalFree, cycleNumber },
      };
    }
    return { discountAmount: 0, finalAmount: ctx.baseAmount, effectiveType: DiscountType.FREE_CYCLES, cyclesRemaining: 0 };
  }
}
