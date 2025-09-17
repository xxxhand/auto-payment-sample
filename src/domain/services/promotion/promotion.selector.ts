import { Promotion, ValidatePromotionResult } from '../../value-objects/promotion.model';

export type PromotionSelectCandidate = ValidatePromotionResult & { raw?: Promotion; estimatedSavings?: number };

export class PromotionSelector {
  static selectBest(candidates: PromotionSelectCandidate[]): PromotionSelectCandidate | undefined {
    if (!candidates || candidates.length === 0) return undefined;
    const eligible = candidates.filter((c) => c.isValid);
    if (eligible.length === 0) return undefined;
    const sorted = [...eligible].sort((a, b) => {
      const ap = a.promotion?.priority ?? -1;
      const bp = b.promotion?.priority ?? -1;
      if (ap !== bp) return bp - ap;
      const as = a.estimatedSavings ?? 0;
      const bs = b.estimatedSavings ?? 0;
      if (as !== bs) return bs - as;
      const aid = a.promotion?.id ?? '';
      const bid = b.promotion?.id ?? '';
      return aid.localeCompare(bid);
    });
    return sorted[0];
  }
}
