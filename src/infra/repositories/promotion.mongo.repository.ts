import { Inject, Injectable } from '@nestjs/common';
import { ObjectId } from 'mongodb';
import { DEFAULT_MONGO } from '@myapp/common';
import { CustomMongoClient } from '@xxxhand/app-common';
import { IPromotionRepository, IListActiveInScopeParams } from '../../domain/interfaces/promotion.repository';
import { PromotionStatus, PromotionType, DiscountType } from '../../domain/enums/promotion.enums';
import { Promotion, SubscriptionAppliedPromotion } from '../../domain/value-objects/promotion.model';
import { modelNames, IPromotionDocument, IPromotionApplicationDocument } from '../models/models.definition';

@Injectable()
export class PromotionMongoRepository implements IPromotionRepository {
  constructor(@Inject(DEFAULT_MONGO) private readonly mongo: CustomMongoClient) {
    // fire-and-forget index creation
    const coll = this.mongo.getCollection(modelNames.PROMOTIONS);
    Promise.all([
      coll.createIndex({ code: 1 }, { unique: true, sparse: true }),
      coll.createIndex({ status: 1, 'period.startAt': 1, 'period.endAt': 1 }),
      coll.createIndex({ 'scope.productIds': 1 }),
      coll.createIndex({ 'scope.planIds': 1 }),
    ]).catch(() => {});

    const appColl = this.mongo.getCollection(modelNames.PROMOTION_APPLICATIONS);
    Promise.all([
      appColl.createIndex({ idempotencyKey: 1 }, { unique: true }),
      appColl.createIndex({ promotionId: 1 }),
      appColl.createIndex({ subscriptionId: 1, cycleNumber: 1 }),
    ]).catch(() => {});
  }

  private docToPromotion(doc: IPromotionDocument): Promotion {
    return {
      id: doc._id.toHexString(),
      name: doc.name,
      type: doc.type as PromotionType,
      priority: doc.priority,
      status: doc.status as PromotionStatus,
      code: doc.code ?? undefined,
      scope: doc.scope ? { ...doc.scope } : undefined,
      discount: {
        type: doc.discount.type as DiscountType,
        value: doc.discount.value,
        currency: doc.discount.currency,
        maxCycles: doc.discount.maxCycles,
        tiers: doc.discount.tiers?.map((t) => ({ threshold: t.threshold, value: t.value })),
        thresholdRules: doc.discount.thresholdRules?.map((r) => ({ min: r.min, bonusType: r.bonusType, value: r.value })),
      },
      period: { startAt: doc.period.startAt.toISOString(), endAt: doc.period.endAt.toISOString() },
      eligibility: doc.eligibility ? { ...doc.eligibility } : undefined,
      usage: doc.usageLimits ? { globalLimit: doc.usageLimits.globalLimit, perCustomerLimit: doc.usageLimits.perCustomerLimit } : undefined,
      usageCounters: {
        globalLimit: doc.usageLimits?.globalLimit,
        perCustomerLimit: doc.usageLimits?.perCustomerLimit,
        globalUsed: doc.usageCounters?.globalUsed ?? 0,
      },
      stacking: doc.stacking ? { ...doc.stacking } : undefined,
      metadata: doc.metadata,
    };
  }

  private promotionToPersist(p: Promotion) {
    return {
      code: p.code,
      name: p.name,
      type: p.type,
      priority: p.priority,
      status: p.status,
      scope: p.scope,
      discount: { ...p.discount },
      period: { startAt: new Date(p.period.startAt), endAt: new Date(p.period.endAt) },
      eligibility: p.eligibility,
      usageLimits: p.usage ? { globalLimit: p.usage.globalLimit, perCustomerLimit: p.usage.perCustomerLimit } : undefined,
      usageCounters: { globalUsed: p.usageCounters?.globalUsed ?? 0 },
      stacking: p.stacking,
      metadata: p.metadata,
      updatedAt: new Date(),
      createdAt: p['createdAt'] ? new Date((p as any).createdAt) : new Date(),
    };
  }

  async findByCode(code: string, at: Date): Promise<Promotion | null> {
    if (!code) return null;
    const coll = this.mongo.getCollection(modelNames.PROMOTIONS);
    const doc = (await coll.findOne({
      code,
      status: PromotionStatus.ACTIVE,
      'period.startAt': { $lte: at },
      'period.endAt': { $gte: at },
    })) as IPromotionDocument | null;
    return doc ? this.docToPromotion(doc) : null;
  }

  async listActiveInScope(params: IListActiveInScopeParams): Promise<Promotion[]> {
    const { productId, planId, at } = params;
    const coll = this.mongo.getCollection(modelNames.PROMOTIONS);
    const scopeFilters: any[] = [];
    if (productId) scopeFilters.push({ 'scope.productIds': productId });
    if (planId) scopeFilters.push({ 'scope.planIds': planId });

    const query: any = {
      status: PromotionStatus.ACTIVE,
      'period.startAt': { $lte: at },
      'period.endAt': { $gte: at },
    };
    if (scopeFilters.length > 0) {
      query.$or = scopeFilters;
    }

    const docs = (await coll.find(query).sort({ priority: -1 }).toArray()) as IPromotionDocument[];
    return docs.map((d) => this.docToPromotion(d));
  }

  async incrementGlobalUsage(promotionId: string): Promise<boolean> {
    const coll = this.mongo.getCollection(modelNames.PROMOTIONS);
    const filter: any = { _id: new ObjectId(promotionId) };
    // allow increment only if no global limit OR globalUsed < globalLimit
    filter.$or = [
      { 'usageLimits.globalLimit': { $exists: false } },
      { 'usageLimits.globalLimit': null },
      {
        $expr: {
          $lt: ['$usageCounters.globalUsed', '$usageLimits.globalLimit'],
        },
      },
    ];

    const res = await coll.findOneAndUpdate(filter, { $inc: { 'usageCounters.globalUsed': 1 } }, { returnDocument: 'after' });
    return !!res.value; // success if updated
  }

  async save(promotion: Promotion): Promise<Promotion> {
    const coll = this.mongo.getCollection(modelNames.PROMOTIONS);
    if (!promotion.id) {
      const doc = this.promotionToPersist(promotion);
      doc['createdAt'] = new Date();
      const result = await coll.insertOne(doc as any);
      promotion.id = result.insertedId.toHexString();
      return this.docToPromotion({ ...(doc as any), _id: result.insertedId });
    } else {
      const _id = new ObjectId(promotion.id);
      const doc = this.promotionToPersist(promotion);
      await coll.updateOne({ _id }, { $set: doc });
      const updated = (await coll.findOne({ _id })) as IPromotionDocument;
      return this.docToPromotion(updated);
    }
  }

  async changeStatus(promotionId: string, status: PromotionStatus): Promise<void> {
    const coll = this.mongo.getCollection(modelNames.PROMOTIONS);
    await coll.updateOne({ _id: new ObjectId(promotionId) }, { $set: { status } });
  }

  async recordApplication(application: SubscriptionAppliedPromotion): Promise<void> {
    // lightweight helper; full repository implemented separately
    const coll = this.mongo.getCollection(modelNames.PROMOTION_APPLICATIONS);
    const doc: Omit<IPromotionApplicationDocument, '_id'> = {
      promotionId: new ObjectId(application.promotionId),
      subscriptionId: application['subscriptionId'] ? new ObjectId((application as any).subscriptionId) : new ObjectId(),
      customerId: application['customerId'] ? new ObjectId((application as any).customerId) : new ObjectId(),
      code: application.code,
      appliedAt: new Date(application.appliedAt),
      cycleNumber: (application as any).cycleNumber ?? 0,
      pricingSnapshot: application.pricingSnapshot ? { ...application.pricingSnapshot } : undefined,
      discountType: application['discountType'],
      savings: (application as any).savings,
      idempotencyKey: (application as any).idempotencyKey || new ObjectId().toHexString(),
      freeCycleApplied: (application as any).freeCycleApplied,
      metadata: (application as any).metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
    await coll.insertOne(doc as any);
  }
}
