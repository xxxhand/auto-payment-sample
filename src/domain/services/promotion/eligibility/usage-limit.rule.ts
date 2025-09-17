import { EligibilityRule, EligibilityCheckResult, PromotionEvaluationContext } from './eligibility-rule.interface';

export class UsageLimitRule implements EligibilityRule {
  name = 'USAGE_LIMIT';
  order = 20;
  evaluate(ctx: PromotionEvaluationContext): EligibilityCheckResult {
    const { promotion, usageRecord, globalRemaining } = ctx;
    const perCustomerLimit = promotion.usageCounters?.perCustomerLimit ?? promotion.usage?.perCustomerLimit;
    const globalLimit = promotion.usageCounters?.globalLimit ?? promotion.usage?.globalLimit;
    if (globalLimit != null) {
      if ((promotion.usageCounters?.globalUsed || 0) >= globalLimit || (globalRemaining != null && globalRemaining <= 0)) {
        return { passed: false, reason: 'GLOBAL_LIMIT_EXHAUSTED' };
      }
    }
    if (perCustomerLimit != null && usageRecord) {
      if (usageRecord.timesUsed >= perCustomerLimit) return { passed: false, reason: 'PER_CUSTOMER_LIMIT_REACHED' };
    }
    return { passed: true };
  }
}
