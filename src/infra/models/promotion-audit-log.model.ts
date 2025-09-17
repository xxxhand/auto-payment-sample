import { Schema, model, Document, Types } from 'mongoose';
import { PromotionAuditAction } from '../../domain/enums/promotion.enums';

export interface IPromotionAuditLogDocument extends Document {
  promotionId: Types.ObjectId;
  action: PromotionAuditAction;
  before?: any;
  after?: any;
  operator: { type: 'SYSTEM' | 'USER'; id?: string };
  createdAt: Date;
}

const PromotionAuditLogSchema = new Schema<IPromotionAuditLogDocument>(
  {
    promotionId: { type: Schema.Types.ObjectId, required: true, index: true },
    action: { type: String, enum: Object.values(PromotionAuditAction), required: true, index: true },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    operator: {
      type: new Schema(
        {
          type: { type: String, enum: ['SYSTEM', 'USER'], required: true },
          id: { type: String },
        },
        { _id: false },
      ),
      required: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'promotion_audit_logs' },
);

PromotionAuditLogSchema.index({ promotionId: 1, createdAt: -1 });
PromotionAuditLogSchema.index({ action: 1, createdAt: -1 });

export const PromotionAuditLogModel = model<IPromotionAuditLogDocument>('PromotionAuditLog', PromotionAuditLogSchema);
