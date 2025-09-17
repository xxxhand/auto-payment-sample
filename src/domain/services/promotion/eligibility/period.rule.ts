import { EligibilityRule, EligibilityCheckResult, PromotionEvaluationContext } from './eligibility-rule.interface';

export class PeriodRule implements EligibilityRule {
  name = 'PERIOD';
  order = 10;
  evaluate(ctx: PromotionEvaluationContext): EligibilityCheckResult {
    const { promotion, now } = ctx;
    const start = new Date(promotion.period.startAt);
    const end = new Date(promotion.period.endAt);
    if (now < start) return { passed: false, reason: 'NOT_STARTED' };
    if (now >= end) return { passed: false, reason: 'EXPIRED' };
    return { passed: true };
  }
}
