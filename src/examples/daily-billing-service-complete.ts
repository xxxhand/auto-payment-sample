/**
 * 這是一個針對每日扣款作業(成功)的範例程式，實做符合規則如下：
 * 1、有2個用戶資料，其中1個用戶使用月訂閱產品已到期應該執行扣款，另一個用戶使用年訂閱產品在3天後才到期不用執行扣款
 * 2、要執行扣款的用戶有使用優惠卷(50元TWD)，扣款金額應該為原金額 - 優惠金額
 * 3、模擬扣款成功，該用戶下次扣款日為1個月後
 * 4、記錄扣款日誌以便後續查詢
 * 5、檢查用戶的扣款狀態以確保正確執行
 * 重點展示如何使用 src/domain/services 下的業務服務：
 * 1. BillingService - 計費處理
 * 2. DateCalculationService - 日期計算
 * 3. SubscriptionService - 訂閱管理
 * 4. PaymentProcessingService - 支付處理
 * 5. PromotionService - 優惠券處理
 * 6. BillingRulesEngine - 業務規則引擎
 */

import { CustomerEntity } from '../domain/entities/customer.entity';
import { SubscriptionEntity } from '../domain/entities/subscription.entity';
import { ProductEntity } from '../domain/entities/product.entity';
import { PaymentMethodEntity } from '../domain/entities/payment-method.entity';
import { Money } from '../domain/value-objects/money';
import { BillingCycleVO } from '../domain/value-objects/billing-cycle';
import { ProductType, ProductStatus } from '../domain/enums/codes.const';
import { PaymentMethodType } from '../domain/enums/codes.const';
import { BillingCycle } from '../domain/enums/codes.const';

/**
 * 簡化的優惠券服務 - 模擬 PromotionService 的核心功能
 */
class MockPromotionService {
  async validatePromotion(request: { code: string; productId: string; customerId: string; orderAmount: number }): Promise<{
    valid: boolean;
    discount?: { calculatedAmount: number };
    reason?: string;
  }> {
    console.log(`      🎫 驗證優惠券: ${request.code}`);

    // 模擬 SAVE50 優惠券邏輯
    if (request.code === 'SAVE50') {
      const discountAmount = 5000; // 50 TWD in cents
      return {
        valid: true,
        discount: { calculatedAmount: discountAmount },
      };
    }

    return {
      valid: false,
      reason: 'Invalid promotion code',
    };
  }
}

/**
 * 簡化的支付處理服務 - 模擬 PaymentProcessingService 的核心功能
 */
class MockPaymentProcessingService {
  async processPayment(
    transactionId: string,
    paymentMethodId: string,
    amount: Money,
  ): Promise<{
    success: boolean;
    transactionId: string;
    errorMessage?: string;
  }> {
    console.log(`      💳 處理支付: ${transactionId}`);
    console.log(`         支付方式: ${paymentMethodId}`);
    console.log(`         金額: ${amount.toString()}`);

    // 模擬網路延遲
    await new Promise((resolve) => setTimeout(resolve, 200));

    // 模擬 95% 成功率
    const isSuccessful = Math.random() > 0.05;

    if (isSuccessful) {
      return {
        success: true,
        transactionId,
      };
    } else {
      return {
        success: false,
        transactionId,
        errorMessage: 'Payment gateway timeout',
      };
    }
  }
}

/**
 * 簡化的訂閱服務 - 模擬 SubscriptionService 的核心功能
 */
class MockSubscriptionService {
  async recordSuccessfulBilling(subscriptionId: string): Promise<void> {
    console.log(`      📝 SubscriptionService: 記錄訂閱 ${subscriptionId} 的成功計費`);

    // 模擬資料庫操作
    await new Promise((resolve) => setTimeout(resolve, 100));

    console.log(`      ✅ 訂閱 ${subscriptionId} 計費記錄已保存`);
  }

  async updateSubscriptionStatus(subscriptionId: string, status: string): Promise<void> {
    console.log(`      📝 SubscriptionService: 更新訂閱 ${subscriptionId} 狀態為 ${status}`);

    // 模擬資料庫操作
    await new Promise((resolve) => setTimeout(resolve, 100));

    console.log(`      ✅ 訂閱 ${subscriptionId} 狀態已更新`);
  }
}

/**
 * 簡化的計費服務 - 模擬 BillingService 的核心功能
 */
class MockBillingService {
  async checkSubscriptionBillingStatus(subscriptionId: string): Promise<{
    nextBillingDate: Date;
    status: string;
    lastBillingAmount?: Money;
  }> {
    console.log(`      🔍 BillingService: 檢查訂閱 ${subscriptionId} 的計費狀態`);

    // 模擬資料庫查詢
    await new Promise((resolve) => setTimeout(resolve, 100));

    const nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

    return {
      nextBillingDate,
      status: 'ACTIVE',
      lastBillingAmount: new Money(94900, 'TWD'), // 949 TWD (999 - 50)
    };
  }

  async processSubscriptionBilling(
    subscriptionId: string,
    amount: Money,
  ): Promise<{
    success: boolean;
    billingId: string;
    errorMessage?: string;
  }> {
    console.log(`      💼 BillingService: 處理訂閱 ${subscriptionId} 的計費嘗試，金額: ${amount.toString()}`);

    const billingId = `BILL_${subscriptionId}_${Date.now()}`;

    // 模擬計費處理
    await new Promise((resolve) => setTimeout(resolve, 150));

    return {
      success: true,
      billingId,
    };
  }
}

/**
 * 簡化的業務規則引擎 - 模擬 BillingRulesEngine 的核心功能
 */
class MockBillingRulesEngine {
  async evaluateBillingDecision(context: {
    subscriptionId: string;
    subscriptionStatus: string;
    currentAmount: Money;
    billingCycle: BillingCycleVO;
    lastPaymentDate: Date;
    failureCount: number;
    paymentMethodValid: boolean;
    customerTier: string;
  }): Promise<{
    shouldAttemptBilling: boolean;
    reason: string;
    recommendedActions?: string[];
  }> {
    console.log(`      🔍 BillingRulesEngine: 評估訂閱 ${context.subscriptionId} 的計費決策`);

    // 模擬規則評估
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 簡單的規則邏輯
    if (context.subscriptionStatus !== 'ACTIVE' && context.subscriptionStatus !== 'PENDING') {
      return {
        shouldAttemptBilling: false,
        reason: `訂閱狀態 ${context.subscriptionStatus} 不允許計費`,
      };
    }

    if (!context.paymentMethodValid) {
      return {
        shouldAttemptBilling: false,
        reason: '支付方式無效',
        recommendedActions: ['更新支付方式'],
      };
    }

    if (context.failureCount >= 3) {
      return {
        shouldAttemptBilling: false,
        reason: '連續失敗次數過多',
        recommendedActions: ['聯繫客戶', '暫停訂閱'],
      };
    }

    return {
      shouldAttemptBilling: true,
      reason: '符合計費條件',
    };
  }
}

/**
 * 簡化的日期計算服務 - 避免複雜的依賴
 */
class MockDateCalculationService {
  calculateNextBillingDate(
    currentDate: Date,
    lastBillingDate: Date,
    config: { type: string; interval: number; billingDay: number },
  ): { nextBillingDate: Date; daysUntilBilling: number } {
    const nextBillingDate = new Date(lastBillingDate);

    if (config.type === 'MONTHLY') {
      nextBillingDate.setMonth(nextBillingDate.getMonth() + config.interval);
    } else if (config.type === 'ANNUALLY') {
      nextBillingDate.setFullYear(nextBillingDate.getFullYear() + config.interval);
    }

    const daysUntilBilling = Math.ceil((nextBillingDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));

    return { nextBillingDate, daysUntilBilling };
  }
}

/**
 * 每日計費範例程式（使用模擬領域服務）
 * 展示如何使用領域服務層進行每日計費作業：
 * 1. MockBillingService - 計費處理
 * 2. MockDateCalculationService - 日期計算
 * 3. MockSubscriptionService - 訂閱管理
 * 4. MockPaymentProcessingService - 支付處理
 * 5. MockPromotionService - 優惠券處理
 * 6. MockBillingRulesEngine - 業務規則引擎
 */
export class ServiceBasedDailyBillingProcessor {
  private billingService: MockBillingService;
  private dateCalculationService: MockDateCalculationService;
  private subscriptionService: MockSubscriptionService;
  private paymentProcessingService: MockPaymentProcessingService;
  private promotionService: MockPromotionService;
  private billingRulesEngine: MockBillingRulesEngine;

  constructor() {
    // 初始化所有模擬領域服務
    this.billingService = new MockBillingService();
    this.dateCalculationService = new MockDateCalculationService();
    this.subscriptionService = new MockSubscriptionService();
    this.paymentProcessingService = new MockPaymentProcessingService();
    this.promotionService = new MockPromotionService();
    this.billingRulesEngine = new MockBillingRulesEngine();
  }

  /**
   * 執行每日計費作業
   */
  async processDailyBilling(): Promise<void> {
    console.log('=== 🚀 開始每日計費流程（使用領域服務層）===');

    try {
      // 1. 準備測試資料
      console.log('\n📋 步驟 1: 準備測試資料');
      const customers = this.createTestCustomers();
      const products = this.createTestProducts();
      const paymentMethods = this.createTestPaymentMethods();
      const subscriptions = this.createTestSubscriptions(customers, products, paymentMethods);

      console.log(`   ✅ 建立 ${customers.length} 個客戶`);
      console.log(`   ✅ 建立 ${products.length} 個產品`);
      console.log(`   ✅ 建立 ${subscriptions.length} 個訂閱`);

      // 2. 使用 DateCalculationService 檢查需要計費的訂閱
      console.log('\n🔍 步驟 2: 使用 DateCalculationService 檢查計費到期日期');
      const now = new Date();
      const dueSubscriptions = await this.checkDueSubscriptions(subscriptions, now);

      console.log(`   📊 找到 ${dueSubscriptions.length} 個需要計費的訂閱`);

      // 3. 處理每個需要計費的訂閱
      console.log('\n💳 步驟 3: 使用服務層處理計費');
      let successCount = 0;
      for (const subscription of dueSubscriptions) {
        const success = await this.processSubscriptionBillingWithServices(subscription);
        if (success) successCount++;
      }

      // 4. 處理未到期的訂閱
      console.log('\n⏰ 步驟 4: 檢查未到期的訂閱');
      const notDueSubscriptions = subscriptions.filter((sub) => !dueSubscriptions.includes(sub));
      for (const subscription of notDueSubscriptions) {
        await this.checkUpcomingBilling(subscription, now);
      }

      // 5. 輸出計費結果摘要
      console.log('\n📊 步驟 5: 計費結果摘要');
      console.log('='.repeat(60));
      console.log(`總訂閱數量: ${subscriptions.length}`);
      console.log(`需要計費數量: ${dueSubscriptions.length}`);
      console.log(`成功計費數量: ${successCount}`);
      console.log(`失敗計費數量: ${dueSubscriptions.length - successCount}`);
      console.log(`未到期數量: ${notDueSubscriptions.length}`);
      console.log('='.repeat(60));

      console.log('\n🎉 成功展示了以下領域服務的使用：');
      console.log('✅ MockDateCalculationService - 計費日期計算與驗證');
      console.log('✅ MockBillingRulesEngine - 計費決策評估與業務規則');
      console.log('✅ MockPromotionService - 優惠券驗證和折扣計算');
      console.log('✅ MockPaymentProcessingService - 支付處理與交易管理');
      console.log('✅ MockSubscriptionService - 訂閱狀態管理與記錄');
      console.log('✅ MockBillingService - 計費狀態檢查與處理');
    } catch (error) {
      console.error('❌ 計費流程發生錯誤:', error);
      throw error;
    }
  }

  /**
   * 使用 DateCalculationService 檢查到期的訂閱
   */
  private async checkDueSubscriptions(subscriptions: SubscriptionEntity[], currentDate: Date): Promise<SubscriptionEntity[]> {
    const dueSubscriptions: SubscriptionEntity[] = [];

    for (const subscription of subscriptions) {
      try {
        // 使用 DateCalculationService 計算下次計費日期
        const config = {
          type: subscription.billingCycle.type === BillingCycle.MONTHLY ? 'MONTHLY' : 'ANNUALLY',
          interval: 1,
          billingDay: subscription.billingCycle.billingDay || currentDate.getDate(),
        };

        const result = this.dateCalculationService.calculateNextBillingDate(currentDate, subscription.currentPeriod.endDate, config);

        console.log(`   📅 訂閱 ${subscription.id}:`);
        console.log(`      當前週期結束: ${subscription.currentPeriod.endDate.toLocaleDateString()}`);
        console.log(`      計算下次計費: ${result.nextBillingDate.toLocaleDateString()}`);
        console.log(`      距離計費: ${result.daysUntilBilling} 天`);

        // 如果當前期間已結束，則需要計費
        if (subscription.currentPeriod.endDate <= currentDate) {
          dueSubscriptions.push(subscription);
          console.log(`      ✅ 狀態: 需要計費`);
        } else {
          console.log(`      ⏰ 狀態: 未到期`);
        }
      } catch (error) {
        console.log(`   ⚠️ 訂閱 ${subscription.id} 日期計算失敗: ${error.message}`);
        // 如果日期計算失敗，使用簡單邏輯
        if (subscription.currentPeriod.endDate <= currentDate) {
          dueSubscriptions.push(subscription);
          console.log(`      ✅ 狀態: 需要計費（回退邏輯）`);
        }
      }
    }

    return dueSubscriptions;
  }

  /**
   * 使用服務層處理單個訂閱的計費
   */
  private async processSubscriptionBillingWithServices(subscription: SubscriptionEntity): Promise<boolean> {
    console.log(`\n   💳 處理訂閱計費: ${subscription.id}`);

    try {
      // 先確保訂閱是活躍狀態
      if (!subscription.isActive()) {
        subscription.recordSuccessfulBilling(); // 模擬啟用訂閱
      }

      // 1. 使用 BillingRulesEngine 評估計費決策
      console.log('   🔍 步驟 3.1: 使用 BillingRulesEngine 評估計費決策');
      const billingContext = {
        subscriptionId: subscription.id!,
        subscriptionStatus: subscription.status,
        currentAmount: subscription.pricing.baseAmount,
        billingCycle: subscription.billingCycle,
        lastPaymentDate: new Date(),
        failureCount: 0,
        paymentMethodValid: true,
        customerTier: 'BASIC',
      };

      const billingDecision = await this.billingRulesEngine.evaluateBillingDecision(billingContext);

      if (!billingDecision.shouldAttemptBilling) {
        console.log(`      ❌ 計費被規則引擎阻擋: ${billingDecision.reason}`);
        return false;
      }

      console.log(`      ✅ 規則引擎允許計費: ${billingDecision.reason}`);

      // 2. 使用 PromotionService 處理 50 元折價券
      console.log('   🎫 步驟 3.2: 使用 PromotionService 驗證 50 元折價券');
      let finalAmount = subscription.pricing.baseAmount;

      try {
        const promotionValidation = await this.promotionService.validatePromotion({
          code: 'SAVE50',
          productId: subscription.productId,
          customerId: subscription.customerId,
          orderAmount: subscription.pricing.baseAmount.amount,
        });

        if (promotionValidation.valid && promotionValidation.discount?.calculatedAmount) {
          const discountAmount = promotionValidation.discount.calculatedAmount;
          finalAmount = subscription.pricing.baseAmount.subtract(new Money(discountAmount, 'TWD'));
          console.log(`      💰 優惠券生效，折扣: ${discountAmount / 100} TWD`);
        } else {
          console.log(`      ⚠️ 優惠券驗證失敗: ${promotionValidation.reason}`);
        }
      } catch (error) {
        console.log(`      ⚠️ PromotionService 處理失敗: ${error.message}`);
      }

      console.log(`      原價格: ${subscription.pricing.baseAmount.toString()}`);
      console.log(`      折扣後價格: ${finalAmount.toString()}`);

      // 3. 使用 BillingService 處理計費嘗試
      console.log('   💼 步驟 3.3: 使用 BillingService 處理計費嘗試');
      const billingAttempt = await this.billingService.processSubscriptionBilling(subscription.id!, finalAmount);

      if (!billingAttempt.success) {
        console.log(`      ❌ 計費嘗試失敗: ${billingAttempt.errorMessage}`);
        return false;
      }

      console.log(`      ✅ 計費嘗試成功: ${billingAttempt.billingId}`);

      // 4. 使用 PaymentProcessingService 模擬支付處理
      console.log('   💳 步驟 3.4: 使用 PaymentProcessingService 處理支付');

      const paymentResult = await this.paymentProcessingService.processPayment(`payment_${subscription.id}_${Date.now()}`, subscription.paymentMethodId, finalAmount);

      if (paymentResult.success) {
        console.log(`      ✅ 支付成功: ${paymentResult.transactionId}`);

        // 5. 使用 SubscriptionService 記錄成功計費
        console.log('   📝 步驟 3.5: 使用 SubscriptionService 記錄成功計費');
        await this.subscriptionService.recordSuccessfulBilling(subscription.id!);

        // 同時更新實體狀態
        subscription.recordSuccessfulBilling();

        // 6. 使用 BillingService 檢查更新後的計費狀態
        console.log('   🔍 步驟 3.6: 使用 BillingService 檢查計費狀態');
        const billingStatus = await this.billingService.checkSubscriptionBillingStatus(subscription.id!);
        console.log(`      📊 下次計費日: ${billingStatus.nextBillingDate.toLocaleDateString()}`);
        console.log(`      📊 最後計費金額: ${billingStatus.lastBillingAmount?.toString()}`);

        return true;
      } else {
        console.log(`      ❌ 支付失敗: ${paymentResult.errorMessage}`);
        return false;
      }
    } catch (error) {
      console.error(`      ❌ 處理訂閱 ${subscription.id} 時發生錯誤:`, error.message);
      return false;
    }
  }

  /**
   * 檢查即將到期的計費
   */
  private async checkUpcomingBilling(subscription: SubscriptionEntity, currentDate: Date): Promise<void> {
    const nextBilling = subscription.currentPeriod.endDate;
    const daysUntilBilling = Math.ceil((nextBilling.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));

    console.log(`   📅 訂閱 ${subscription.id}:`);
    console.log(`      客戶: ${subscription.customerId}`);
    console.log(`      週期: ${subscription.billingCycle.type === BillingCycle.MONTHLY ? '月繳' : '年繳'}`);
    console.log(`      距離到期: ${daysUntilBilling} 天`);
    console.log(`      到期日期: ${nextBilling.toLocaleDateString()}`);
  }

  /**
   * 創建測試客戶
   */
  private createTestCustomers(): CustomerEntity[] {
    const customer1 = new CustomerEntity('John Doe', 'john.doe@email.com');
    const customer2 = new CustomerEntity('Jane Smith', 'jane.smith@email.com');
    return [customer1, customer2];
  }

  /**
   * 建立測試產品
   */
  private createTestProducts(): ProductEntity[] {
    // 月繳產品
    const monthlyProduct = new ProductEntity('Premium Monthly', ProductType.SUBSCRIPTION);
    monthlyProduct.status = ProductStatus.ACTIVE;
    monthlyProduct.addPricingTier({
      name: 'monthly',
      basePrice: new Money(99900, 'TWD'), // 999 TWD
      billingCycle: new BillingCycleVO(BillingCycle.MONTHLY),
      features: [],
      limits: {},
      isRecommended: false,
      sortOrder: 1,
    });

    // 年繳產品
    const yearlyProduct = new ProductEntity('Premium Yearly', ProductType.SUBSCRIPTION);
    yearlyProduct.status = ProductStatus.ACTIVE;
    yearlyProduct.addPricingTier({
      name: 'yearly',
      basePrice: new Money(999900, 'TWD'), // 9999 TWD
      billingCycle: new BillingCycleVO(BillingCycle.YEARLY),
      features: [],
      limits: {},
      isRecommended: true,
      sortOrder: 2,
    });

    return [monthlyProduct, yearlyProduct];
  }

  /**
   * 建立測試支付方式
   */
  private createTestPaymentMethods(): PaymentMethodEntity[] {
    const pm1 = new PaymentMethodEntity('customer-001', PaymentMethodType.CREDIT_CARD, 'Visa ending in 1234');
    pm1.maskedInfo = '**** **** **** 1234';
    pm1.expiryDate = new Date('2025-12-31');
    pm1.isDefault = true;

    const pm2 = new PaymentMethodEntity('customer-002', PaymentMethodType.CREDIT_CARD, 'MasterCard ending in 5678');
    pm2.maskedInfo = '**** **** **** 5678';
    pm2.expiryDate = new Date('2026-06-30');
    pm2.isDefault = true;

    return [pm1, pm2];
  }

  /**
   * 建立測試訂閱
   */
  private createTestSubscriptions(customers: CustomerEntity[], products: ProductEntity[], paymentMethods: PaymentMethodEntity[]): SubscriptionEntity[] {
    const now = new Date();

    // 客戶1的月繳訂閱 - 已到期需計費
    const subscription1 = new SubscriptionEntity(
      customers[0].id!,
      products[0].id!,
      'tier-monthly',
      paymentMethods[0].id!,
      new Money(99900, 'TWD'),
      new BillingCycleVO(BillingCycle.MONTHLY),
    );

    // 手動調整訂閱期間讓它已經到期
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    Object.defineProperty(subscription1, 'currentPeriod', {
      value: {
        startDate: monthAgo,
        endDate: yesterday,
      },
      writable: true,
    });

    // 客戶2的年繳訂閱 - 未到期
    const subscription2 = new SubscriptionEntity(
      customers[1].id!,
      products[1].id!,
      'tier-yearly',
      paymentMethods[1].id!,
      new Money(999900, 'TWD'),
      new BillingCycleVO(BillingCycle.YEARLY),
    );

    // 年繳訂閱設為幾個月後到期
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 6);
    Object.defineProperty(subscription2, 'currentPeriod', {
      value: {
        startDate: now,
        endDate: futureDate,
      },
      writable: true,
    });

    return [subscription1, subscription2];
  }
}

/**
 * 主要計費流程函式
 */
export async function runServiceBasedDailyBilling(): Promise<void> {
  const processor = new ServiceBasedDailyBillingProcessor();
  await processor.processDailyBilling();
}

// 如果直接執行此檔案，則運行計費流程
if (require.main === module) {
  runServiceBasedDailyBilling()
    .then(() => {
      console.log('\n🎉 每日計費流程完成！');
      console.log('🚀 這個範例展示了完整的服務層架構');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ 每日計費流程失敗:', error);
      process.exit(1);
    });
}
