import { EligibilityRule, EligibilityCheckResult, PromotionEvaluationContext } from './eligibility-rule.interface';
import { PromotionStatus } from '../../../enums/promotion.enums';

export class StatusRule implements EligibilityRule {
  name = 'STATUS';
  order = 5;
  evaluate(ctx: PromotionEvaluationContext): EligibilityCheckResult {
    if (ctx.promotion.status !== PromotionStatus.ACTIVE) return { passed: false, reason: 'INACTIVE' };
    return { passed: true };
  }
}
