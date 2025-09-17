import { Promotion } from '../../../value-objects/promotion.model';
import { PromotionUsageRecord } from '../../../interfaces/promotion-usage.repository';

export interface PromotionEvaluationContext {
  promotion: Promotion;
  productId?: string;
  planId?: string;
  customerId?: string;
  now?: Date;
  usageRecord?: PromotionUsageRecord | null;
  globalRemaining?: number | null; // null => unlimited
}

export interface EligibilityCheckResult {
  passed: boolean;
  reason?: string; // e.g. PRODUCT_NOT_IN_SCOPE, PLAN_NOT_IN_SCOPE, GLOBAL_LIMIT_EXHAUSTED, PER_CUSTOMER_LIMIT_REACHED
}

export interface EligibilityRule {
  name: string;
  order?: number; // lower executes first
  evaluate(ctx: PromotionEvaluationContext): EligibilityCheckResult;
}

export interface CompositeEligibilityResult {
  isEligible: boolean;
  failedReasons: string[];
}

export function runEligibilityRules(rules: EligibilityRule[], ctx: PromotionEvaluationContext): CompositeEligibilityResult {
  const failed: string[] = [];
  for (const rule of [...rules].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
    const r = rule.evaluate(ctx);
    if (!r.passed) failed.push(r.reason || rule.name);
  }
  return { isEligible: failed.length === 0, failedReasons: failed };
}
