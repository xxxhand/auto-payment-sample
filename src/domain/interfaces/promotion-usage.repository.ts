import { Promotion } from '../value-objects/promotion.model';

export const PromotionUsageRepositoryProvider = 'PromotionUsageRepositoryProvider';

export interface PromotionUsageRecord {
  promotionId: string;
  customerId: string;
  timesUsed: number;
  cyclesGranted?: number;
  cyclesConsumed?: number;
  lastAppliedAt?: Date;
}

export interface IncrementUsageParams {
  promotion: Promotion;
  customerId: string;
  perCustomerLimit?: number; // convenience override
  session?: unknown;
}

export interface PromotionUsageRepository {
  get(promotionId: string, customerId: string): Promise<PromotionUsageRecord | null>;
  increment(params: IncrementUsageParams): Promise<{ success: boolean; record?: PromotionUsageRecord; reason?: string }>; // reason example: PER_CUSTOMER_LIMIT_REACHED
  consumeCycle?(promotionId: string, customerId: string, session?: unknown): Promise<void>; // for free cycles consumption tracking
}
