import { Injectable } from '@nestjs/common';
import { Promotion, SubscriptionAppliedPromotion, ValidatePromotionResult } from '../value-objects/promotion.model';

export interface ValidateCodeRequest {
  promotionCode: string;
  productId: string;
  planId?: string;
  customerId: string;
  orderAmount?: number;
}

export interface ListAvailableRequest {
  productId: string;
  planId?: string;
  customerId: string;
  price?: number;
  includeIneligible?: boolean;
}

@Injectable()
export class PromotionEngine {
  // Phase 1: Skeleton only. Real repository/eligibility/calculation will be added in Phase 2.
  constructor() {}

  // Validate a promotion code against scope/period/eligibility/usage.
  async validateCode(_req: ValidateCodeRequest): Promise<ValidatePromotionResult> {
    void _req; // satisfy lint until implemented
    // TODO(Phase 2): implement using repository + eligibility rules
    return {
      isValid: false,
      reasons: ['NOT_IMPLEMENTED'],
    };
  }

  // List available promotions for a product/plan and customer, optionally including ineligible ones for transparency.
  async listAvailable(_req: ListAvailableRequest): Promise<{
    promotions: Array<ValidatePromotionResult & { raw?: Promotion }>;
  }> {
    void _req; // satisfy lint until implemented
    // TODO(Phase 2): query repository, map to ValidatePromotionResult, sort by priority then savings
    return { promotions: [] };
  }

  // Choose the best promotion based on priority -> estimated savings -> stable tie-breakers.
  selectBest(
    candidates: Array<ValidatePromotionResult & { raw?: Promotion; estimatedSavings?: number }>,
  ): (ValidatePromotionResult & { raw?: Promotion; estimatedSavings?: number }) | undefined {
    if (!candidates || candidates.length === 0) return undefined;
    const eligible = candidates.filter((c) => c.isValid);
    if (eligible.length === 0) return undefined;

    const sorted = [...eligible].sort((a, b) => {
      const ap = a.promotion?.priority ?? -1;
      const bp = b.promotion?.priority ?? -1;
      if (ap !== bp) return bp - ap; // priority desc
      const as = a['estimatedSavings'] ?? 0;
      const bs = b['estimatedSavings'] ?? 0;
      if (as !== bs) return bs - as; // savings desc
      const aid = a.promotion?.id ?? '';
      const bid = b.promotion?.id ?? '';
      return aid.localeCompare(bid); // stable tie-break
    });

    return sorted[0];
  }

  // Apply a selected promotion to a subscription and return the applied record (skeleton only)
  async applyToSubscription(params: {
    subscriptionId: string;
    selected: ValidatePromotionResult & { raw?: Promotion; estimatedSavings?: number };
    idempotencyKey?: string;
  }): Promise<SubscriptionAppliedPromotion> {
    // TODO(Phase 2): persist usage with transaction + idempotency
    const nowIso = new Date().toISOString();
    const currency = params.selected.discount?.currency ?? 'TWD';
    const discountAmount = 0; // Phase 1 placeholder
    const baseAmount = 0;
    return {
      promotionId: params.selected.promotion?.id ?? 'unknown',
      code: params.selected.promotion?.code,
      cyclesApplied: 0,
      cyclesRemaining: params.selected.discount?.maxCycles,
      appliedAt: nowIso,
      pricingSnapshot: {
        baseAmount,
        discountAmount,
        finalAmount: Math.max(0, baseAmount - discountAmount),
        currency,
      },
    };
  }
}
