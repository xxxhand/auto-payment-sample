import { Schema, model, Document } from 'mongoose';
import { PlanStatus, PlanType, BillingCycle } from '../../domain/enums/codes.const';

/**
 * 計費規則
 */
interface IBillingRule {
  ruleId: string;
  name: string;
  type: 'QUANTITY' | 'USAGE' | 'TIERED' | 'VOLUME';
  unit: string;
  unitPrice: {
    amount: number;
    currency: string;
  };
  minimumUnits?: number;
  includedUnits?: number;
  tiers?: IPricingTier[];
}

/**
 * 定價階層
 */
interface IPricingTier {
  upTo: number;
  unitPrice: {
    amount: number;
    currency: string;
  };
  flatFee?: {
    amount: number;
    currency: string;
  };
}

/**
 * 計劃功能限制
 */
interface IPlanLimit {
  feature: string;
  limit: number;
  unit: string;
  isHardLimit: boolean;
  overagePenalty?: 'BLOCK' | 'CHARGE' | 'THROTTLE';
  overageRate?: {
    amount: number;
    currency: string;
  };
}

/**
 * 試用配置
 */
interface ITrialConfiguration {
  trialDays: number;
  requiresPaymentMethod: boolean;
  trialLimits?: IPlanLimit[];
  autoConvertToPaid: boolean;
}

/**
 * 計劃升級/降級規則
 */
interface IPlanTransitionRule {
  targetPlanId: string;
  transitionType: 'UPGRADE' | 'DOWNGRADE' | 'CHANGE';
  isAllowed: boolean;
  immediateEffect: boolean;
  prorationStrategy: 'NONE' | 'CREATE_CREDIT' | 'CHARGE_DIFFERENCE';
  transitionFee?: {
    amount: number;
    currency: string;
  };
}

/**
 * 計劃元資料
 */
interface IPlanMetadata {
  colorCode?: string;
  sortOrder: number;
  isPopular: boolean;
  isRecommended: boolean;
  hiddenFromNewUsers: boolean;
  supportedRegions: string[];
  minimumCommitmentMonths?: number;
  cancellationPolicy: 'IMMEDIATE' | 'END_OF_PERIOD' | 'WITH_PENALTY';
}

/**
 * 計劃文檔介面
 */
export interface IBillingPlanDocument extends Document {
  planId: string;
  productId: string;
  name: string;
  description: string;
  status: PlanStatus;
  type: PlanType;
  basePrice: {
    amount: number;
    currency: string;
  };
  billingCycle: {
    type: BillingCycle;
    intervalDays?: number;
    billingDay?: number;
  };
  billingRules: IBillingRule[];
  limits: IPlanLimit[];
  trialConfiguration?: ITrialConfiguration;
  transitionRules: IPlanTransitionRule[];
  metadata: IPlanMetadata;
  effectiveDate?: Date;
  expirationDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 定價階層模式
 */
const PricingTierSchema = new Schema({
  upTo: { type: Number, required: true },
  unitPrice: {
    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: 'TWD' },
  },
  flatFee: {
    amount: { type: Number },
    currency: { type: String, default: 'TWD' },
  },
});

/**
 * 計費規則模式
 */
const BillingRuleSchema = new Schema({
  ruleId: { type: String, required: true },
  name: { type: String, required: true },
  type: {
    type: String,
    enum: ['QUANTITY', 'USAGE', 'TIERED', 'VOLUME'],
    required: true,
  },
  unit: { type: String, required: true },
  unitPrice: {
    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: 'TWD' },
  },
  minimumUnits: { type: Number },
  includedUnits: { type: Number },
  tiers: [PricingTierSchema],
});

/**
 * 計劃功能限制模式
 */
const PlanLimitSchema = new Schema({
  feature: { type: String, required: true },
  limit: { type: Number, required: true },
  unit: { type: String, required: true },
  isHardLimit: { type: Boolean, default: true },
  overagePenalty: {
    type: String,
    enum: ['BLOCK', 'CHARGE', 'THROTTLE'],
  },
  overageRate: {
    amount: { type: Number },
    currency: { type: String, default: 'TWD' },
  },
});

/**
 * 試用配置模式
 */
const TrialConfigurationSchema = new Schema({
  trialDays: { type: Number, required: true },
  requiresPaymentMethod: { type: Boolean, default: true },
  trialLimits: [PlanLimitSchema],
  autoConvertToPaid: { type: Boolean, default: true },
});

/**
 * 計劃轉換規則模式
 */
const PlanTransitionRuleSchema = new Schema({
  targetPlanId: { type: String, required: true },
  transitionType: {
    type: String,
    enum: ['UPGRADE', 'DOWNGRADE', 'CHANGE'],
    required: true,
  },
  isAllowed: { type: Boolean, default: true },
  immediateEffect: { type: Boolean, default: false },
  prorationStrategy: {
    type: String,
    enum: ['NONE', 'CREATE_CREDIT', 'CHARGE_DIFFERENCE'],
    default: 'CREATE_CREDIT',
  },
  transitionFee: {
    amount: { type: Number },
    currency: { type: String, default: 'TWD' },
  },
});

/**
 * 計劃元資料模式
 */
const PlanMetadataSchema = new Schema({
  colorCode: { type: String },
  sortOrder: { type: Number, default: 0 },
  isPopular: { type: Boolean, default: false },
  isRecommended: { type: Boolean, default: false },
  hiddenFromNewUsers: { type: Boolean, default: false },
  supportedRegions: [{ type: String }],
  minimumCommitmentMonths: { type: Number },
  cancellationPolicy: {
    type: String,
    enum: ['IMMEDIATE', 'END_OF_PERIOD', 'WITH_PENALTY'],
    default: 'END_OF_PERIOD',
  },
});

/**
 * 計劃模式定義
 */
const BillingPlanSchema = new Schema(
  {
    planId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    productId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      index: true,
    },
    description: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(PlanStatus),
      default: PlanStatus.DRAFT,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(PlanType),
      default: PlanType.STANDARD,
      index: true,
    },
    basePrice: {
      amount: { type: Number, required: true, default: 0 },
      currency: { type: String, required: true, default: 'TWD' },
    },
    billingCycle: {
      type: {
        type: String,
        enum: Object.values(BillingCycle),
        required: true,
        default: BillingCycle.MONTHLY,
      },
      intervalDays: { type: Number },
      billingDay: { type: Number },
    },
    billingRules: [BillingRuleSchema],
    limits: [PlanLimitSchema],
    trialConfiguration: TrialConfigurationSchema,
    transitionRules: [PlanTransitionRuleSchema],
    metadata: PlanMetadataSchema,
    effectiveDate: { type: Date },
    expirationDate: { type: Date },
  },
  {
    timestamps: true,
    collection: 'billing_plans',
  },
);

// 複合索引
BillingPlanSchema.index({ productId: 1, status: 1 });
BillingPlanSchema.index({ status: 1, type: 1 });
BillingPlanSchema.index({ 'metadata.supportedRegions': 1, status: 1 });
BillingPlanSchema.index({ effectiveDate: 1, expirationDate: 1 });

export const BillingPlanModel = model<IBillingPlanDocument>('BillingPlan', BillingPlanSchema);
