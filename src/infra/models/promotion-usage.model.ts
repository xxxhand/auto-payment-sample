import { IBaseModel } from './base-model.interface';
import { ObjectId } from 'mongodb';

export interface IPromotionUsageModel extends IBaseModel {
  promotionId: ObjectId;
  customerId: ObjectId;
  timesUsed: number;
  cyclesGranted?: number;
  cyclesConsumed?: number;
  lastAppliedAt?: Date;
}
