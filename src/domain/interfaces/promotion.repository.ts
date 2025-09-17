import { PromotionStatus } from '../enums/promotion.enums';
import { Promotion, SubscriptionAppliedPromotion } from '../value-objects/promotion.model';

export interface IListActiveInScopeParams {
  productId?: string;
  planId?: string;
  at: Date;
}

export interface IPromotionRepository {
  findByCode(code: string, at: Date): Promise<Promotion | null>;
  listActiveInScope(params: IListActiveInScopeParams): Promise<Promotion[]>;
  incrementGlobalUsage(promotionId: string, session?: unknown): Promise<boolean>; // true if incremented, false if limit hit
  save(promotion: Promotion, session?: unknown): Promise<Promotion>;
  changeStatus(promotionId: string, status: PromotionStatus, session?: unknown): Promise<void>;
  recordApplication?(application: SubscriptionAppliedPromotion, session?: unknown): Promise<void>; // optional direct write path
}

export const PromotionRepositoryProvider = 'PromotionRepositoryProvider';
