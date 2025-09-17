import { EligibilityRule, EligibilityCheckResult, PromotionEvaluationContext } from './eligibility-rule.interface';

export class ScopeRule implements EligibilityRule {
  name = 'SCOPE';
  order = 15;
  evaluate(ctx: PromotionEvaluationContext): EligibilityCheckResult {
    const { promotion, productId, planId } = ctx;
    const scope = promotion.scope;
    if (!scope) return { passed: true };
    if (scope.productIds && scope.productIds.length && (!productId || !scope.productIds.includes(productId))) {
      return { passed: false, reason: 'PRODUCT_NOT_IN_SCOPE' };
    }
    if (scope.planIds && scope.planIds.length && (!planId || !scope.planIds.includes(planId))) {
      return { passed: false, reason: 'PLAN_NOT_IN_SCOPE' };
    }
    return { passed: true };
  }
}
