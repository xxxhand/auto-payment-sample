import { Injectable } from '@nestjs/common';

export interface Promotion {
  code: string;
  name: string;
  description: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_TRIAL';
  discount: {
    type: 'PERCENTAGE' | 'FIXED_AMOUNT';
    value: number;
    applicablePeriod: 'FIRST_BILLING' | 'RECURRING' | 'ONE_TIME';
  };
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
  validFrom: string;
  validUntil: string;
  usageLimit?: number;
  currentUsage: number;
  conditions?: {
    minimumAmount?: number;
    applicableProducts?: string[];
    customerSegments?: string[];
    firstTimeCustomersOnly?: boolean;
    maxUsagePerCustomer?: number;
    eligibleTiers?: string[];
    stackable?: boolean;
  };
  metadata?: {
    campaign?: string;
    source?: string;
    priority?: number;
    autoApply?: boolean;
    tags?: string[];
  };
  performance?: {
    conversionRate?: number;
    totalRevenueLoss?: number;
    averageOrderValue?: number;
    customerRetention?: number;
  };
}

export interface PromotionAnalytics {
  totalPromotions: number;
  activePromotions: number;
  expiredPromotions: number;
  totalUsage: number;
  conversionMetrics: {
    averageConversionRate: number;
    bestPerformingPromotion: string;
    worstPerformingPromotion: string;
  };
  revenueImpact: {
    totalDiscountGiven: number;
    estimatedRevenueGained: number;
    netRevenueImpact: number;
  };
}

export interface PromotionCampaign {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  promotionCodes: string[];
  targetAudience: {
    customerSegments: string[];
    productCategories: string[];
    geographicRegions?: string[];
  };
  goals: {
    targetUsage: number;
    expectedRevenue: number;
    customerAcquisitionGoal: number;
  };
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';
}

/**
 * 優惠管理服務
 * 負責優惠碼驗證、資格檢查和折扣計算
 * Phase 4.2: 增強業務邏輯和分析功能
 */
@Injectable()
export class PromotionService {
  private readonly promotions: Promotion[] = [
    {
      code: 'SUMMER2024',
      name: 'Summer Special 2024',
      description: '夏季特惠：首月享8折優惠',
      type: 'PERCENTAGE',
      discount: {
        type: 'PERCENTAGE',
        value: 20,
        applicablePeriod: 'FIRST_BILLING',
      },
      status: 'ACTIVE',
      validFrom: '2024-06-01T00:00:00Z',
      validUntil: '2024-08-31T23:59:59Z',
      usageLimit: 1000,
      currentUsage: 234,
      conditions: {
        minimumAmount: 500,
        maxUsagePerCustomer: 1,
        stackable: false,
      },
      metadata: {
        campaign: 'summer-campaign',
        source: 'email',
        priority: 1,
        autoApply: false,
        tags: ['seasonal', 'email-marketing'],
      },
      performance: {
        conversionRate: 0.25,
        totalRevenueLoss: 15000,
        averageOrderValue: 850,
        customerRetention: 0.68,
      },
    },
    {
      code: 'WELCOME100',
      name: 'New Customer Welcome',
      description: '新客戶專享：立即折扣100元',
      type: 'FIXED_AMOUNT',
      discount: {
        type: 'FIXED_AMOUNT',
        value: 100,
        applicablePeriod: 'FIRST_BILLING',
      },
      status: 'ACTIVE',
      validFrom: '2024-01-01T00:00:00Z',
      validUntil: new Date(Date.now() + 60 * 60 * 24 * 10 * 1000).toISOString(), // 10天後過期
      usageLimit: 5000,
      currentUsage: 1456,
      conditions: {
        firstTimeCustomersOnly: true,
        maxUsagePerCustomer: 1,
        stackable: true,
      },
      metadata: {
        campaign: 'new-customer-acquisition',
        source: 'website',
        priority: 2,
        autoApply: true,
        tags: ['welcome', 'acquisition'],
      },
      performance: {
        conversionRate: 0.42,
        totalRevenueLoss: 145600,
        averageOrderValue: 750,
        customerRetention: 0.72,
      },
    },
    {
      code: 'PREMIUM_ONLY',
      name: 'Premium Plan Discount',
      description: 'Premium方案專屬優惠',
      type: 'PERCENTAGE',
      discount: {
        type: 'PERCENTAGE',
        value: 15,
        applicablePeriod: 'FIRST_BILLING',
      },
      status: 'ACTIVE',
      validFrom: '2024-01-01T00:00:00Z',
      validUntil: '2024-12-31T23:59:59Z',
      usageLimit: 500,
      currentUsage: 123,
      conditions: {
        applicableProducts: ['prod_premium_monthly', 'prod_premium_yearly'],
        eligibleTiers: ['premium'],
        stackable: false,
      },
      metadata: {
        campaign: 'premium-upsell',
        source: 'in-app',
        priority: 3,
        autoApply: false,
        tags: ['premium', 'upsell'],
      },
      performance: {
        conversionRate: 0.18,
        totalRevenueLoss: 18450,
        averageOrderValue: 1200,
        customerRetention: 0.85,
      },
    },
    {
      code: 'NEW_CUSTOMER_ONLY',
      name: 'First Time Customer Special',
      description: '首次訂閱專屬優惠',
      type: 'PERCENTAGE',
      discount: {
        type: 'PERCENTAGE',
        value: 30,
        applicablePeriod: 'FIRST_BILLING',
      },
      status: 'ACTIVE',
      validFrom: '2024-01-01T00:00:00Z',
      validUntil: '2024-12-31T23:59:59Z',
      usageLimit: 1000,
      currentUsage: 567,
      conditions: {
        firstTimeCustomersOnly: true,
        minimumAmount: 1000,
        maxUsagePerCustomer: 1,
        stackable: false,
      },
      metadata: {
        campaign: 'first-time-special',
        source: 'social-media',
        priority: 1,
        autoApply: false,
        tags: ['first-time', 'social'],
      },
      performance: {
        conversionRate: 0.35,
        totalRevenueLoss: 85000,
        averageOrderValue: 1500,
        customerRetention: 0.78,
      },
    },
    {
      code: 'EXPIRED2023',
      name: 'Expired Promotion',
      description: '已過期的優惠碼',
      type: 'PERCENTAGE',
      discount: {
        type: 'PERCENTAGE',
        value: 25,
        applicablePeriod: 'FIRST_BILLING',
      },
      status: 'EXPIRED',
      validFrom: '2023-01-01T00:00:00Z',
      validUntil: '2023-12-31T23:59:59Z',
      usageLimit: 1000,
      currentUsage: 1000,
      conditions: {
        stackable: false,
      },
      metadata: {
        campaign: 'year-end-2023',
        source: 'email',
        priority: 2,
        tags: ['expired', 'year-end'],
      },
      performance: {
        conversionRate: 0.22,
        totalRevenueLoss: 62500,
        averageOrderValue: 900,
        customerRetention: 0.65,
      },
    },
  ];

  /**
   * 驗證優惠碼 - Enhanced with better business logic
   */
  public async validatePromotion(request: { code: string; productId: string; customerId: string; orderAmount?: number }): Promise<{
    valid: boolean;
    promotion?: Promotion;
    discount?: {
      type: string;
      value: number;
      calculatedAmount?: number;
      applicablePeriod: string;
    };
    eligibility: {
      eligible: boolean;
      reasons: string[];
    };
  }> {
    const promotion = this.promotions.find((p) => p.code === request.code);

    if (!promotion) {
      throw new Error('Promotion code not found');
    }

    const eligibility = await this.checkEligibility(promotion, request);

    if (!eligibility.eligible) {
      return {
        valid: false,
        promotion,
        eligibility,
      };
    }

    // 計算折扣金額
    let calculatedAmount = 0;
    if (request.orderAmount && promotion.discount.type === 'PERCENTAGE') {
      calculatedAmount = Math.round((request.orderAmount * promotion.discount.value) / 100);
    } else if (promotion.discount.type === 'FIXED_AMOUNT') {
      calculatedAmount = promotion.discount.value;
    }

    return {
      valid: true,
      promotion,
      discount: {
        type: promotion.discount.type,
        value: promotion.discount.value,
        calculatedAmount,
        applicablePeriod: promotion.discount.applicablePeriod,
      },
      eligibility,
    };
  }

  /**
   * 取得可用優惠
   */
  public async getAvailablePromotions(request: { productId?: string; customerId?: string; type?: string }): Promise<{ promotions: Promotion[] }> {
    if (!request.productId) {
      throw new Error('productId is required');
    }

    let filteredPromotions = this.promotions.filter((promotion) => promotion.status === 'ACTIVE');

    // 按產品篩選
    if (request.productId) {
      filteredPromotions = filteredPromotions.filter((promotion) => {
        if (!promotion.conditions?.applicableProducts) {
          return true; // 沒有產品限制的優惠對所有產品有效
        }
        return promotion.conditions.applicableProducts.includes(request.productId!);
      });
    }

    // 按類型篩選
    if (request.type) {
      filteredPromotions = filteredPromotions.filter((promotion) => promotion.type === request.type);
    }

    // 為每個優惠添加剩餘使用次數
    const promotionsWithUsage = filteredPromotions.map((promotion) => ({
      ...promotion,
      remainingUsage: promotion.usageLimit ? promotion.usageLimit - promotion.currentUsage : null,
    }));

    return { promotions: promotionsWithUsage };
  }

  /**
   * 檢查優惠資格
   */
  private async checkEligibility(
    promotion: Promotion,
    request: { productId: string; customerId: string; orderAmount?: number },
  ): Promise<{ eligible: boolean; reasons: string[] }> {
    const reasons: string[] = [];

    // 檢查狀態
    if (promotion.status !== 'ACTIVE') {
      reasons.push('Promotion is not active');
    }

    // 檢查有效期
    const now = new Date();
    const validFrom = new Date(promotion.validFrom);
    const validUntil = new Date(promotion.validUntil);

    if (now < validFrom || now > validUntil) {
      reasons.push('Promotion code has expired');
    }

    // 檢查使用次數限制
    if (promotion.usageLimit && promotion.currentUsage >= promotion.usageLimit) {
      reasons.push('Promotion usage limit reached');
    }

    // 檢查條件
    if (promotion.conditions) {
      // 最低金額檢查
      if (promotion.conditions.minimumAmount && request.orderAmount && request.orderAmount < promotion.conditions.minimumAmount) {
        reasons.push(`Minimum order amount is ${promotion.conditions.minimumAmount}`);
      }

      // 產品限制檢查
      if (promotion.conditions.applicableProducts && !promotion.conditions.applicableProducts.includes(request.productId)) {
        reasons.push('Product not eligible for this promotion');
      }

      // 新客戶專屬檢查
      if (promotion.conditions.firstTimeCustomersOnly) {
        const isFirstTimeCustomer = await this.isFirstTimeCustomer(request.customerId);
        if (!isFirstTimeCustomer) {
          reasons.push('Customer not eligible for this promotion');
        }
      }
    }

    return {
      eligible: reasons.length === 0,
      reasons,
    };
  }

  /**
   * 檢查是否為新客戶
   */
  private async isFirstTimeCustomer(customerId: string): Promise<boolean> {
    // 模擬檢查邏輯 - 實際實作會查詢資料庫
    const existingCustomers = ['cust_existing_customer', 'cust_repeat_customer'];
    return !existingCustomers.includes(customerId);
  }

  /**
   * 計算折扣金額
   */
  public async calculateDiscount(promotionCode: string, originalAmount: number): Promise<{ discountAmount: number; finalAmount: number }> {
    const promotion = this.promotions.find((p) => p.code === promotionCode);
    if (!promotion || promotion.status !== 'ACTIVE') {
      return { discountAmount: 0, finalAmount: originalAmount };
    }

    let discountAmount = 0;
    if (promotion.discount.type === 'PERCENTAGE') {
      discountAmount = Math.round((originalAmount * promotion.discount.value) / 100);
    } else if (promotion.discount.type === 'FIXED_AMOUNT') {
      discountAmount = Math.min(promotion.discount.value, originalAmount);
    }

    return {
      discountAmount,
      finalAmount: originalAmount - discountAmount,
    };
  }

  /**
   * 標記優惠碼已使用
   */
  public async markPromotionAsUsed(promotionCode: string): Promise<void> {
    const promotion = this.promotions.find((p) => p.code === promotionCode);
    if (promotion) {
      promotion.currentUsage += 1;
    }
  }

  /**
   * 獲取優惠分析數據 - New Enhanced Method
   */
  public async getPromotionAnalytics(): Promise<PromotionAnalytics> {
    const totalPromotions = this.promotions.length;
    const activePromotions = this.promotions.filter((p) => p.status === 'ACTIVE').length;
    const expiredPromotions = this.promotions.filter((p) => p.status === 'EXPIRED').length;
    const totalUsage = this.promotions.reduce((sum, p) => sum + p.currentUsage, 0);

    // Calculate conversion metrics
    const promotionsWithPerformance = this.promotions.filter((p) => p.performance?.conversionRate);
    const averageConversionRate =
      promotionsWithPerformance.length > 0 ? promotionsWithPerformance.reduce((sum, p) => sum + (p.performance?.conversionRate || 0), 0) / promotionsWithPerformance.length : 0;

    const bestPerforming = promotionsWithPerformance.reduce(
      (best, current) => ((current.performance?.conversionRate || 0) > (best.performance?.conversionRate || 0) ? current : best),
      promotionsWithPerformance[0],
    );

    const worstPerforming = promotionsWithPerformance.reduce(
      (worst, current) => ((current.performance?.conversionRate || 0) < (worst.performance?.conversionRate || 0) ? current : worst),
      promotionsWithPerformance[0],
    );

    // Calculate revenue impact
    const totalDiscountGiven = this.promotions.reduce((sum, p) => sum + (p.performance?.totalRevenueLoss || 0), 0);
    const estimatedRevenueGained = this.promotions.reduce((sum, p) => {
      const avgOrderValue = p.performance?.averageOrderValue || 0;
      const conversionRate = p.performance?.conversionRate || 0;
      const usage = p.currentUsage;
      return sum + avgOrderValue * conversionRate * usage;
    }, 0);

    return {
      totalPromotions,
      activePromotions,
      expiredPromotions,
      totalUsage,
      conversionMetrics: {
        averageConversionRate,
        bestPerformingPromotion: bestPerforming?.code || 'N/A',
        worstPerformingPromotion: worstPerforming?.code || 'N/A',
      },
      revenueImpact: {
        totalDiscountGiven,
        estimatedRevenueGained,
        netRevenueImpact: estimatedRevenueGained - totalDiscountGiven,
      },
    };
  }

  /**
   * 自動應用最佳優惠 - New Enhanced Method
   */
  public async autoApplyBestPromotion(request: { productId: string; customerId: string; orderAmount: number }): Promise<{
    appliedPromotion?: Promotion;
    discountAmount: number;
    finalAmount: number;
    savings: number;
  }> {
    const availablePromotions = await this.getAvailablePromotions({
      productId: request.productId,
      customerId: request.customerId,
    });

    const autoApplyPromotions = availablePromotions.promotions.filter((p) => p.metadata?.autoApply);

    let bestPromotion: Promotion | undefined;
    let bestDiscount = 0;

    for (const promotion of autoApplyPromotions) {
      const validation = await this.validatePromotion({
        code: promotion.code,
        productId: request.productId,
        customerId: request.customerId,
        orderAmount: request.orderAmount,
      });

      if (validation.valid && validation.discount?.calculatedAmount) {
        if (validation.discount.calculatedAmount > bestDiscount) {
          bestDiscount = validation.discount.calculatedAmount;
          bestPromotion = promotion;
        }
      }
    }

    const discountAmount = bestDiscount;
    const finalAmount = request.orderAmount - discountAmount;
    const savings = discountAmount;

    return {
      appliedPromotion: bestPromotion,
      discountAmount,
      finalAmount,
      savings,
    };
  }

  /**
   * 優惠堆疊驗證 - New Enhanced Method
   */
  public async validatePromotionStacking(
    promotionCodes: string[],
    request: {
      productId: string;
      customerId: string;
      orderAmount: number;
    },
  ): Promise<{
    valid: boolean;
    stackablePromotions: Promotion[];
    totalDiscount: number;
    finalAmount: number;
    conflicts: string[];
  }> {
    const stackablePromotions: Promotion[] = [];
    const conflicts: string[] = [];
    let totalDiscount = 0;

    for (const code of promotionCodes) {
      const promotion = this.promotions.find((p) => p.code === code);

      if (!promotion) {
        conflicts.push(`Promotion code ${code} not found`);
        continue;
      }

      if (!promotion.conditions?.stackable) {
        conflicts.push(`Promotion ${code} is not stackable`);
        continue;
      }

      const validation = await this.validatePromotion({
        code,
        productId: request.productId,
        customerId: request.customerId,
        orderAmount: request.orderAmount,
      });

      if (validation.valid && validation.discount?.calculatedAmount) {
        stackablePromotions.push(promotion);
        totalDiscount += validation.discount.calculatedAmount;
      } else {
        conflicts.push(`Promotion ${code} is not eligible: ${validation.eligibility.reasons.join(', ')}`);
      }
    }

    const finalAmount = Math.max(0, request.orderAmount - totalDiscount);

    return {
      valid: conflicts.length === 0 && stackablePromotions.length > 0,
      stackablePromotions,
      totalDiscount,
      finalAmount,
      conflicts,
    };
  }

  /**
   * 創建優惠活動 - New Enhanced Method
   */
  public async createPromotionCampaign(campaign: Omit<PromotionCampaign, 'id'>): Promise<{
    success: boolean;
    campaign?: PromotionCampaign;
    message?: string;
  }> {
    // Validate campaign dates
    const startDate = new Date(campaign.startDate);
    const endDate = new Date(campaign.endDate);

    if (startDate >= endDate) {
      return {
        success: false,
        message: 'End date must be after start date',
      };
    }

    // Validate promotion codes exist
    const invalidCodes = campaign.promotionCodes.filter((code) => !this.promotions.some((p) => p.code === code));

    if (invalidCodes.length > 0) {
      return {
        success: false,
        message: `Invalid promotion codes: ${invalidCodes.join(', ')}`,
      };
    }

    const newCampaign: PromotionCampaign = {
      id: `campaign_${Date.now()}`,
      ...campaign,
    };

    return {
      success: true,
      campaign: newCampaign,
      message: 'Campaign created successfully',
    };
  }

  /**
   * 優惠碼效能分析 - New Enhanced Method
   */
  public async analyzePromotionPerformance(promotionCode: string): Promise<{
    promotion?: Promotion;
    performance: {
      usageRate: number;
      conversionRate: number;
      averageOrderValue: number;
      customerRetention: number;
      roi: number;
      recommendations: string[];
    };
  }> {
    const promotion = this.promotions.find((p) => p.code === promotionCode);

    if (!promotion) {
      throw new Error(`Promotion ${promotionCode} not found`);
    }

    const usageRate = promotion.usageLimit ? (promotion.currentUsage / promotion.usageLimit) * 100 : 0;

    const performance = promotion.performance || {
      conversionRate: 0,
      averageOrderValue: 0,
      customerRetention: 0,
    };

    const totalRevenueLoss = promotion.performance?.totalRevenueLoss || 0;
    const estimatedRevenue = performance.averageOrderValue * promotion.currentUsage * performance.conversionRate;
    const roi = totalRevenueLoss > 0 ? ((estimatedRevenue - totalRevenueLoss) / totalRevenueLoss) * 100 : 0;

    const recommendations: string[] = [];

    if (usageRate < 20) {
      recommendations.push('Consider increasing marketing efforts - low usage rate');
    }
    if (performance.conversionRate < 0.2) {
      recommendations.push('Review promotion terms - low conversion rate');
    }
    if (performance.customerRetention < 0.5) {
      recommendations.push('Focus on customer retention strategies');
    }
    if (roi < 0) {
      recommendations.push('Promotion is not profitable - consider adjustments');
    }
    if (usageRate > 90) {
      recommendations.push('Consider extending or creating similar promotion');
    }

    return {
      promotion,
      performance: {
        usageRate,
        conversionRate: performance.conversionRate,
        averageOrderValue: performance.averageOrderValue,
        customerRetention: performance.customerRetention,
        roi,
        recommendations,
      },
    };
  }

  /**
   * 智能優惠推薦 - New Enhanced Method
   */
  public async getPromotionRecommendations(customerProfile: { customerId: string; tier?: string; orderHistory?: number[]; preferences?: string[] }): Promise<{
    recommendations: Promotion[];
    reason: string;
  }> {
    const activePromotions = this.promotions.filter((p) => p.status === 'ACTIVE');

    // Filter by customer segment
    let eligiblePromotions = activePromotions.filter((promotion) => {
      if (promotion.conditions?.customerSegments) {
        return customerProfile.tier && promotion.conditions.customerSegments.includes(customerProfile.tier);
      }
      return true;
    });

    // Calculate average order value
    const averageOrderValue =
      customerProfile.orderHistory && customerProfile.orderHistory.length > 0
        ? customerProfile.orderHistory.reduce((sum, order) => sum + order, 0) / customerProfile.orderHistory.length
        : 0;

    // Filter by minimum amount
    if (averageOrderValue > 0) {
      eligiblePromotions = eligiblePromotions.filter((promotion) => {
        if (promotion.conditions?.minimumAmount) {
          return averageOrderValue >= promotion.conditions.minimumAmount;
        }
        return true;
      });
    }

    // Sort by priority and conversion rate
    eligiblePromotions.sort((a, b) => {
      const priorityA = a.metadata?.priority || 999;
      const priorityB = b.metadata?.priority || 999;
      const conversionA = a.performance?.conversionRate || 0;
      const conversionB = b.performance?.conversionRate || 0;

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      return conversionB - conversionA;
    });

    const recommendations = eligiblePromotions.slice(0, 3);
    const reason = customerProfile.tier ? `Personalized recommendations based on ${customerProfile.tier} tier membership` : 'General recommendations based on active promotions';

    return { recommendations, reason };
  }
}
