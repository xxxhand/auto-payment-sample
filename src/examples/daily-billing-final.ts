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
 * 每日計費範例程式（使用領域模型）
 * 完整展示每日計費工作流程，包含：
 * 1. 2個客戶（一個月繳到期、一個年繳未到期）
 * 2. 套用50元折價券
 * 3. 模擬成功扣款
 * 4. 記錄計費日誌
 * 5. 驗證計費狀態
 */
export class DomainBasedBillingProcessor {
  /**
   * 執行每日計費作業
   */
  async processDailyBilling(): Promise<void> {
    console.log('=== 🚀 開始每日計費流程 ===');

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

      // 2. 檢查需要計費的訂閱
      console.log('\n🔍 步驟 2: 檢查需要計費的訂閱');
      const now = new Date();
      const dueSubscriptions = this.checkDueSubscriptions(subscriptions, now);

      console.log(`   📊 總訂閱數: ${subscriptions.length}`);
      console.log(`   📊 需計費訂閱數: ${dueSubscriptions.length}`);

      // 3. 處理每個需要計費的訂閱
      console.log('\n💳 步驟 3: 處理計費');
      let successCount = 0;
      for (const subscription of dueSubscriptions) {
        const success = await this.processSubscriptionBilling(subscription);
        if (success) successCount++;
      }

      // 4. 處理未到期的訂閱
      console.log('\n⏰ 步驟 4: 檢查未到期的訂閱');
      const notDueSubscriptions = subscriptions.filter((sub) => !dueSubscriptions.includes(sub));
      for (const subscription of notDueSubscriptions) {
        this.checkUpcomingBilling(subscription, now);
      }

      // 5. 輸出計費結果摘要
      console.log('\n📊 步驟 5: 計費結果摘要');
      console.log('='.repeat(50));
      console.log(`總訂閱數量: ${subscriptions.length}`);
      console.log(`需要計費數量: ${dueSubscriptions.length}`);
      console.log(`成功計費數量: ${successCount}`);
      console.log(`失敗計費數量: ${dueSubscriptions.length - successCount}`);
      console.log(`未到期數量: ${notDueSubscriptions.length}`);
      console.log('='.repeat(50));

      console.log('\n🎉 範例成功展示了以下功能：');
      console.log('✅ 領域實體的完整業務方法');
      console.log('✅ 2個客戶情境：月繳到期 vs 年繳未到期');
      console.log('✅ 50元折價券自動套用與計算');
      console.log('✅ 模擬真實的支付處理流程');
      console.log('✅ 完整的計費日誌記錄');
      console.log('✅ 訂閱狀態的自動更新');
    } catch (error) {
      console.error('❌ 計費流程發生錯誤:', error);
      throw error;
    }
  }

  /**
   * 檢查到期的訂閱
   */
  private checkDueSubscriptions(subscriptions: SubscriptionEntity[], currentDate: Date): SubscriptionEntity[] {
    const dueSubscriptions: SubscriptionEntity[] = [];

    for (const subscription of subscriptions) {
      const nextBilling = subscription.currentPeriod.endDate;
      const daysUntilBilling = Math.ceil((nextBilling.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));

      console.log(`   📅 訂閱 ${subscription.id}:`);
      console.log(`      客戶: ${subscription.customerId}`);
      console.log(`      週期: ${subscription.billingCycle.type === BillingCycle.MONTHLY ? '月繳' : '年繳'}`);
      console.log(`      當前週期結束: ${nextBilling.toLocaleDateString()}`);
      console.log(`      距離計費: ${daysUntilBilling} 天`);

      if (nextBilling <= currentDate) {
        dueSubscriptions.push(subscription);
        console.log(`      ✅ 狀態: 需要計費`);
      } else {
        console.log(`      ⏰ 狀態: 未到期`);
      }
    }

    return dueSubscriptions;
  }

  /**
   * 處理單個訂閱的計費
   */
  private async processSubscriptionBilling(subscription: SubscriptionEntity): Promise<boolean> {
    console.log(`\n   💳 處理訂閱計費: ${subscription.id}`);

    try {
      // 1. 檢查訂閱狀態
      console.log('      🔍 檢查訂閱狀態...');
      console.log(`      📋 當前狀態: ${subscription.status}`);
      console.log(`      📋 是否活躍: ${subscription.isActive()}`);

      if (!subscription.isActive()) {
        console.log(`      ❌ 訂閱狀態不允許計費: ${subscription.status}`);
        return false;
      }
      console.log(`      ✅ 訂閱狀態正常: ${subscription.status}`);

      // 2. 套用 50 元折價券
      console.log('      🎫 套用 50 元折價券...');
      const originalAmount = subscription.pricing.baseAmount;

      // 使用訂閱實體的優惠券方法
      subscription.applyPromotion('SAVE50', new Money(5000, 'TWD'), 1);
      const finalAmount = subscription.calculateCurrentPeriodAmount();

      console.log(`         原價格: ${originalAmount.toString()}`);
      console.log(`         折扣後: ${finalAmount.toString()}`);
      console.log(`         節省: ${originalAmount.subtract(finalAmount).toString()}`);

      // 3. 模擬支付處理
      console.log('      💳 模擬支付處理...');
      const paymentResult = await this.simulatePayment(subscription.paymentMethodId, finalAmount);

      if (paymentResult.success) {
        console.log(`      ✅ 支付成功: ${paymentResult.transactionId}`);

        // 4. 記錄成功計費
        console.log('      📝 記錄成功計費...');
        subscription.recordSuccessfulBilling();
        console.log(`      ✅ 訂閱狀態已更新`);
        console.log(`      📅 下次計費日: ${subscription.currentPeriod.endDate.toLocaleDateString()}`);

        // 5. 記錄計費日誌
        this.logBillingTransaction(subscription.id!, finalAmount, 'SUCCESS', paymentResult.transactionId);

        return true;
      } else {
        console.log(`      ❌ 支付失敗: ${paymentResult.errorMessage}`);
        this.logBillingTransaction(subscription.id!, finalAmount, 'FAILED', paymentResult.transactionId);
        return false;
      }
    } catch (error) {
      console.error(`      ❌ 處理訂閱 ${subscription.id} 時發生錯誤:`, error.message);
      this.logBillingTransaction(subscription.id!, subscription.pricing.baseAmount, 'ERROR');
      return false;
    }
  }

  /**
   * 模擬支付處理
   */
  private async simulatePayment(
    paymentMethodId: string,
    amount: Money,
  ): Promise<{
    success: boolean;
    transactionId: string;
    errorMessage?: string;
  }> {
    // 模擬網路延遲
    await new Promise((resolve) => setTimeout(resolve, 100));

    const transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log(`         支付方式 ID: ${paymentMethodId}`);
    console.log(`         支付金額: ${amount.toString()}`);
    console.log(`         交易 ID: ${transactionId}`);

    // 在此範例中總是回傳成功
    return {
      success: true,
      transactionId,
    };
  }

  /**
   * 記錄計費交易日誌
   */
  private logBillingTransaction(subscriptionId: string, amount: Money, status: string, transactionId?: string): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      subscriptionId,
      amount: amount.toString(),
      status,
      transactionId: transactionId || `LOG_${Date.now()}`,
      details: {
        currency: amount.currency,
        amountCents: amount.amount,
      },
    };

    console.log(`         📝 計費日誌:`);
    console.log(`            ${JSON.stringify(logEntry, null, 12)}`);
  }

  /**
   * 檢查即將到期的計費
   */
  private checkUpcomingBilling(subscription: SubscriptionEntity, currentDate: Date): void {
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

    // 設定訂閱為 ACTIVE 狀態（透過模擬成功付款）
    console.log(`初始訂閱1狀態: ${subscription1.status}`);
    subscription1.recordSuccessfulBilling();
    console.log(`訂閱1啟用後狀態: ${subscription1.status}`);

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

    // 設定訂閱為 ACTIVE 狀態（透過模擬成功付款）
    console.log(`初始訂閱2狀態: ${subscription2.status}`);
    subscription2.recordSuccessfulBilling();
    console.log(`訂閱2啟用後狀態: ${subscription2.status}`);

    return [subscription1, subscription2];
  }
}

/**
 * 主要計費流程函式
 */
export async function runDailyBillingExample(): Promise<void> {
  const processor = new DomainBasedBillingProcessor();
  await processor.processDailyBilling();
}

// 如果直接執行此檔案，則運行計費流程
if (require.main === module) {
  runDailyBillingExample()
    .then(() => {
      console.log('\n🎉 每日計費流程完成！');
      console.log('🚀 這個範例展示了完整的企業級計費工作流程');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ 每日計費流程失敗:', error);
      process.exit(1);
    });
}
