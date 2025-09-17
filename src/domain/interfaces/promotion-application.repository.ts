import { SubscriptionAppliedPromotion } from '../value-objects/promotion.model';

export const PromotionApplicationRepositoryProvider = 'PromotionApplicationRepositoryProvider';

export interface PromotionApplicationRecord extends SubscriptionAppliedPromotion {
  id?: string;
  customerId: string;
  subscriptionId: string;
  cycleNumber: number;
  discountType?: string;
  savings?: number;
  idempotencyKey: string;
  createdAt?: Date;
}

export interface PromotionApplicationRepository {
  findByIdempotencyKey(key: string): Promise<PromotionApplicationRecord | null>;
  record(record: PromotionApplicationRecord, session?: unknown): Promise<PromotionApplicationRecord>;
  listByPromotion(promotionId: string, limit?: number): Promise<PromotionApplicationRecord[]>;
  listBySubscriptionCycle(subscriptionId: string, cycleNumber: number): Promise<PromotionApplicationRecord[]>;
}
