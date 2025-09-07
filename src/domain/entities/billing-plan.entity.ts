import { BaseEntity } from './base-entity.abstract';
import { Money } from '../value-objects/money';
import { BillingCycleVO } from '../value-objects/billing-cycle';
import { PlanStatus, PlanType, BillingCycle } from '../enums/codes.const';

/**
 * 計費規則
 */
interface BillingRule {
  /** 規則 ID */
  ruleId: string;
  /** 規則名稱 */
  name: string;
  /** 規則類型 */
  type: 'QUANTITY' | 'USAGE' | 'TIERED' | 'VOLUME';
  /** 計費單位 */
  unit: string;
  /** 單價 */
  unitPrice: Money;
  /** 最小計費單位 */
  minimumUnits?: number;
  /** 免費額度 */
  includedUnits?: number;
  /** 階層定價配置 */
  tiers?: PricingTier[];
}

/**
 * 定價階層
 */
interface PricingTier {
  /** 階層下限 */
  upTo: number;
  /** 該階層單價 */
  unitPrice: Money;
  /** 該階層固定費用 */
  flatFee?: Money;
}

/**
 * 計劃功能限制
 */
interface PlanLimit {
  /** 功能名稱 */
  feature: string;
  /** 限制值 */
  limit: number;
  /** 計量單位 */
  unit: string;
  /** 是否為硬限制 */
  isHardLimit: boolean;
  /** 超限懲罰 */
  overagePenalty?: 'BLOCK' | 'CHARGE' | 'THROTTLE';
  /** 超限費用 */
  overageRate?: Money;
}

/**
 * 試用配置
 */
interface TrialConfiguration {
  /** 試用天數 */
  trialDays: number;
  /** 試用期間是否需要付款方式 */
  requiresPaymentMethod: boolean;
  /** 試用期功能限制 */
  trialLimits?: PlanLimit[];
  /** 自動轉換到付費計劃 */
  autoConvertToPaid: boolean;
}

/**
 * 計劃升級/降級規則
 */
interface PlanTransitionRule {
  /** 目標計劃 ID */
  targetPlanId: string;
  /** 轉換類型 */
  transitionType: 'UPGRADE' | 'DOWNGRADE' | 'CHANGE';
  /** 是否允許 */
  isAllowed: boolean;
  /** 是否立即生效 */
  immediateEffect: boolean;
  /** 按比例計費策略 */
  prorationStrategy: 'NONE' | 'CREATE_CREDIT' | 'CHARGE_DIFFERENCE';
  /** 轉換費用 */
  transitionFee?: Money;
}

/**
 * 計劃元資料
 */
interface PlanMetadata {
  /** 計劃顏色代碼 */
  colorCode?: string;
  /** 排序權重 */
  sortOrder: number;
  /** 是否為熱門計劃 */
  isPopular: boolean;
  /** 是否為推薦計劃 */
  isRecommended: boolean;
  /** 是否對新用戶隱藏 */
  hiddenFromNewUsers: boolean;
  /** 支援的地區 */
  supportedRegions: string[];
  /** 最小承諾期間（月） */
  minimumCommitmentMonths?: number;
  /** 取消政策 */
  cancellationPolicy: 'IMMEDIATE' | 'END_OF_PERIOD' | 'WITH_PENALTY';
}

/**
 * 計劃實體 - 計費計劃領域模型
 * 實現完整的計劃管理功能，包含複雜計費規則、限制管理、升降級控制
 */
export class BillingPlanEntity extends BaseEntity {
  /** 業務識別碼 (unique) */
  public planId: string = '';

  /** 所屬產品 ID */
  public productId: string = '';

  /** 計劃名稱 */
  public name: string = '';

  /** 計劃描述 */
  public description: string = '';

  /** 計劃狀態 */
  public status: PlanStatus = PlanStatus.DRAFT;

  /** 計劃類型 */
  public type: PlanType = PlanType.STANDARD;

  /** 基礎定價 */
  public basePrice: Money = new Money(0, 'TWD');

  /** 計費週期 */
  public billingCycle: BillingCycleVO = new BillingCycleVO(BillingCycle.MONTHLY);

  /** 計費規則清單 */
  public billingRules: BillingRule[] = [];

  /** 計劃限制清單 */
  public limits: PlanLimit[] = [];

  /** 試用配置 */
  public trialConfiguration?: TrialConfiguration;

  /** 計劃轉換規則 */
  public transitionRules: PlanTransitionRule[] = [];

  /** 計劃元資料 */
  public metadata: PlanMetadata = {
    sortOrder: 0,
    isPopular: false,
    isRecommended: false,
    hiddenFromNewUsers: false,
    supportedRegions: ['TW'],
    cancellationPolicy: 'END_OF_PERIOD',
  };

  /** 生效日期 */
  public effectiveDate?: Date;

  /** 失效日期 */
  public expirationDate?: Date;

  constructor(productId: string, name: string, basePrice: Money, billingCycle: BillingCycleVO) {
    super();
    this.productId = productId;
    this.name = name;
    this.basePrice = basePrice;
    this.billingCycle = billingCycle;
    this.planId = this.generatePlanId();
  }

  /**
   * 添加計費規則
   */
  public addBillingRule(rule: Omit<BillingRule, 'ruleId'>): void {
    const ruleId = this.generateRuleId(rule.name);
    const newRule: BillingRule = {
      ruleId,
      ...rule,
    };

    this.billingRules.push(newRule);
    this.touch();
  }

  /**
   * 更新計費規則
   */
  public updateBillingRule(ruleId: string, updates: Partial<BillingRule>): void {
    const ruleIndex = this.billingRules.findIndex((r) => r.ruleId === ruleId);
    if (ruleIndex === -1) {
      throw new Error(`Billing rule with ID ${ruleId} not found`);
    }

    this.billingRules[ruleIndex] = {
      ...this.billingRules[ruleIndex],
      ...updates,
    };

    this.touch();
  }

  /**
   * 移除計費規則
   */
  public removeBillingRule(ruleId: string): void {
    const ruleIndex = this.billingRules.findIndex((r) => r.ruleId === ruleId);
    if (ruleIndex === -1) {
      throw new Error(`Billing rule with ID ${ruleId} not found`);
    }

    this.billingRules.splice(ruleIndex, 1);
    this.touch();
  }

  /**
   * 添加計劃限制
   */
  public addLimit(limit: PlanLimit): void {
    // 檢查是否已存在相同功能的限制
    const existingLimit = this.limits.find((l) => l.feature === limit.feature);
    if (existingLimit) {
      throw new Error(`Limit for feature ${limit.feature} already exists`);
    }

    this.limits.push(limit);
    this.touch();
  }

  /**
   * 更新計劃限制
   */
  public updateLimit(feature: string, updates: Partial<PlanLimit>): void {
    const limitIndex = this.limits.findIndex((l) => l.feature === feature);
    if (limitIndex === -1) {
      throw new Error(`Limit for feature ${feature} not found`);
    }

    this.limits[limitIndex] = {
      ...this.limits[limitIndex],
      ...updates,
    };

    this.touch();
  }

  /**
   * 移除計劃限制
   */
  public removeLimit(feature: string): void {
    const limitIndex = this.limits.findIndex((l) => l.feature === feature);
    if (limitIndex === -1) {
      throw new Error(`Limit for feature ${feature} not found`);
    }

    this.limits.splice(limitIndex, 1);
    this.touch();
  }

  /**
   * 設定試用配置
   */
  public setTrialConfiguration(trialConfig: TrialConfiguration): void {
    this.trialConfiguration = trialConfig;
    this.touch();
  }

  /**
   * 移除試用配置
   */
  public removeTrialConfiguration(): void {
    this.trialConfiguration = undefined;
    this.touch();
  }

  /**
   * 添加計劃轉換規則
   */
  public addTransitionRule(rule: PlanTransitionRule): void {
    // 檢查是否已存在相同目標計劃的規則
    const existingRule = this.transitionRules.find((r) => r.targetPlanId === rule.targetPlanId);
    if (existingRule) {
      throw new Error(`Transition rule to plan ${rule.targetPlanId} already exists`);
    }

    this.transitionRules.push(rule);
    this.touch();
  }

  /**
   * 更新計劃轉換規則
   */
  public updateTransitionRule(targetPlanId: string, updates: Partial<PlanTransitionRule>): void {
    const ruleIndex = this.transitionRules.findIndex((r) => r.targetPlanId === targetPlanId);
    if (ruleIndex === -1) {
      throw new Error(`Transition rule to plan ${targetPlanId} not found`);
    }

    this.transitionRules[ruleIndex] = {
      ...this.transitionRules[ruleIndex],
      ...updates,
    };

    this.touch();
  }

  /**
   * 移除計劃轉換規則
   */
  public removeTransitionRule(targetPlanId: string): void {
    const ruleIndex = this.transitionRules.findIndex((r) => r.targetPlanId === targetPlanId);
    if (ruleIndex === -1) {
      throw new Error(`Transition rule to plan ${targetPlanId} not found`);
    }

    this.transitionRules.splice(ruleIndex, 1);
    this.touch();
  }

  /**
   * 發布計劃
   */
  public publish(effectiveDate?: Date): void {
    this.status = PlanStatus.ACTIVE;
    this.effectiveDate = effectiveDate || new Date();
    this.touch();
  }

  /**
   * 暫停計劃
   */
  public suspend(): void {
    this.status = PlanStatus.SUSPENDED;
    this.touch();
  }

  /**
   * 下架計劃
   */
  public retire(expirationDate?: Date): void {
    this.status = PlanStatus.RETIRED;
    this.expirationDate = expirationDate || new Date();
    this.touch();
  }

  /**
   * 恢復計劃
   */
  public resume(): void {
    if (this.status === PlanStatus.RETIRED) {
      throw new Error('Cannot resume a retired plan');
    }
    this.status = PlanStatus.ACTIVE;
    this.touch();
  }

  /**
   * 檢查計劃是否可用
   */
  public isAvailable(): boolean {
    const now = new Date();
    return this.status === PlanStatus.ACTIVE && (!this.effectiveDate || this.effectiveDate <= now) && (!this.expirationDate || this.expirationDate > now);
  }

  /**
   * 檢查是否支援試用
   */
  public supportsTrials(): boolean {
    return this.trialConfiguration !== undefined;
  }

  /**
   * 檢查是否允許轉換到指定計劃
   */
  public canTransitionTo(targetPlanId: string): boolean {
    const rule = this.transitionRules.find((r) => r.targetPlanId === targetPlanId);
    return rule ? rule.isAllowed : false;
  }

  /**
   * 獲取功能限制
   */
  public getLimit(feature: string): PlanLimit | undefined {
    return this.limits.find((l) => l.feature === feature);
  }

  /**
   * 計算使用量費用
   */
  public calculateUsageFee(usage: Record<string, number>): Money {
    let totalAmount = 0;
    const currency = this.basePrice.currency;

    for (const rule of this.billingRules) {
      const usageAmount = usage[rule.unit] || 0;
      const billableAmount = Math.max(0, usageAmount - (rule.includedUnits || 0));

      if (billableAmount > 0) {
        if (rule.type === 'TIERED' && rule.tiers) {
          // 階層計費
          let remainingUsage = billableAmount;
          for (const tier of rule.tiers) {
            const tierUsage = Math.min(remainingUsage, tier.upTo);
            totalAmount += tierUsage * tier.unitPrice.amount;
            remainingUsage -= tierUsage;
            if (remainingUsage <= 0) break;
          }
        } else {
          // 標準計費
          totalAmount += billableAmount * rule.unitPrice.amount;
        }
      }
    }

    return new Money(Math.round(totalAmount), currency);
  }

  /**
   * 獲取月度總費用估算
   */
  public getEstimatedMonthlyCost(estimatedUsage: Record<string, number> = {}): Money {
    const baseCost = this.basePrice;
    const usageCost = this.calculateUsageFee(estimatedUsage);
    return baseCost.add(usageCost);
  }

  /**
   * 更新計劃元資料
   */
  public updateMetadata(metadata: Partial<PlanMetadata>): void {
    this.metadata = { ...this.metadata, ...metadata };
    this.touch();
  }

  /**
   * 檢查是否為熱門計劃
   */
  public isPopular(): boolean {
    return this.metadata.isPopular;
  }

  /**
   * 檢查是否為推薦計劃
   */
  public isRecommended(): boolean {
    return this.metadata.isRecommended;
  }

  /**
   * 檢查是否對新用戶隱藏
   */
  public isHiddenFromNewUsers(): boolean {
    return this.metadata.hiddenFromNewUsers;
  }

  /**
   * 序列化為JSON
   */
  public toJSON(): any {
    return {
      id: this.id,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      planId: this.planId,
      productId: this.productId,
      name: this.name,
      description: this.description,
      status: this.status,
      type: this.type,
      basePrice: this.basePrice.toJSON(),
      billingCycle: this.billingCycle.toJSON(),
      billingRules: this.billingRules.map((rule) => ({
        ...rule,
        unitPrice: rule.unitPrice.toJSON(),
        tiers: rule.tiers?.map((tier) => ({
          ...tier,
          unitPrice: tier.unitPrice.toJSON(),
          flatFee: tier.flatFee?.toJSON(),
        })),
      })),
      limits: this.limits,
      trialConfiguration: this.trialConfiguration,
      transitionRules: this.transitionRules.map((rule) => ({
        ...rule,
        transitionFee: rule.transitionFee?.toJSON(),
      })),
      metadata: this.metadata,
      effectiveDate: this.effectiveDate?.toISOString(),
      expirationDate: this.expirationDate?.toISOString(),
    };
  }

  /**
   * 生成計劃ID
   */
  private generatePlanId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `plan_${timestamp}${random}`;
  }

  /**
   * 生成規則ID
   */
  private generateRuleId(ruleName: string): string {
    const normalized = ruleName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const timestamp = Date.now().toString(36).substring(-4);
    return `rule_${normalized}_${timestamp}`;
  }
}
