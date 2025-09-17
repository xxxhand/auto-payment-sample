import { IBaseModel } from './base-model.interface';
import { PromotionType, DiscountType, PromotionStatus } from '../../domain/enums/promotion.enums';

/**
 * Promotion 基礎資料模型（僅定義結構，不含 Mongoose Schema）
 */
export interface IPromotionModel extends IBaseModel {
  code?: string | null;
  name: string;
  type: PromotionType;
  priority: number;
  status: PromotionStatus;
  scope?: { productIds?: string[]; planIds?: string[] };
  discount: {
    type: DiscountType;
    value?: number;
    currency?: string;
    maxCycles?: number;
    tiers?: { threshold: number; value: number }[];
    thresholdRules?: { min: number; bonusType: 'AMOUNT' | 'PERCENTAGE'; value: number }[];
  };
  period: { startAt: Date; endAt: Date };
  eligibility?: {
    newCustomerOnly?: boolean;
    minOrderAmount?: number; // 以最小幣值（分）
    regions?: string[];
    customerSegments?: string[];
  };
  usageLimits?: { globalLimit?: number; perCustomerLimit?: number };
  usageCounters?: { globalUsed: number };
  stacking?: { exclusive: boolean };
  metadata?: Record<string, any>;
}
