import { Injectable } from '@nestjs/common';
// ...existing imports...
import { BillingRulesEngine } from '../domain/services/rules-engine/billing-rules.engine';
import { DateCalculationService } from '../domain/services/date-calculation/date-calculation.service';
import { SubscriptionService } from '../domain/services/subscription.service';
import { SubscriptionEntity } from '../domain/entities/subscription.entity';
import { PaymentEntity } from '../domain/entities/payment.entity';
import { PaymentMethodEntity } from '../domain/entities/payment-method.entity';
import { BillingAttemptEntity } from '../domain/entities/billing-attempt.entity';
import { Money } from '../domain/value-objects/money';
import { BillingPeriod } from '../domain/value-objects/billing-cycle';
import { BillingAttemptType, BillingAttemptStatus, PaymentMethodType, PaymentFailureCategory } from '../domain/enums/codes.const';

/**
 * 每日扣款範例 - 使用真實的領域服務
 * 這個範例展示如何使用 src/domain 下的業務邏輯進行每日自動扣款處理
 */
@Injectable()
export class DailyBillingExample {
  constructor(
    private readonly billingRulesEngine: BillingRulesEngine,
    private readonly dateCalculationService: DateCalculationService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  /**
   * 執行每日扣款作業
   */
  async executeDailyBilling(): Promise<void> {
    console.log('開始執行每日扣款作業...');

    try {
      // 1. 建立測試資料
      const testData = this.createTestData();
      
      // 2. 處理需要扣款的訂閱
      for (const subscription of testData.subscriptions) {
        await this.processBillingForSubscription(subscription, testData.paymentMethods);
      }

      console.log('每日扣款作業完成！');
    } catch (error) {
      console.error('每日扣款作業執行失敗:', error);
      throw error;
    }
  }

  /**
   * 為特定訂閱處理扣款
   */
  private async processBillingForSubscription(subscription: SubscriptionEntity, paymentMethods: PaymentMethodEntity[]): Promise<void> {
    console.log(`\n處理訂閱: ${subscription.subscriptionId}`);
    console.log(`客戶ID: ${subscription.customerId}`);
    console.log(`方案: ${subscription.planId}`);
    console.log(`狀態: ${subscription.status}`);

    try {
      // 1. 檢查是否需要計費
      const needsBilling = this.checkIfNeedsBilling(subscription);
      if (!needsBilling) {
        console.log('  → 跳過：此訂閱目前不需要計費');
        return;
      }

      // 2. 使用業務規則引擎評估計費決策
      const billingContext = {
        subscriptionId: subscription.subscriptionId,
        subscriptionStatus: subscription.status,
        currentAmount: new Money(subscription.amount, subscription.currency),
        billingCycle: subscription.billingCycle,
        lastPaymentDate: new Date(),
        failureCount: subscription.consecutiveFailures,
        paymentMethodValid: true,
        customerTier: 'BASIC',
      };
      
      const billingDecision = await this.billingRulesEngine.evaluateBillingDecision(billingContext);
      if (!billingDecision.shouldAttemptBilling) {
        console.log(`  → 跳過：計費決策阻擋 - ${billingDecision.reason}`);
        return;
      }

      // 3. 計算計費金額（使用領域服務）
      const billingAmount = subscription.calculateCurrentPeriodAmount();
      console.log(`  → 計費金額: ${billingAmount.amount} ${billingAmount.currency}`);

      // 4. 取得支付方式
      const paymentMethod = paymentMethods.find((pm) => pm.id === subscription.paymentMethodId);
      if (!paymentMethod || !paymentMethod.isAvailable()) {
        console.log('  → 跳過：支付方式不可用');
        return;
      }

      // 5. 建立計費嘗試記錄
      const billingAttempt = this.createBillingAttempt(subscription, paymentMethod, billingAmount);
      console.log(`  → 建立計費嘗試: ${billingAttempt.id}`);

      // 6. 建立付款實體
      const payment = this.createPayment(subscription, paymentMethod, billingAmount);
      
      // 7. 執行支付處理
      const paymentResult = await this.processPayment(payment, paymentMethod, billingAttempt);
      
      // 8. 根據支付結果更新訂閱狀態
      await this.updateSubscriptionBasedOnPaymentResult(subscription, paymentResult, billingAttempt);
    } catch (error) {
      console.error(`  → 處理訂閱 ${subscription.subscriptionId} 時發生錯誤:`, error);
    }
  }

  /**
   * 檢查訂閱是否需要計費
   */
  private checkIfNeedsBilling(subscription: SubscriptionEntity): boolean {
    // 使用實體的業務邏輯方法
    return subscription.needsBilling();
  }

  /**
   * 建立計費嘗試記錄
   */
  private createBillingAttempt(subscription: SubscriptionEntity, paymentMethod: PaymentMethodEntity, amount: Money): BillingAttemptEntity {
    return new BillingAttemptEntity(
      subscription.subscriptionId,
      subscription.customerId,
      `payment_${Date.now()}`, // 暫時的付款ID
      paymentMethod.id,
      amount,
      subscription.currentPeriodStart,
      subscription.currentPeriodEnd,
      BillingAttemptType.SCHEDULED,
    );
  }

  /**
   * 建立付款實體
   */
  private createPayment(subscription: SubscriptionEntity, paymentMethod: PaymentMethodEntity, amount: Money): PaymentEntity {
    return new PaymentEntity(
      subscription.subscriptionId,
      subscription.customerId,
      paymentMethod.id,
      amount.amount,
      subscription.currentPeriodStart,
      subscription.currentPeriodEnd,
      amount.currency,
    );
  }

  /**
   * 處理支付
   */
  private async processPayment(payment: PaymentEntity, paymentMethod: PaymentMethodEntity, billingAttempt: BillingAttemptEntity): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`  → 開始支付處理...`);
      
      // 更新計費嘗試狀態
      billingAttempt.status = BillingAttemptStatus.PROCESSING;
      
      // 標記付款為處理中
      payment.markAsProcessing(`provider_${Date.now()}`);
      
      // 模擬支付處理 (在真實環境中會調用實際的支付服務)
      const mockResult = await this.simulatePaymentProcessing(payment, paymentMethod);

      if (mockResult.success) {
        // 成功支付
        payment.markAsSucceeded(mockResult.transactionId);
        billingAttempt.status = BillingAttemptStatus.SUCCEEDED;
        console.log(`  → 支付成功: ${mockResult.transactionId}`);
        return { success: true };
      } else {
        // 支付失敗
        payment.markAsFailed({
          errorCode: mockResult.errorCode || 'UNKNOWN_ERROR',
          errorMessage: mockResult.errorMessage || '支付失敗',
          category: mockResult.failureCategory || PaymentFailureCategory.RETRIABLE,
          isRetriable: mockResult.isRetriable || false,
        });
        billingAttempt.status = BillingAttemptStatus.FAILED;
        console.log(`  → 支付失敗: ${mockResult.errorMessage}`);
        return { success: false, error: mockResult.errorMessage };
      }
    } catch (error) {
      console.error(`  → 支付處理異常:`, error);
      payment.markAsFailed({
        errorCode: 'PROCESSING_ERROR',
        errorMessage: error.message,
        category: PaymentFailureCategory.NON_RETRIABLE,
        isRetriable: false,
      });
      billingAttempt.status = BillingAttemptStatus.FAILED;
      return { success: false, error: error.message };
    }
  }

  /**
   * 模擬支付處理 (僅用於範例)
   */
  private async simulatePaymentProcessing(
    payment: PaymentEntity,
    paymentMethod: PaymentMethodEntity,
  ): Promise<{
    success: boolean;
    transactionId?: string;
    errorCode?: string;
    errorMessage?: string;
    failureCategory?: PaymentFailureCategory;
    isRetriable?: boolean;
  }> {
    // 模擬支付處理延遲
    await new Promise((resolve) => setTimeout(resolve, 100));
    
    // 記錄支付信息 (避免未使用參數警告)
    console.log(`處理支付: ${payment.id} 使用支付方式: ${paymentMethod.id}`);
    
    // 90% 成功率
    const isSuccess = Math.random() > 0.1;
    
    if (isSuccess) {
      return {
        success: true,
        transactionId: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };
    } else {
      return {
        success: false,
        errorCode: 'CARD_DECLINED',
        errorMessage: '信用卡被拒絕',
        failureCategory: PaymentFailureCategory.RETRIABLE,
        isRetriable: true,
      };
    }
  }

  /**
   * 根據支付結果更新訂閱狀態
   */
  private async updateSubscriptionBasedOnPaymentResult(
    subscription: SubscriptionEntity,
    paymentResult: { success: boolean; error?: string },
    billingAttempt: BillingAttemptEntity,
  ): Promise<void> {
    console.log(`Processing billing attempt: ${billingAttempt.id}`);
    
    if (paymentResult.success) {
      // 支付成功 - 重置重試狀態並推進到下一個計費週期
      subscription.resetRetryState();
      subscription.advanceToNextBillingCycle();
      subscription.recordSuccessfulBilling();
      
      console.log(`  → 訂閱狀態已更新，下次計費日期: ${subscription.nextBillingDate.toISOString()}`);
    } else {
      // 支付失敗 - 記錄失敗並檢查重試邏輯
      subscription.recordFailedBilling();
      
      if (subscription.canRetry()) {
        // 可以重試
        const nextRetryDate = this.calculateNextRetryDate(subscription.retryState.retryCount + 1);
        
        subscription.enterRetryState(nextRetryDate);
        console.log(`  → 支付失敗，將於 ${nextRetryDate.toISOString()} 重試`);
      } else {
        // 不能重試 - 進入寬限期或過期
        const gracePeriodEnd = this.calculateGracePeriodEnd(new Date());
        
        if (subscription.retryState.gracePeriodExtensions < subscription.retryState.maxGraceExtensions) {
          subscription.enterGracePeriod(gracePeriodEnd);
          console.log(`  → 進入寬限期，結束日期: ${gracePeriodEnd.toISOString()}`);
        } else {
          subscription.markExpired('重試次數已達上限且寬限期已結束');
          console.log(`  → 訂閱已過期`);
        }
      }
    }
  }

  /**
   * 計算下次重試日期
   */
  private calculateNextRetryDate(retryCount: number): Date {
    // 簡單的重試策略：第1天、第3天、第7天
    const retryDays = [1, 3, 7];
    const days = retryDays[Math.min(retryCount - 1, retryDays.length - 1)];
    
    const nextRetryDate = new Date();
    nextRetryDate.setDate(nextRetryDate.getDate() + days);
    return nextRetryDate;
  }

  /**
   * 計算寬限期結束日期
   */
  private calculateGracePeriodEnd(startDate: Date): Date {
    const gracePeriodEnd = new Date(startDate);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7); // 7天寬限期
    return gracePeriodEnd;
  }

  /**
   * 建立測試資料
   */
  private createTestData(): {
    subscriptions: SubscriptionEntity[];
    paymentMethods: PaymentMethodEntity[];
  } {
    // 建立測試用的支付方式
    const paymentMethods = [
      this.createTestPaymentMethod('pm_001', 'cust_001', '信用卡 **** 1234'),
      this.createTestPaymentMethod('pm_002', 'cust_002', '信用卡 **** 5678'),
      this.createTestPaymentMethod('pm_003', 'cust_003', '信用卡 **** 9012'),
    ];

    // 建立測試用的訂閱
    const subscriptions = [
      this.createTestSubscription('cust_001', 'pm_001', '基礎方案', 299, 'monthly'),
      this.createTestSubscription('cust_002', 'pm_002', '進階方案', 599, 'monthly'),
      this.createTestSubscription('cust_003', 'pm_003', '專業方案', 999, 'monthly'),
    ];

    return { subscriptions, paymentMethods };
  }

  /**
   * 建立測試用支付方式
   */
  private createTestPaymentMethod(id: string, customerId: string, name: string): PaymentMethodEntity {
    const paymentMethod = new PaymentMethodEntity(customerId, PaymentMethodType.CREDIT_CARD, name);
    paymentMethod.id = id;
    paymentMethod.setAsDefault();
    return paymentMethod;
  }

  /**
   * 建立測試用訂閱
   */
  private createTestSubscription(customerId: string, paymentMethodId: string, planName: string, amount: number, billingCycle: string): SubscriptionEntity {
    const subscription = new SubscriptionEntity(customerId, paymentMethodId, planName, amount, billingCycle);
    
    // 設定為活躍狀態
    subscription.activate();
    
    // 模擬已經過了計費週期，需要計費
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 31); // 31天前開始
    subscription.currentPeriod = new BillingPeriod(
      pastDate,
      new Date(), // 今天結束，需要計費
    );
    
    return subscription;
  }

  /**
   * 展示訂閱狀態摘要
   */
  displaySubscriptionSummary(subscription: SubscriptionEntity): void {
    console.log(`\n=== 訂閱摘要 ===`);
    console.log(`訂閱ID: ${subscription.subscriptionId}`);
    console.log(`客戶ID: ${subscription.customerId}`);
    console.log(`方案: ${subscription.planId}`);
    console.log(`狀態: ${subscription.status}`);
    console.log(`金額: ${subscription.amount} ${subscription.currency}`);
    console.log(`計費週期: ${subscription.billingCycle.displayName}`);
    console.log(`當前週期: ${subscription.currentPeriodStart.toISOString()} - ${subscription.currentPeriodEnd.toISOString()}`);
    console.log(`下次計費: ${subscription.nextBillingDate.toISOString()}`);
    console.log(`重試次數: ${subscription.consecutiveFailures}`);
    console.log(`是否可重試: ${subscription.canRetry()}`);
    console.log(`是否需要計費: ${subscription.needsBilling()}`);
    console.log(`是否即將到期: ${subscription.isExpiringSoon()}`);
  }
}
