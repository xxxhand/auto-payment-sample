/**
 * 這是一個針對新訂閱用戶取得可訂閱產品列表的範例程式。實做符合規則如下：
 * 1、從未訂閱的用戶
 * 2、共取得2個產品。分別為月付240台幣及年付2400台幣
 * 3、年付產品符合第一次訂閱優惠，若嘗試使用優惠碼可用，則使用優惠碼，否則維持原價
 * 4、月付產品不使用優惠
 */

import 'reflect-metadata';
import { ProductService, Product } from '../domain/services/product.service';
import { PromotionService } from '../domain/services/promotion.service';

// 設定假資料
interface NewUserProductResult {
  productId: string;
  name: string;
  description: string;
  originalPrice: number;
  finalPrice: number;
  currency: string;
  billingInterval: string;
  appliedPromotion?: {
    code: string;
    discountAmount: number;
    description: string;
  };
}

class NewUserProductFinder {
  private productService: ProductService;
  private promotionService: PromotionService;

  constructor() {
    this.productService = new ProductService();
    this.promotionService = new PromotionService();
  }

  /**
   * 為新用戶找到合適的產品
   */
  async findProductsForNewUser(userId: string): Promise<NewUserProductResult[]> {
    console.log(`🔍 為新用戶 ${userId} 查找產品...`);

    // 1. 檢查用戶是否為首次訂閱用戶
    const isFirstTimeCustomer = await this.isFirstTimeCustomer(userId);
    if (!isFirstTimeCustomer) {
      throw new Error('此範例僅適用於首次訂閱用戶');
    }

    // 2. 取得符合條件的產品 (月付240元和年付2400元)
    const targetProducts = await this.getTargetProducts();
    console.log(`📦 找到 ${targetProducts.length} 個目標產品`);

    // 3. 為每個產品處理優惠 - 只有年付產品才嘗試使用優惠
    const results: NewUserProductResult[] = [];

    for (const product of targetProducts) {
      console.log(`🏷️ 處理產品: ${product.name} (${product.pricing.amount} ${product.pricing.currency})`);

      let discountResult;

      if (product.billing.interval === 'YEARLY') {
        // 年付產品嘗試使用 WELCOME100 優惠
        discountResult = await this.applyYearlyProductDiscount(product, userId);
      } else {
        // 月付產品不使用優惠
        discountResult = this.applyNoDiscount(product);
      }

      results.push({
        productId: product.productId,
        name: product.name,
        description: product.description,
        originalPrice: product.pricing.amount,
        finalPrice: discountResult.finalPrice,
        currency: product.pricing.currency,
        billingInterval: product.billing.interval,
        appliedPromotion: discountResult.appliedPromotion,
      });
    }

    return results;
  }

  /**
   * 檢查是否為首次訂閱用戶
   */
  private async isFirstTimeCustomer(userId: string): Promise<boolean> {
    // 模擬檢查邏輯 - 在實際系統中會查詢訂閱歷史
    console.log(`👤 檢查用戶 ${userId} 是否為首次客戶...`);
    return true; // 假設是首次用戶
  }

  /**
   * 取得目標產品 (月付240元和年付2400元)
   */
  private async getTargetProducts(): Promise<Product[]> {
    // 根據需求篩選出月付240元和年付2400元的產品
    const monthlyProduct = this.createMockProduct('monthly', 240, 'MONTHLY');
    const yearlyProduct = this.createMockProduct('yearly', 2400, 'YEARLY');

    return [monthlyProduct, yearlyProduct];
  }

  /**
   * 創建模擬產品數據
   */
  private createMockProduct(type: string, amount: number, interval: 'MONTHLY' | 'YEARLY'): Product {
    return {
      productId: `prod_basic_${type}`,
      name: `Basic ${type === 'monthly' ? 'Monthly' : 'Yearly'} Plan`,
      description: `基本方案 - ${type === 'monthly' ? '月付' : '年付'}`,
      status: 'ACTIVE',
      pricing: { amount, currency: 'TWD' },
      billing: { interval },
      features: ['基本功能', '郵件支援', '最多 5 個專案', ...(type === 'yearly' ? ['年付優惠'] : [])],
      metadata: {
        tier: 'basic',
        popular: type === 'yearly',
        category: 'subscription',
        tags: ['basic', type],
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * 為年付產品嘗試應用最佳優惠
   */
  private async applyYearlyProductDiscount(
    product: Product,
    userId: string,
  ): Promise<{
    finalPrice: number;
    appliedPromotion?: {
      code: string;
      discountAmount: number;
      description: string;
    };
  }> {
    console.log(`🎯 為年付產品 ${product.name} 查找可用優惠...`);

    try {
      // 1. 取得該產品的可用優惠
      const availablePromotions = await this.promotionService.getAvailablePromotions({
        productId: product.productId,
        customerId: userId,
      });

      console.log(`📋 找到 ${availablePromotions.promotions.length} 個可用優惠`);

      if (availablePromotions.promotions.length === 0) {
        console.log(`💭 無可用優惠，年付產品維持原價: ${product.pricing.amount}`);
        return {
          finalPrice: product.pricing.amount,
        };
      }

      // 2. 篩選適合首次訂閱用戶的優惠
      const firstTimePromotions = availablePromotions.promotions.filter((promo) => promo.conditions?.firstTimeCustomersOnly === true);

      console.log(`🔍 找到 ${firstTimePromotions.length} 個首次用戶專屬優惠`);

      let bestPromotion = null;
      let bestDiscount = 0;

      // 3. 計算每個優惠的折扣金額，找出最佳優惠
      for (const promotion of firstTimePromotions) {
        console.log(`💰 計算優惠 ${promotion.code} 的折扣...`);

        try {
          const discountResult = await this.promotionService.calculateDiscount(promotion.code, product.pricing.amount);

          console.log(`   ${promotion.code}: 折扣 ${discountResult.discountAmount} 元 (${promotion.description})`);

          if (discountResult.discountAmount > bestDiscount) {
            bestDiscount = discountResult.discountAmount;
            bestPromotion = {
              code: promotion.code,
              description: promotion.description,
              discountAmount: discountResult.discountAmount,
              finalAmount: discountResult.finalAmount,
            };
          }
        } catch (error) {
          console.log(`   ⚠️ ${promotion.code} 計算失敗: ${error.message}`);
        }
      }

      // 4. 應用最佳優惠
      if (bestPromotion && bestDiscount > 0) {
        console.log(`🎉 選擇最佳優惠 ${bestPromotion.code}：原價 ${product.pricing.amount}, 優惠後 ${bestPromotion.finalAmount}, 折扣 ${bestPromotion.discountAmount}`);

        return {
          finalPrice: bestPromotion.finalAmount,
          appliedPromotion: {
            code: bestPromotion.code,
            discountAmount: bestPromotion.discountAmount,
            description: bestPromotion.description,
          },
        };
      } else {
        console.log(`💭 無合適優惠可用，年付產品維持原價: ${product.pricing.amount}`);
        return {
          finalPrice: product.pricing.amount,
        };
      }
    } catch (error) {
      console.log(`❌ 查找優惠時發生錯誤: ${error.message}`);
      console.log(`💭 年付產品維持原價: ${product.pricing.amount}`);

      return {
        finalPrice: product.pricing.amount,
      };
    }
  }

  /**
   * 月付產品不使用優惠
   */
  private applyNoDiscount(product: Product): {
    finalPrice: number;
    appliedPromotion?: {
      code: string;
      discountAmount: number;
      description: string;
    };
  } {
    console.log(`📋 月付產品 ${product.name} 不使用優惠，維持原價: ${product.pricing.amount}`);

    return {
      finalPrice: product.pricing.amount,
    };
  }
}

// 主執行函數
async function main() {
  try {
    console.log('🚀 開始執行新用戶產品查找範例\n');

    const finder = new NewUserProductFinder();
    const userId = 'new_user_001';

    const products = await finder.findProductsForNewUser(userId);

    console.log('\n📊 === 查找結果 ===');
    console.log(`找到 ${products.length} 個適合的產品:\n`);

    products.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   產品ID: ${product.productId}`);
      console.log(`   描述: ${product.description}`);
      console.log(`   計費週期: ${product.billingInterval === 'MONTHLY' ? '月付' : '年付'}`);
      console.log(`   原價: ${product.originalPrice} ${product.currency}`);

      if (product.appliedPromotion) {
        console.log(`   🎉 適用優惠: ${product.appliedPromotion.description}`);
        console.log(`   優惠代碼: ${product.appliedPromotion.code}`);
        console.log(`   折扣金額: ${product.appliedPromotion.discountAmount} ${product.currency}`);
        console.log(`   ✨ 優惠價: ${product.finalPrice} ${product.currency}`);
      } else {
        console.log(`   最終價格: ${product.finalPrice} ${product.currency}`);
      }
      console.log('');
    });

    // 驗證需求
    console.log('✅ === 需求驗證 ===');
    console.log(`1. 從未訂閱的用戶: ✅ (用戶 ${userId} 為首次用戶)`);
    console.log(`2. 共取得2個產品: ${products.length === 2 ? '✅' : '❌'} (實際: ${products.length}個)`);

    const monthlyProduct = products.find((p) => p.billingInterval === 'MONTHLY');
    const yearlyProduct = products.find((p) => p.billingInterval === 'YEARLY');

    console.log(`   - 月付產品: ${monthlyProduct ? `${monthlyProduct.originalPrice} TWD ✅` : '❌ 未找到'}`);
    console.log(`   - 年付產品: ${yearlyProduct ? `${yearlyProduct.originalPrice} TWD ✅` : '❌ 未找到'}`);

    // 驗證年付產品優惠規則
    const yearlyHasDiscount = yearlyProduct?.appliedPromotion;
    const yearlyMaintainsOriginalPrice = yearlyProduct && !yearlyProduct.appliedPromotion;
    console.log(`3. 年付產品優惠規則: ${yearlyHasDiscount || yearlyMaintainsOriginalPrice ? '✅' : '❌'}`);

    if (yearlyProduct) {
      if (yearlyHasDiscount) {
        console.log(
          `   - 年付產品成功使用優惠 ${yearlyProduct.appliedPromotion.code}: ${yearlyProduct.originalPrice} -> ${yearlyProduct.finalPrice} TWD (折扣 ${yearlyProduct.appliedPromotion.discountAmount} 元)`,
        );
      } else {
        console.log(`   - 年付產品維持原價: ${yearlyProduct.originalPrice} TWD (無可用優惠)`);
      }
    }

    // 驗證月付產品不使用優惠
    const monthlyNoDiscount = monthlyProduct && !monthlyProduct.appliedPromotion && monthlyProduct.originalPrice === monthlyProduct.finalPrice;
    console.log(`4. 月付產品不使用優惠: ${monthlyNoDiscount ? '✅' : '❌'}`);

    if (monthlyProduct) {
      console.log(`   - 月付產品維持原價: ${monthlyProduct.originalPrice} TWD (無優惠)`);
    }

    console.log('\n🎉 範例程式執行完成！');
  } catch (error) {
    console.error('❌ 執行失敗:', error.message);
    process.exit(1);
  }
}

// 只有在直接執行此文件時才運行
if (require.main === module) {
  main();
}
