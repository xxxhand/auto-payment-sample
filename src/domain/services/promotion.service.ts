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
  };
}

/**
 * 優惠管理服務
 * 負責優惠碼驗證、資格檢查和折扣計算
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
      validUntil: '2024-12-31T23:59:59Z',
      usageLimit: 5000,
      currentUsage: 1456,
      conditions: {
        firstTimeCustomersOnly: true,
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
    },
  ];

  /**
   * 驗證優惠碼
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
}
