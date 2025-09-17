import { IBaseModel } from './base-model.interface';
import { ObjectId } from 'mongodb';

export interface IPromotionApplicationModel extends IBaseModel {
  promotionId: ObjectId;
  subscriptionId: ObjectId;
  customerId: ObjectId;
  code?: string | null;
  appliedAt: Date;
  cycleNumber: number;
  pricingSnapshot: { baseAmount: number; discountAmount: number; finalAmount: number; currency: string };
  discountType: string; // keep string to decouple from enums evolution
  savings: number;
  freeCycleApplied?: boolean;
  idempotencyKey: string;
  metadata?: Record<string, any>;
}
