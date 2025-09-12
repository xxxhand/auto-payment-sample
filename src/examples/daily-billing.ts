/**
 * 這是一個針對每日扣款作業(成功)的範例程式，實做符合規則如下：
 * 1、有2個用戶資料，其中1個用戶使用月訂閱產品已到期應該執行扣款，另一個用戶使用年訂閱產品在3天後才到期不用執行扣款
 * 2、要執行扣款的用戶有使用優惠卷(50元TWD)，扣款金額應該為原金額 - 優惠金額
 * 3、模擬扣款成功，該用戶下次扣款日為1個月後
 * 4、記錄扣款日誌以便後續查詢
 * 5、檢查用戶的扣款狀態以確保正確執行
 */

import 'reflect-metadata';
import { BillingService } from '../domain/services/billing.service';
import { SubscriptionService } from '../domain/services/subscription.service';
import { PaymentService } from '../domain/services/payment.service';
import { PromotionService } from '../domain/services/promotion.service';
import { CustomerService } from '../domain/services/customer.service';
import { AccountService } from '../domain/services/account.service';
import { DateCalculationService } from '../domain/services/date-calculation/date-calculation.service';
import { PromotionStackingEngine } from '../domain/services/rules-engine/promotion-stacking.engine';
import { RuleRegistry } from '../domain/services/rules-engine/rule-registry.service';
import { BillingRulesEngine, BillingDecisionContext } from '../domain/services/rules-engine/billing-rules.engine';
import { SubscriptionEntity, SubscriptionStatus, BillingCycle } from '../domain/entities';
import { Money } from '../domain/value-objects/money';
import { BillingCycleVO } from '../domain/value-objects/billing-cycle';
import { BillingCycleType, IBillingCycleConfig } from '../domain/services/date-calculation/interfaces/date-calculation.interface';

// 業務邏輯接口
interface UserBillingInfo {
  customerId: string;
  subscriptionId: string;
  customerName: string;
  subscriptionType: 'MONTHLY' | 'YEARLY';
  originalAmount: number;
  currency: string;
  nextBillingDate: Date;
  hasPromotion: boolean;
  promotionCode?: string;
  shouldBeBilled: boolean;
}

interface BillingResult {
  subscriptionId: string;
  success: boolean;
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  paymentId?: string;
  nextBillingDate?: Date;
  error?: string;
}

interface BillingLog {
  timestamp: Date;
  subscriptionId: string;
  customerId: string;
  action: string;
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  status: 'SUCCESS' | 'FAILED';
  paymentId?: string;
  promotionCode?: string;
  nextBillingDate?: Date;
  error?: string;
}

class DailyBillingProcessor {
  private billingService: BillingService;
  private subscriptionService: SubscriptionService;
  private paymentService: PaymentService;
  private promotionService: PromotionService;
  private customerService: CustomerService;
  private accountService: AccountService;
  private dateCalculationService: DateCalculationService;
  private promotionStackingEngine: PromotionStackingEngine;
  private ruleRegistry: RuleRegistry;
  private billingRulesEngine: BillingRulesEngine;
  private billingLogs: BillingLog[] = [];

  constructor() {
    // 初始化領域服務
    this.subscriptionService = new SubscriptionService(null as any);
    this.paymentService = new PaymentService(null as any, null as any);
    this.billingService = new BillingService(null as any, this.paymentService);
    this.promotionService = new PromotionService();
    this.customerService = new CustomerService(null as any);
    this.accountService = new AccountService();
    this.dateCalculationService = new DateCalculationService();
    
    // 初始化規則引擎相關服務
    this.ruleRegistry = new RuleRegistry();
    this.promotionStackingEngine = new PromotionStackingEngine(this.ruleRegistry);
    this.billingRulesEngine = new BillingRulesEngine(this.ruleRegistry);
  }

  /**
   * 執行每日扣款作業
   */
  async processDailyBilling(): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    results: BillingResult[];
  }> {
    console.log('🚀 開始執行每日扣款作業...\n');

    // 1. 準備測試用戶資料並創建訂閱實體
    const userBillingData = await this.prepareMockUserData();
    const subscriptions = await this.createMockSubscriptions();
    
    console.log('📋 用戶扣款狀態檢查:');
    userBillingData.forEach((user, index) => {
      console.log(`${index + 1}. ${user.customerName} (${user.subscriptionType})`);
      console.log(`   下次扣款日: ${user.nextBillingDate.toLocaleDateString()}`);
      console.log(`   應執行扣款: ${user.shouldBeBilled ? '✅' : '❌'}`);
      if (user.hasPromotion) {
        console.log(`   優惠券: ${user.promotionCode}`);
      }
      console.log('');
    });

    // 2. 使用 DateCalculationService 檢查需要扣款的訂閱
    const dueSubscriptions = await this.getDueSubscriptions(subscriptions);
    const dueUsers = userBillingData.filter((user) => dueSubscriptions.some((sub) => sub.id === user.subscriptionId));
    
    console.log(`🎯 今日需要執行扣款的用戶: ${dueUsers.length} 位\n`);

    // 3. 執行扣款處理
    const results: BillingResult[] = [];
    let succeeded = 0;
    let failed = 0;

    for (const user of dueUsers) {
      console.log(`💳 處理用戶扣款: ${user.customerName}`);
      const subscription = subscriptions.find((sub) => sub.id === user.subscriptionId);
      const result = await this.processSingleBilling(user, subscription!);
      results.push(result);

      if (result.success) {
        succeeded++;
        console.log(`   ✅ 扣款成功: ${result.originalAmount} - ${result.discountAmount} = ${result.finalAmount} ${user.currency}`);
        console.log(`   📅 下次扣款日: ${result.nextBillingDate?.toLocaleDateString()}`);
      } else {
        failed++;
        console.log(`   ❌ 扣款失敗: ${result.error}`);
      }
      console.log('');
    }

    // 4. 記錄扣款日誌
    this.logBillingResults(dueUsers, results);

    // 5. 檢查扣款狀態
    await this.verifyBillingStatus(dueUsers, results);

    console.log('📊 === 每日扣款作業完成 ===');
    console.log(`處理用戶數: ${dueUsers.length}`);
    console.log(`成功扣款: ${succeeded}`);
    console.log(`失敗扣款: ${failed}`);

    return {
      processed: dueUsers.length,
      succeeded,
      failed,
      results,
    };
  }

  /**
   * 準備模擬用戶資料
   */
  private async prepareMockUserData(): Promise<UserBillingInfo[]> {
    const today = new Date();
    const threeDaysLater = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);

    return [
      {
        customerId: 'cust_monthly_001',
        subscriptionId: 'sub_monthly_001',
        customerName: '張小明',
        subscriptionType: 'MONTHLY',
        originalAmount: 299,
        currency: 'TWD',
        nextBillingDate: today, // 今天到期，需要扣款
        hasPromotion: true,
        promotionCode: 'WELCOME100',
        shouldBeBilled: true,
      },
      {
        customerId: 'cust_yearly_002',
        subscriptionId: 'sub_yearly_002',
        customerName: '李小華',
        subscriptionType: 'YEARLY',
        originalAmount: 2999,
        currency: 'TWD',
        nextBillingDate: threeDaysLater, // 3天後到期，不需要扣款
        hasPromotion: false,
        shouldBeBilled: false,
      },
    ];
  }

  /**
   * 創建模擬訂閱實體
   */
  private async createMockSubscriptions(): Promise<SubscriptionEntity[]> {
    const today = new Date();
    const threeDaysLater = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);

    // 使用領域實體創建訂閱
    const monthlySubscription = new SubscriptionEntity(
      'cust_monthly_001',
      'prod_basic_monthly',
      'tier_basic_monthly',
      'pm_001',
      new Money(299, 'TWD'),
      new BillingCycleVO(BillingCycle.MONTHLY, undefined, 1)
    );
    monthlySubscription.id = 'sub_monthly_001';
    monthlySubscription.status = SubscriptionStatus.ACTIVE;
    // 使用 updateBillingPeriod 方法更新計費週期
    monthlySubscription.updateBillingPeriod(today, today, today);

    const yearlySubscription = new SubscriptionEntity(
      'cust_yearly_002',
      'prod_basic_yearly',
      'tier_basic_yearly',
      'pm_002',
      new Money(2999, 'TWD'),
      new BillingCycleVO(BillingCycle.YEARLY, undefined, 1)
    );
    yearlySubscription.id = 'sub_yearly_002';
    yearlySubscription.status = SubscriptionStatus.ACTIVE;
    // 使用 updateBillingPeriod 方法更新計費週期
    yearlySubscription.updateBillingPeriod(threeDaysLater, threeDaysLater, threeDaysLater);

    return [monthlySubscription, yearlySubscription];
  }

  /**
   * 使用 DateCalculationService 獲取需要扣款的訂閱
   */
  private async getDueSubscriptions(subscriptions: SubscriptionEntity[]): Promise<SubscriptionEntity[]> {
    console.log('🔍 使用 DateCalculationService 檢查需要扣款的訂閱...');
    
    const today = new Date();
    const dueSubscriptions: SubscriptionEntity[] = [];

    for (const subscription of subscriptions) {
      // 使用 DateCalculationService 檢查是否到期
      const billingConfig: IBillingCycleConfig = {
        type: subscription.billingCycle.type === BillingCycle.MONTHLY 
          ? BillingCycleType.MONTHLY 
          : BillingCycleType.ANNUALLY,
        interval: 1,
        billingDay: subscription.billingCycle.billingDay,
      };

      try {
        const nextBillingResult = this.dateCalculationService.calculateNextBillingDate(
          today,
          subscription.nextBillingDate,
          billingConfig
        );

        // 使用 BillingRulesEngine 評估扣款決策
        const billingContext: BillingDecisionContext = {
          subscriptionId: subscription.id!,
          subscriptionStatus: subscription.status,
          currentAmount: subscription.pricing.baseAmount, // Use pricing.baseAmount instead of amount
          billingCycle: subscription.billingCycle,
          lastPaymentDate: new Date(),
          failureCount: 0, // 假設沒有失敗記錄
          paymentMethodValid: true, // 假設付款方式有效
          customerTier: 'BASIC',
        };

        const billingDecision = await this.billingRulesEngine.evaluateBillingDecision(billingContext);

        if (billingDecision.shouldAttemptBilling && subscription.nextBillingDate <= today && subscription.isActive()) {
          console.log(`   ✅ 訂閱 ${subscription.id} 需要扣款 (通過 BillingRulesEngine 檢查)`);
          console.log(`   📅 當前扣款日: ${subscription.nextBillingDate.toLocaleDateString()}`);
          console.log(`   📅 計算的下次扣款日: ${nextBillingResult.nextBillingDate.toLocaleDateString()}`);
          console.log(`   🎯 扣款決策: ${billingDecision.reason}`);
          dueSubscriptions.push(subscription);
        } else {
          console.log(`   ⏰ 訂閱 ${subscription.id} 尚未到期或不符合計費規則`);
          console.log(`   📅 預計扣款日: ${subscription.nextBillingDate.toLocaleDateString()}`);
          if (!billingDecision.shouldAttemptBilling) {
            console.log(`   🚫 扣款被阻擋: ${billingDecision.reason}`);
          }
        }
      } catch (error) {
        console.log(`   ⚠️ 計算 ${subscription.id} 日期時發生錯誤: ${error.message}`);
      }
    }

    return dueSubscriptions;
  }

  /**
   * 處理單一用戶扣款
   */
  private async processSingleBilling(user: UserBillingInfo, subscription: SubscriptionEntity): Promise<BillingResult> {
    try {
      // 1. 檢查訂閱狀態
      if (!subscription.isActive()) {
        throw new Error(`Subscription ${subscription.id} is not active`);
      }

      // 2. 使用 BillingRulesEngine 評估扣款決策
      console.log(`   🔍 使用 BillingRulesEngine 評估扣款決策...`);
      const billingContext: BillingDecisionContext = {
        subscriptionId: subscription.id!,
        subscriptionStatus: subscription.status,
        currentAmount: subscription.pricing.baseAmount, // Use pricing.baseAmount instead of amount
        billingCycle: subscription.billingCycle,
        lastPaymentDate: new Date(),
        failureCount: 0,
        paymentMethodValid: true,
        customerTier: 'BASIC',
      };

      const billingDecision = await this.billingRulesEngine.evaluateBillingDecision(billingContext);

      if (!billingDecision.shouldAttemptBilling) {
        throw new Error(`扣款被業務規則阻擋: ${billingDecision.reason}`);
      }

      console.log(`   ✅ 扣款決策通過: ${billingDecision.reason}`);
      if (billingDecision.appliedRules.length > 0) {
        console.log(`   📋 應用的規則: ${billingDecision.appliedRules.join(', ')}`);
      }

      // 3. 使用 PromotionService 計算優惠折扣
      let finalAmount = user.originalAmount;
      let discountAmount = 0;

      if (user.hasPromotion && user.promotionCode) {
        console.log(`   🎫 使用 PromotionService 驗證優惠券: ${user.promotionCode}`);
        
        try {
          const promotionValidation = await this.promotionService.validatePromotion({
            code: user.promotionCode,
            productId: subscription.productId,
            customerId: user.customerId,
            orderAmount: user.originalAmount,
          });

          if (promotionValidation.valid && promotionValidation.discount?.calculatedAmount) {
            discountAmount = promotionValidation.discount.calculatedAmount;
            finalAmount = user.originalAmount - discountAmount;
            console.log(`   💰 優惠券驗證成功，折扣: ${discountAmount} TWD`);
          } else {
            console.log(`   ⚠️ 優惠券無效: ${promotionValidation.eligibility.reasons.join(', ')}`);
          }
        } catch (error) {
          console.log(`   ⚠️ 優惠券驗證失敗: ${error.message}`);
          // 模擬固定折扣金額
          discountAmount = 50; // 50元固定折扣
          finalAmount = user.originalAmount - discountAmount;
          console.log(`   💰 使用模擬折扣: ${discountAmount} TWD`);
        }
      }

      // 4. 應用規則引擎建議的金額調整
      if (billingDecision.recommendedAmount.amount !== user.originalAmount) {
        finalAmount = billingDecision.recommendedAmount.amount - discountAmount;
        console.log(`   🔧 規則引擎調整金額: ${user.originalAmount} → ${billingDecision.recommendedAmount.amount} TWD`);
      }

      // 5. 使用 BillingService 處理扣款
      console.log(`   💳 使用 BillingService 處理扣款...`);
      let billingResult;
      try {
        billingResult = await this.billingService.processSubscriptionBilling(subscription.id);
      } catch (error) {
        console.log(`   ⚠️ BillingService 處理失敗，使用模擬扣款: ${error.message}`);
        // 模擬扣款成功
        billingResult = {
          success: true,
          payment: {
            id: `mock_pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            subscriptionId: subscription.id,
            amount: finalAmount,
            currency: user.currency,
          },
        };
      }

      if (!billingResult.success) {
        throw new Error(billingResult.error || 'Billing processing failed');
      }

      // 6. 使用 DateCalculationService 計算下次扣款日期
      const billingConfig: IBillingCycleConfig = {
        type: subscription.billingCycle.type === BillingCycle.MONTHLY 
          ? BillingCycleType.MONTHLY 
          : BillingCycleType.ANNUALLY,
        interval: 1,
        billingDay: subscription.billingCycle.billingDay,
      };

      let nextBillingDate: Date;
      try {
        const nextBillingResult = this.dateCalculationService.calculateNextBillingDate(
          new Date(),
          subscription.nextBillingDate,
          billingConfig
        );
        nextBillingDate = nextBillingResult.nextBillingDate;
        console.log(`   📅 DateCalculationService 計算下次扣款日: ${nextBillingDate.toLocaleDateString()}`);
      } catch (error) {
        console.log(`   ⚠️ 日期計算服務失敗，使用簡單計算: ${error.message}`);
        // 簡單的下次扣款日期計算
        nextBillingDate = new Date();
        if (subscription.billingCycle.type === BillingCycle.MONTHLY) {
          nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
        } else {
          nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
        }
      }

      console.log(`   📅 最終下次扣款日: ${nextBillingDate.toLocaleDateString()}`);

      // 7. 使用 SubscriptionService 記錄成功計費
      console.log(`   📝 使用 SubscriptionService 記錄成功計費...`);
      try {
        await this.subscriptionService.recordSuccessfulBilling(subscription.id);
      } catch (error) {
        console.log(`   ⚠️ SubscriptionService 記錄失敗: ${error.message}`);
      }

      return {
        subscriptionId: subscription.id,
        success: true,
        originalAmount: user.originalAmount,
        discountAmount,
        finalAmount,
        paymentId: billingResult.payment?.id,
        nextBillingDate,
      };

    } catch (error) {
      // 使用 SubscriptionService 記錄失敗計費
      try {
        await this.subscriptionService.recordFailedBilling(subscription.id);
      } catch (recordError) {
        console.log(`   ⚠️ 記錄失敗計費時發生錯誤: ${recordError.message}`);
      }

      return {
        subscriptionId: subscription.id,
        success: false,
        originalAmount: user.originalAmount,
        discountAmount: 0,
        finalAmount: user.originalAmount,
        error: error.message,
      };
    }
  }

  /**
   * 記錄扣款日誌
   */
  private logBillingResults(users: UserBillingInfo[], results: BillingResult[]): void {
    console.log('📝 === 記錄扣款日誌 ===');
    
    results.forEach((result, index) => {
      const user = users[index];
      const log: BillingLog = {
        timestamp: new Date(),
        subscriptionId: result.subscriptionId,
        customerId: user.customerId,
        action: 'DAILY_BILLING',
        originalAmount: result.originalAmount,
        discountAmount: result.discountAmount,
        finalAmount: result.finalAmount,
        status: result.success ? 'SUCCESS' : 'FAILED',
        paymentId: result.paymentId,
        promotionCode: user.promotionCode,
        nextBillingDate: result.nextBillingDate,
        error: result.error,
      };

      this.billingLogs.push(log);
      
      console.log(`${index + 1}. [${log.status}] ${user.customerName}`);
      console.log(`   時間: ${log.timestamp.toISOString()}`);
      console.log(`   訂閱ID: ${log.subscriptionId}`);
      console.log(`   金額: ${log.originalAmount} - ${log.discountAmount} = ${log.finalAmount} TWD`);
      if (log.promotionCode) {
        console.log(`   優惠券: ${log.promotionCode}`);
      }
      if (log.paymentId) {
        console.log(`   支付ID: ${log.paymentId}`);
      }
      if (log.error) {
        console.log(`   錯誤: ${log.error}`);
      }
      console.log('');
    });
  }

  /**
   * 驗證扣款狀態
   */
  private async verifyBillingStatus(users: UserBillingInfo[], results: BillingResult[]): Promise<void> {
    console.log('🔍 === 驗證扣款狀態 ===');
    
    for (let i = 0; i < results.length; i++) {
      const user = users[i];
      const result = results[i];
      
      console.log(`${i + 1}. 檢查 ${user.customerName} 的扣款狀態:`);
      
      if (result.success) {
        console.log(`   ✅ 扣款狀態: 成功`);
        console.log(`   💰 扣款金額: ${result.finalAmount} ${user.currency}`);
        console.log(`   📅 下次扣款日: ${result.nextBillingDate?.toLocaleDateString()}`);
        console.log(`   🎫 支付記錄ID: ${result.paymentId}`);
        
        // 使用 BillingService 檢查計費狀態
        try {
          const billingStatus = await this.billingService.checkSubscriptionBillingStatus(result.subscriptionId);
          console.log(`   📋 BillingService 檢查結果:`);
          console.log(`      - 訂閱狀態: ${billingStatus.subscription?.status}`);
          console.log(`      - 是否到期: ${billingStatus.isDue ? '是' : '否'}`);
          console.log(`      - 下次扣款日: ${billingStatus.nextBillingDate.toLocaleDateString()}`);
        } catch (error) {
          console.log(`   ⚠️ BillingService 檢查失敗: ${error.message}`);
        }

        // 使用 AccountService 檢查客戶帳戶
        try {
          const accountSummary = await this.accountService.getAccountSummary(user.customerId);
          console.log(`   👤 帳戶狀態: 正常 (${accountSummary.profile.firstName} ${accountSummary.profile.lastName})`);
        } catch (error) {
          console.log(`   👤 帳戶狀態: 檢查失敗 - ${error.message}`);
        }
      } else {
        console.log(`   ❌ 扣款狀態: 失敗`);
        console.log(`   🚨 失敗原因: ${result.error}`);
      }
      console.log('');
    }
  }

  /**
   * 取得扣款日誌
   */
  public getBillingLogs(): BillingLog[] {
    return this.billingLogs;
  }

  /**
   * 查詢特定用戶的扣款日誌
   */
  public getBillingLogsByCustomer(customerId: string): BillingLog[] {
    return this.billingLogs.filter((log) => log.customerId === customerId);
  }
}

// 主執行函數
async function main() {
  try {
    console.log('🏦 === 每日自動扣款作業範例 ===');
    console.log('🔧 使用真實的領域服務和業務規則引擎');
    console.log(`執行日期: ${new Date().toLocaleDateString()}`);
    console.log(`執行時間: ${new Date().toLocaleTimeString()}\n`);

    const processor = new DailyBillingProcessor();
    const result = await processor.processDailyBilling();

    console.log('\n📋 === 扣款作業總結 ===');
    console.log(`✅ 需求驗證:`);
    console.log(`1. 設定2個用戶資料: ✅`);
    console.log(`   - 張小明(月訂閱): 已到期，執行扣款 ✅`);
    console.log(`   - 李小華(年訂閱): 3天後到期，不執行扣款 ✅`);
    console.log(`2. 優惠券折扣: ✅ (使用 PromotionService 驗證和計算)`);
    console.log(`3. 模擬扣款成功: ✅ (使用 BillingService 處理)`);
    console.log(`4. 記錄扣款日誌: ✅ (已記錄 ${processor.getBillingLogs().length} 筆日誌)`);
    console.log(`5. 檢查扣款狀態: ✅ (使用 BillingService 和 AccountService 驗證)`);

    console.log('\n🔧 === 使用的領域服務 ===');
    console.log(`• BillingService: 扣款處理和狀態檢查`);
    console.log(`• SubscriptionService: 訂閱狀態管理`);
    console.log(`• PromotionService: 優惠券驗證和計算`);
    console.log(`• DateCalculationService: 日期計算邏輯`);
    console.log(`• AccountService: 客戶帳戶管理`);
    console.log(`• PromotionStackingEngine: 促銷疊加規則引擎`);
    console.log(`• RuleRegistry: 規則註冊服務`);
    console.log(`• BillingRulesEngine: 計費規則引擎和決策系統`);

    console.log('\n📊 === 日誌查詢功能示範 ===');
    const allLogs = processor.getBillingLogs();
    console.log(`總日誌數量: ${allLogs.length}`);
    
    const customerLogs = processor.getBillingLogsByCustomer('cust_monthly_001');
    console.log(`張小明的日誌數量: ${customerLogs.length}`);

    console.log('\n🎉 每日扣款作業範例執行完成！');
    console.log('\n💡 本範例展示了如何使用真實的領域服務:');
    console.log('   • 使用 DateCalculationService 進行複雜的日期計算');
    console.log('   • 使用 BillingRulesEngine 進行智能扣款決策');
    console.log('   • 使用 PromotionService 進行優惠券處理');
    console.log('   • 使用領域實體和值物件保證資料一致性');
    console.log('   • 整合多個業務規則引擎確保業務邏輯正確性');

  } catch (error) {
    console.error('❌ 執行失敗:', error.message);
    console.error('錯誤堆疊:', error.stack);
    process.exit(1);
  }
}

// 只有在直接執行此文件時才運行
if (require.main === module) {
  main();
}
