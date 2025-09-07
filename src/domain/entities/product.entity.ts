import { BaseEntity } from './base-entity.abstract';
import { Money } from '../value-objects/money';
import { BillingCycleVO } from '../value-objects/billing-cycle';
import { ProductStatus, ProductType } from '../enums/codes.const';

/**
 * 產品功能特性
 */
interface ProductFeature {
  /** 功能 ID */
  featureId: string;
  /** 功能名稱 */
  name: string;
  /** 功能描述 */
  description: string;
  /** 功能值 (如 API 調用次數、存儲空間等) */
  value: number | string | boolean;
  /** 計量單位 */
  unit?: string;
  /** 是否為核心功能 */
  isCore: boolean;
}

/**
 * 產品定價層級
 */
interface PricingTier {
  /** 層級 ID */
  tierId: string;
  /** 層級名稱 */
  name: string;
  /** 基礎價格 */
  basePrice: Money;
  /** 計費週期 */
  billingCycle: BillingCycleVO;
  /** 層級功能清單 */
  features: ProductFeature[];
  /** 使用量限制 */
  limits: Record<string, number>;
  /** 是否為推薦方案 */
  isRecommended: boolean;
  /** 排序權重 */
  sortOrder: number;
}

/**
 * 產品元資料
 */
interface ProductMetadata {
  /** 分類標籤 */
  category: string;
  /** 產品標籤 */
  tags: string[];
  /** 支援的地區 */
  supportedRegions: string[];
  /** 支援的貨幣 */
  supportedCurrencies: string[];
  /** 最小訂閱期間 (月) */
  minimumCommitmentMonths?: number;
  /** 是否支援試用 */
  trialSupported: boolean;
  /** 預設試用天數 */
  defaultTrialDays?: number;
}

/**
 * 產品實體 - 完整領域模型
 * 實現完整的產品管理功能，包含多層級定價、功能管理、生命週期控制
 */
export class ProductEntity extends BaseEntity {
  /** 業務識別碼 (unique) */
  public productId: string = '';

  /** 產品名稱 */
  public name: string = '';

  /** 產品描述 */
  public description: string = '';

  /** 產品狀態 */
  public status: ProductStatus = ProductStatus.DRAFT;

  /** 產品類型 */
  public type: ProductType = ProductType.SUBSCRIPTION;

  /** 定價層級清單 */
  public pricingTiers: PricingTier[] = [];

  /** 產品功能清單 */
  public features: ProductFeature[] = [];

  /** 產品元資料 */
  public metadata: ProductMetadata = {
    category: 'general',
    tags: [],
    supportedRegions: ['TW'],
    supportedCurrencies: ['TWD'],
    trialSupported: false,
  };

  /** 產品圖片 URLs */
  public imageUrls: string[] = [];

  /** 產品文檔 URLs */
  public documentationUrls: Record<string, string> = {};

  /** 發布日期 */
  public launchDate?: Date;

  /** 下架日期 */
  public retirementDate?: Date;

  /** 產品版本 */
  public version: string = '1.0.0';

  constructor(name: string, description: string, type: ProductType = ProductType.SUBSCRIPTION) {
    super();
    this.name = name;
    this.description = description;
    this.type = type;
    this.productId = this.generateProductId();
  }

  /**
   * 添加定價層級
   */
  public addPricingTier(tier: Omit<PricingTier, 'tierId'>): void {
    const tierId = this.generateTierId(tier.name);
    const newTier: PricingTier = {
      tierId,
      ...tier,
    };

    this.pricingTiers.push(newTier);
    this.sortPricingTiers();
    this.touch();
  }

  /**
   * 更新定價層級
   */
  public updatePricingTier(tierId: string, updates: Partial<PricingTier>): void {
    const tierIndex = this.pricingTiers.findIndex((t) => t.tierId === tierId);
    if (tierIndex === -1) {
      throw new Error(`Pricing tier with ID ${tierId} not found`);
    }

    this.pricingTiers[tierIndex] = {
      ...this.pricingTiers[tierIndex],
      ...updates,
    };

    this.sortPricingTiers();
    this.touch();
  }

  /**
   * 移除定價層級
   */
  public removePricingTier(tierId: string): void {
    const tierIndex = this.pricingTiers.findIndex((t) => t.tierId === tierId);
    if (tierIndex === -1) {
      throw new Error(`Pricing tier with ID ${tierId} not found`);
    }

    this.pricingTiers.splice(tierIndex, 1);
    this.touch();
  }

  /**
   * 獲取定價層級
   */
  public getPricingTier(tierId: string): PricingTier | undefined {
    return this.pricingTiers.find((t) => t.tierId === tierId);
  }

  /**
   * 獲取推薦定價層級
   */
  public getRecommendedTier(): PricingTier | undefined {
    return this.pricingTiers.find((t) => t.isRecommended);
  }

  /**
   * 獲取最便宜的定價層級
   */
  public getCheapestTier(): PricingTier | undefined {
    return this.pricingTiers.filter((t) => t.basePrice.amount > 0).sort((a, b) => a.basePrice.amount - b.basePrice.amount)[0];
  }

  /**
   * 添加產品功能
   */
  public addFeature(feature: Omit<ProductFeature, 'featureId'>): void {
    const featureId = this.generateFeatureId(feature.name);
    const newFeature: ProductFeature = {
      featureId,
      ...feature,
    };

    this.features.push(newFeature);
    this.touch();
  }

  /**
   * 更新產品功能
   */
  public updateFeature(featureId: string, updates: Partial<ProductFeature>): void {
    const featureIndex = this.features.findIndex((f) => f.featureId === featureId);
    if (featureIndex === -1) {
      throw new Error(`Feature with ID ${featureId} not found`);
    }

    this.features[featureIndex] = {
      ...this.features[featureIndex],
      ...updates,
    };

    this.touch();
  }

  /**
   * 移除產品功能
   */
  public removeFeature(featureId: string): void {
    const featureIndex = this.features.findIndex((f) => f.featureId === featureId);
    if (featureIndex === -1) {
      throw new Error(`Feature with ID ${featureId} not found`);
    }

    this.features.splice(featureIndex, 1);
    this.touch();
  }

  /**
   * 發布產品
   */
  public publish(launchDate?: Date): void {
    if (this.pricingTiers.length === 0) {
      throw new Error('Cannot publish product without pricing tiers');
    }

    if (this.features.length === 0) {
      throw new Error('Cannot publish product without features');
    }

    this.status = ProductStatus.ACTIVE;
    this.launchDate = launchDate || new Date();
    this.touch();
  }

  /**
   * 下架產品
   */
  public retire(retirementDate?: Date): void {
    this.status = ProductStatus.RETIRED;
    this.retirementDate = retirementDate || new Date();
    this.touch();
  }

  /**
   * 暫停產品
   */
  public suspend(): void {
    this.status = ProductStatus.SUSPENDED;
    this.touch();
  }

  /**
   * 恢復產品
   */
  public resume(): void {
    this.status = ProductStatus.ACTIVE;
    this.touch();
  }

  /**
   * 檢查產品是否可用
   */
  public isAvailable(): boolean {
    return this.status === ProductStatus.ACTIVE && (!this.retirementDate || this.retirementDate > new Date());
  }

  /**
   * 檢查產品是否支援試用
   */
  public supportsTrials(): boolean {
    return this.metadata.trialSupported;
  }

  /**
   * 獲取預設試用天數
   */
  public getDefaultTrialDays(): number {
    return this.metadata.defaultTrialDays || 0;
  }

  /**
   * 檢查是否支援指定地區
   */
  public supportsRegion(region: string): boolean {
    return this.metadata.supportedRegions.includes(region);
  }

  /**
   * 檢查是否支援指定貨幣
   */
  public supportsCurrency(currency: string): boolean {
    return this.metadata.supportedCurrencies.includes(currency);
  }

  /**
   * 更新產品元資料
   */
  public updateMetadata(metadata: Partial<ProductMetadata>): void {
    this.metadata = { ...this.metadata, ...metadata };
    this.touch();
  }

  /**
   * 升級版本
   */
  public upgradeVersion(newVersion: string): void {
    this.version = newVersion;
    this.touch();
  }

  /**
   * 序列化為JSON
   */
  public toJSON(): any {
    return {
      id: this.id,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      productId: this.productId,
      name: this.name,
      description: this.description,
      status: this.status,
      type: this.type,
      pricingTiers: this.pricingTiers.map((tier) => ({
        ...tier,
        basePrice: tier.basePrice.toJSON(),
        billingCycle: tier.billingCycle.toJSON(),
      })),
      features: this.features,
      metadata: this.metadata,
      imageUrls: this.imageUrls,
      documentationUrls: this.documentationUrls,
      launchDate: this.launchDate?.toISOString(),
      retirementDate: this.retirementDate?.toISOString(),
      version: this.version,
    };
  }

  /**
   * 排序定價層級
   */
  private sortPricingTiers(): void {
    this.pricingTiers.sort((a, b) => {
      // 推薦方案排在前面
      if (a.isRecommended && !b.isRecommended) return -1;
      if (!a.isRecommended && b.isRecommended) return 1;

      // 按排序權重
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }

      // 按價格排序
      return a.basePrice.amount - b.basePrice.amount;
    });
  }

  /**
   * 生成產品ID
   */
  private generateProductId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `prod_${timestamp}${random}`;
  }

  /**
   * 生成層級ID
   */
  private generateTierId(tierName: string): string {
    const normalized = tierName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const timestamp = Date.now().toString(36).substring(-4);
    return `tier_${normalized}_${timestamp}`;
  }

  /**
   * 生成功能ID
   */
  private generateFeatureId(featureName: string): string {
    const normalized = featureName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const timestamp = Date.now().toString(36).substring(-4);
    return `feat_${normalized}_${timestamp}`;
  }
}
