import { Injectable } from '@nestjs/common';
import { BillingPlanEntity } from '../../domain/entities/billing-plan.entity';
import { BillingPlanModel, IBillingPlanDocument } from '../models/billing-plan.model';
import { Money } from '../../domain/value-objects/money';
import { BillingCycleVO } from '../../domain/value-objects/billing-cycle';
import { PlanStatus, PlanType } from '../../domain/enums/codes.const';

@Injectable()
export class BillingPlanRepository {
  /**
   * 保存計劃實體
   */
  async save(entity: BillingPlanEntity): Promise<BillingPlanEntity> {
    if (!entity.id) {
      // 新建計劃
      const doc = {
        planId: entity.planId,
        productId: entity.productId,
        name: entity.name,
        description: entity.description,
        status: entity.status,
        type: entity.type,
        basePrice: {
          amount: entity.basePrice.amount,
          currency: entity.basePrice.currency,
        },
        billingCycle: {
          type: entity.billingCycle.type,
          intervalDays: entity.billingCycle.intervalDays,
          billingDay: entity.billingCycle.billingDay,
        },
        billingRules: entity.billingRules.map((rule) => ({
          ruleId: rule.ruleId,
          name: rule.name,
          type: rule.type,
          unit: rule.unit,
          unitPrice: {
            amount: rule.unitPrice.amount,
            currency: rule.unitPrice.currency,
          },
          minimumUnits: rule.minimumUnits,
          includedUnits: rule.includedUnits,
          tiers: rule.tiers?.map((tier) => ({
            upTo: tier.upTo,
            unitPrice: {
              amount: tier.unitPrice.amount,
              currency: tier.unitPrice.currency,
            },
            flatFee: tier.flatFee
              ? {
                  amount: tier.flatFee.amount,
                  currency: tier.flatFee.currency,
                }
              : undefined,
          })),
        })),
        limits: entity.limits,
        trialConfiguration: entity.trialConfiguration,
        transitionRules: entity.transitionRules.map((rule) => ({
          targetPlanId: rule.targetPlanId,
          transitionType: rule.transitionType,
          isAllowed: rule.isAllowed,
          immediateEffect: rule.immediateEffect,
          prorationStrategy: rule.prorationStrategy,
          transitionFee: rule.transitionFee
            ? {
                amount: rule.transitionFee.amount,
                currency: rule.transitionFee.currency,
              }
            : undefined,
        })),
        metadata: entity.metadata,
        effectiveDate: entity.effectiveDate,
        expirationDate: entity.expirationDate,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      };

      const result = await BillingPlanModel.create(doc);
      entity.id = result._id.toString();
      return entity;
    } else {
      // 更新現有計劃
      const updateDoc = {
        $set: {
          name: entity.name,
          description: entity.description,
          status: entity.status,
          type: entity.type,
          basePrice: {
            amount: entity.basePrice.amount,
            currency: entity.basePrice.currency,
          },
          billingCycle: {
            type: entity.billingCycle.type,
            intervalDays: entity.billingCycle.intervalDays,
            billingDay: entity.billingCycle.billingDay,
          },
          billingRules: entity.billingRules.map((rule) => ({
            ruleId: rule.ruleId,
            name: rule.name,
            type: rule.type,
            unit: rule.unit,
            unitPrice: {
              amount: rule.unitPrice.amount,
              currency: rule.unitPrice.currency,
            },
            minimumUnits: rule.minimumUnits,
            includedUnits: rule.includedUnits,
            tiers: rule.tiers?.map((tier) => ({
              upTo: tier.upTo,
              unitPrice: {
                amount: tier.unitPrice.amount,
                currency: tier.unitPrice.currency,
              },
              flatFee: tier.flatFee
                ? {
                    amount: tier.flatFee.amount,
                    currency: tier.flatFee.currency,
                  }
                : undefined,
            })),
          })),
          limits: entity.limits,
          trialConfiguration: entity.trialConfiguration,
          transitionRules: entity.transitionRules.map((rule) => ({
            targetPlanId: rule.targetPlanId,
            transitionType: rule.transitionType,
            isAllowed: rule.isAllowed,
            immediateEffect: rule.immediateEffect,
            prorationStrategy: rule.prorationStrategy,
            transitionFee: rule.transitionFee
              ? {
                  amount: rule.transitionFee.amount,
                  currency: rule.transitionFee.currency,
                }
              : undefined,
          })),
          metadata: entity.metadata,
          effectiveDate: entity.effectiveDate,
          expirationDate: entity.expirationDate,
          updatedAt: entity.updatedAt,
        },
      };

      await BillingPlanModel.updateOne({ _id: entity.id }, updateDoc);
      return entity;
    }
  }

  /**
   * 根據 ID 查找計劃
   */
  async findById(id: string): Promise<BillingPlanEntity | null> {
    const doc = await BillingPlanModel.findById(id);
    return doc ? this.mapToEntity(doc) : null;
  }

  /**
   * 根據計劃 ID 查找計劃
   */
  async findByPlanId(planId: string): Promise<BillingPlanEntity | null> {
    const doc = await BillingPlanModel.findOne({ planId });
    return doc ? this.mapToEntity(doc) : null;
  }

  /**
   * 根據產品 ID 查找所有計劃
   */
  async findByProductId(productId: string): Promise<BillingPlanEntity[]> {
    const docs = await BillingPlanModel.find({ productId });
    return docs.map((doc) => this.mapToEntity(doc));
  }

  /**
   * 查找所有活躍計劃
   */
  async findActivePlans(): Promise<BillingPlanEntity[]> {
    const now = new Date();
    const docs = await BillingPlanModel.find({
      status: PlanStatus.ACTIVE,
      $or: [{ effectiveDate: { $exists: false } }, { effectiveDate: { $lte: now } }],
      $and: [
        {
          $or: [{ expirationDate: { $exists: false } }, { expirationDate: { $gt: now } }],
        },
      ],
    });

    return docs.map((doc) => this.mapToEntity(doc));
  }

  /**
   * 根據產品ID查找活躍計劃
   */
  async findActivePlansByProductId(productId: string): Promise<BillingPlanEntity[]> {
    const now = new Date();
    const docs = await BillingPlanModel.find({
      productId,
      status: PlanStatus.ACTIVE,
      $or: [{ effectiveDate: { $exists: false } }, { effectiveDate: { $lte: now } }],
      $and: [
        {
          $or: [{ expirationDate: { $exists: false } }, { expirationDate: { $gt: now } }],
        },
      ],
    }).sort({ 'metadata.sortOrder': 1, 'basePrice.amount': 1 });

    return docs.map((doc) => this.mapToEntity(doc));
  }

  /**
   * 查找推薦計劃
   */
  async findRecommendedPlans(): Promise<BillingPlanEntity[]> {
    const docs = await BillingPlanModel.find({
      status: PlanStatus.ACTIVE,
      'metadata.isRecommended': true,
    }).sort({ 'metadata.sortOrder': 1 });

    return docs.map((doc) => this.mapToEntity(doc));
  }

  /**
   * 刪除計劃
   */
  async delete(id: string): Promise<void> {
    await BillingPlanModel.deleteOne({ _id: id });
  }

  /**
   * 將文檔對象映射為實體
   */
  private mapToEntity(doc: IBillingPlanDocument): BillingPlanEntity {
    const basePrice = new Money(doc.basePrice.amount, doc.basePrice.currency);
    const billingCycle = new BillingCycleVO(doc.billingCycle.type, doc.billingCycle.intervalDays, doc.billingCycle.billingDay);

    const entity = new BillingPlanEntity(doc.productId, doc.name, basePrice, billingCycle);

    entity.id = doc._id.toString();
    entity.planId = doc.planId;
    entity.description = doc.description;
    entity.status = doc.status;
    entity.type = doc.type;
    entity.createdAt = doc.createdAt;
    entity.updatedAt = doc.updatedAt;
    entity.effectiveDate = doc.effectiveDate;
    entity.expirationDate = doc.expirationDate;
    entity.metadata = doc.metadata;

    // 映射計費規則
    entity.billingRules = doc.billingRules.map((rule) => ({
      ruleId: rule.ruleId,
      name: rule.name,
      type: rule.type,
      unit: rule.unit,
      unitPrice: new Money(rule.unitPrice.amount, rule.unitPrice.currency),
      minimumUnits: rule.minimumUnits,
      includedUnits: rule.includedUnits,
      tiers: rule.tiers?.map((tier) => ({
        upTo: tier.upTo,
        unitPrice: new Money(tier.unitPrice.amount, tier.unitPrice.currency),
        flatFee: tier.flatFee ? new Money(tier.flatFee.amount, tier.flatFee.currency) : undefined,
      })),
    }));

    // 映射限制
    entity.limits = doc.limits.map((limit) => ({
      feature: limit.feature,
      limit: limit.limit,
      unit: limit.unit,
      isHardLimit: limit.isHardLimit,
      overagePenalty: limit.overagePenalty,
      overageRate: limit.overageRate ? new Money(limit.overageRate.amount, limit.overageRate.currency) : undefined,
    }));

    // 映射試用配置
    if (doc.trialConfiguration) {
      entity.trialConfiguration = {
        trialDays: doc.trialConfiguration.trialDays,
        requiresPaymentMethod: doc.trialConfiguration.requiresPaymentMethod,
        autoConvertToPaid: doc.trialConfiguration.autoConvertToPaid,
        trialLimits: doc.trialConfiguration.trialLimits?.map((limit) => ({
          feature: limit.feature,
          limit: limit.limit,
          unit: limit.unit,
          isHardLimit: limit.isHardLimit,
          overagePenalty: limit.overagePenalty,
          overageRate: limit.overageRate ? new Money(limit.overageRate.amount, limit.overageRate.currency) : undefined,
        })),
      };
    }

    // 映射轉換規則
    entity.transitionRules = doc.transitionRules.map((rule) => ({
      targetPlanId: rule.targetPlanId,
      transitionType: rule.transitionType,
      isAllowed: rule.isAllowed,
      immediateEffect: rule.immediateEffect,
      prorationStrategy: rule.prorationStrategy,
      transitionFee: rule.transitionFee ? new Money(rule.transitionFee.amount, rule.transitionFee.currency) : undefined,
    }));

    return entity;
  }
}
