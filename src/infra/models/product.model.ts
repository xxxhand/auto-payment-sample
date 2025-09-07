import { Schema, model, Document } from 'mongoose';
import { ProductStatus, ProductType } from '../../domain/enums/codes.const';

/**
 * 產品功能特性
 */
interface IProductFeature {
  featureId: string;
  name: string;
  description: string;
  value: number | string | boolean;
  unit?: string;
  isCore: boolean;
}

/**
 * 產品定價層級
 */
interface IPricingTier {
  tierId: string;
  name: string;
  basePrice: {
    amount: number;
    currency: string;
  };
  billingCycle: {
    type: string;
    intervalDays?: number;
    billingDay?: number;
  };
  features: IProductFeature[];
  limits: Record<string, number>;
  isRecommended: boolean;
  sortOrder: number;
}

/**
 * 產品元資料
 */
interface IProductMetadata {
  category: string;
  tags: string[];
  supportedRegions: string[];
  supportedCurrencies: string[];
  minimumCommitmentMonths?: number;
  trialSupported: boolean;
  defaultTrialDays?: number;
}

/**
 * 產品文檔介面
 */
export interface IProductDocument extends Document {
  productId: string;
  name: string;
  description: string;
  status: ProductStatus;
  type: ProductType;
  pricingTiers: IPricingTier[];
  features: IProductFeature[];
  metadata: IProductMetadata;
  imageUrls: string[];
  documentationUrls: Record<string, string>;
  launchDate?: Date;
  retirementDate?: Date;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 產品功能特性模式
 */
const ProductFeatureSchema = new Schema({
  featureId: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  value: { type: Schema.Types.Mixed, required: true },
  unit: { type: String },
  isCore: { type: Boolean, default: false },
});

/**
 * 定價層級模式
 */
const PricingTierSchema = new Schema({
  tierId: { type: String, required: true },
  name: { type: String, required: true },
  basePrice: {
    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: 'TWD' },
  },
  billingCycle: {
    type: { type: String, required: true },
    intervalDays: { type: Number },
    billingDay: { type: Number },
  },
  features: [ProductFeatureSchema],
  limits: { type: Map, of: Number, default: new Map() },
  isRecommended: { type: Boolean, default: false },
  sortOrder: { type: Number, default: 0 },
});

/**
 * 產品元資料模式
 */
const ProductMetadataSchema = new Schema({
  category: { type: String, default: 'general' },
  tags: [{ type: String }],
  supportedRegions: [{ type: String }],
  supportedCurrencies: [{ type: String }],
  minimumCommitmentMonths: { type: Number },
  trialSupported: { type: Boolean, default: false },
  defaultTrialDays: { type: Number },
});

/**
 * 產品模式定義
 */
const ProductSchema = new Schema(
  {
    productId: {
      type: String,
      required: true,
      unique: true,
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
      enum: Object.values(ProductStatus),
      default: ProductStatus.DRAFT,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(ProductType),
      default: ProductType.SUBSCRIPTION,
      index: true,
    },
    pricingTiers: [PricingTierSchema],
    features: [ProductFeatureSchema],
    metadata: ProductMetadataSchema,
    imageUrls: [{ type: String }],
    documentationUrls: { type: Map, of: String, default: new Map() },
    launchDate: { type: Date },
    retirementDate: { type: Date },
    version: { type: String, default: '1.0.0' },
  },
  {
    timestamps: true,
    collection: 'products',
  },
);

// 複合索引
ProductSchema.index({ status: 1, type: 1 });
ProductSchema.index({ 'metadata.category': 1, status: 1 });
ProductSchema.index({ 'metadata.supportedRegions': 1, status: 1 });

export const ProductModel = model<IProductDocument>('Product', ProductSchema);
