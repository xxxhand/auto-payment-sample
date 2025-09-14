/**
 * 這是一個針對每日扣款作業(複雜)的範例程式，實做符合規則如下：
 * - 有多個月付訂閱用戶，每個用戶有不同的訂閱方案和計費週期及優惠折扣
 * - 1個用戶使用月訂閱產品，已到期應該執行扣款，但因為信用卡過期導致扣款失敗，進入重試機制
 * - 1個用戶使用年訂閱產品，已到期應該執行扣款，且有使用折扣碼
 * - 1個用戶使用月訂閱產品，尚未到期不應該執行扣款
 * - 1個用戶使用月訂閱產品，已到期應該執行扣款，但因為沒有預設支付方式導致扣款失敗
 * - 1個用戶使用月訂閱產品，已到期應該執行扣款，沒有使用優惠碼，但有符合SUMMER2024優惠活動
 * - 1個用戶使用月訂閱產品，已到期應該執行扣款，沒有使用優惠碼，也沒有符合任何優惠活動
 * - 記錄扣款日誌以便後續查詢
 * - 檢查用戶的扣款狀態以確保正確執行
 * 重點展示如何使用 src/domain 下的業務服務與規則引擎：
 */

/**
      }
      this.results.push(result);
    }
    this.logger.log('每日帳單處理完畢。');
    this.printSummary(this.results);
  }

  private printSummary(results: ComplexBillingResult[]): void {
    this.logger.log('
' + '='.repeat(120));* 複雜每日帳單處理範例 - 完整企業級計費系統
 *
 * 本文件旨在展示一個全面的企業級自動付費系統，它將模擬處理以下六個核心業務情境：
 * 1. 信用卡到期處理：在計費前驗證付款方式的有效性。
 * 2. 折扣碼驗證與應用：支援用戶使用折扣碼並計算折扣。
 * 3. 計費週期判斷：準確判斷訂閱是否應在當前日期進行計費。
 * 4. 付款方式驗證：檢查用戶是否已綁定有效的付款方式。
 * 5. 自動促銷應用：為符合資格的用戶自動應用最優惠的促銷。
 * 6. 標準計費流程：在無特殊情況下執行標準的扣款流程。
 */

import { Injectable, Logger } from '@nestjs/common';
import { SubscriptionEntity } from '../domain/entities/subscription.entity';
import { Money } from '../domain/value-objects/money';
import { BillingCycleVO, BillingPeriod } from '../domain/value-objects/billing-cycle';
import { SubscriptionStatus, BillingCycle, PaymentFailureCategory } from '../domain/enums/codes.const';
import { PaymentProcessingResult } from '../domain/services/payment-processing.service';

// =============== 數據類型定義 (Data Models) ===============

interface ComplexBillingResult {
  subscriptionId: string;
  scenario: string;
  success: boolean;
  amount?: Money;
  finalAmount?: Money;
  discountApplied?: boolean;
  errorMessage?: string;
  nextBillingDate?: string;
  retryInfo?: string;
  processingDetails: {
    paymentResult?: PaymentProcessingResult;
  };
}

// =============== 模擬服務 (Mock Services) ===============

/**
 * 模擬訂閱服務 - 負責提供訂閱數據
 * NOTE: 此模擬服務的方法簽名已對齊真實的 `SubscriptionService`
 */
@Injectable()
class ComplexSubscriptionService {
  private readonly logger = new Logger(ComplexSubscriptionService.name);

  private subscriptions: SubscriptionEntity[] = [];

  constructor() {
    this.seedMockData();
  }

  private seedMockData(): void {
    const today = new Date().toISOString().split('T')[0];
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthStr = lastMonth.toISOString().split('T')[0];

    this.subscriptions = [
      // 情境6: 標準計費流程
      this.createMockSubscription('sub_standard', 'user_1', BillingCycle.MONTHLY, 500, lastMonthStr, 'pm_valid_card'),
      // 情境1: 信用卡過期
      this.createMockSubscription('sub_expired_card', 'user_2', BillingCycle.MONTHLY, 5000, lastMonthStr, 'pm_expired_card'),
      // 情境2: 使用折扣碼 (應成功)
      this.createMockSubscription('sub_discount_code', 'user_6', BillingCycle.YEARLY, 6000, '2023-09-14', 'pm_valid_card', SubscriptionStatus.ACTIVE, 'plan_yearly_discount'),
      // 新增情境: 餘額不足
      this.createMockSubscription('sub_insufficient_funds', 'user_8', BillingCycle.MONTHLY, 5800, lastMonthStr, 'pm_valid_card'),
      // 情境4: 無付款方式
      this.createMockSubscription('sub_no_payment', 'user_3', BillingCycle.MONTHLY, 300, lastMonthStr, null),
      // 情境5: 自動促銷
      this.createMockSubscription('sub_auto_promo', 'user_4', BillingCycle.MONTHLY, 1200, lastMonthStr, 'pm_valid_card'),
      // 案例 6: 適用自動促銷的自動續訂
      this.createMockSubscription('sub_auto_best_promo', 'user_7', BillingCycle.MONTHLY, 1200, lastMonthStr, 'pm_valid_card'),
      // 情境3: 未到期
      this.createMockSubscription('sub_not_due', 'user_5', BillingCycle.MONTHLY, 500, today, 'pm_valid_card'),
    ];
  }

  private createMockSubscription(
    subscriptionId: string,
    customerId: string,
    period: BillingCycle,
    amount: number,
    startDate: string,
    paymentMethodId: string | null,
    status: SubscriptionStatus = SubscriptionStatus.ACTIVE,
    planId?: string,
  ): SubscriptionEntity {
    const billingCycleVO = new BillingCycleVO(period);
    const baseAmount = new Money(amount, 'TWD');
    const effectivePlanId = planId || `plan_${period.toLowerCase()}`;

    const subscription = new SubscriptionEntity(customerId, `prod_${effectivePlanId}`, effectivePlanId, paymentMethodId || 'pm_default_mock', baseAmount, billingCycleVO);

    subscription.subscriptionId = subscriptionId;
    subscription.startDate = new Date(startDate);
    subscription.status = status;

    // 初始化重試狀態
    subscription.retryState = {
      retryCount: 0,
      maxRetries: 3,
      gracePeriodExtensions: 0,
      maxGraceExtensions: 1,
    };

    if (paymentMethodId === null) {
      subscription.paymentMethodId = '';
    }

    if (subscriptionId === 'sub_not_due') {
      // 此訂閱不應到期，結束日期設為明天
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      subscription.currentPeriod = new BillingPeriod(new Date(), tomorrow);
    } else {
      // 其他訂閱應於今天到期，因此結束日期設為昨天
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const oneMonthBeforeYesterday = new Date(yesterday);
      oneMonthBeforeYesterday.setMonth(oneMonthBeforeYesterday.getMonth() - 1);

      subscription.currentPeriod = new BillingPeriod(oneMonthBeforeYesterday, yesterday);
    }

    // 為了兼容性，手動設定 productName
    (subscription as any).productName = `產品 - ${effectivePlanId}`;

    return subscription;
  }

  /**
   * @method getSubscriptionsDueForBilling
   * @description 獲取需要計費的訂閱 (對齊 SubscriptionService)
   */
  async getSubscriptionsDueForBilling(): Promise<SubscriptionEntity[]> {
    this.logger.log(`正在獲取今日到期的所有訂閱...`);
    const today = new Date();
    return this.subscriptions.filter((sub) => sub.currentPeriod.isExpired(today));
  }

  async getSubscriptionById(subscriptionId: string): Promise<SubscriptionEntity | undefined> {
    return this.subscriptions.find((s) => s.subscriptionId === subscriptionId);
  }

  /**
   * @method recordSuccessfulBilling
   * @description 記錄成功計費 (對齊 SubscriptionService)
   */
  async recordSuccessfulBilling(subscriptionId: string): Promise<void> {
    this.logger.log(`[DB-SIM] 記錄訂閱 ${subscriptionId} 付款成功。`);
    const sub = this.subscriptions.find((s) => s.subscriptionId === subscriptionId);
    if (sub) {
      // 模擬更新計費週期
      const { startDate, endDate } = sub.billingCycle.calculateBillingPeriod(sub.currentPeriod.endDate);
      sub.currentPeriod = new BillingPeriod(startDate, endDate);
      this.logger.log(`[DB-SIM] 訂閱 ${subscriptionId} 的計費週期已更新。下次扣款日期: ${endDate.toISOString().split('T')[0]}`);
      // 重置重試狀態
      sub.retryState.retryCount = 0;
      sub.retryState.nextRetryDate = undefined;
      sub.status = SubscriptionStatus.ACTIVE;
    }
  }

  /**
   * @method recordFailedBilling
   * @description 記錄失敗計費 (對齊 SubscriptionService)
   */
  async recordFailedBilling(subscriptionId: string, paymentResult: PaymentProcessingResult): Promise<void> {
    this.logger.error(`[DB-SIM] 處理訂閱 ${subscriptionId} 付款失敗，原因: ${paymentResult.errorMessage}`);
    const sub = this.subscriptions.find((s) => s.subscriptionId === subscriptionId);
    if (!sub) return;

    if (paymentResult.isRetriable && sub.retryState.retryCount < sub.retryState.maxRetries) {
      sub.status = SubscriptionStatus.PAST_DUE;
      sub.retryState.retryCount += 1;
      const nextRetryDate = new Date();
      nextRetryDate.setDate(nextRetryDate.getDate() + 3); // 模擬3天後重試
      sub.retryState.nextRetryDate = nextRetryDate;
      sub.retryState.lastFailureDate = new Date();
      this.logger.log(`[DB-SIM] 訂閱 ${subscriptionId} 狀態更新為 ${SubscriptionStatus.PAST_DUE}，第 ${sub.retryState.retryCount} 次重試已排程於 ${nextRetryDate.toISOString().split('T')[0]}。`);
    } else {
      sub.status = SubscriptionStatus.CANCELED;
      this.logger.warn(`[DB-SIM] 訂閱 ${subscriptionId} 付款失敗且不可重試(或已達最大重試次數)。訂閱已取消。`);
    }
  }
}

/**
 * 模擬付款處理服務 - 負責處理金流
 * NOTE: 此模擬服務的方法簽名已對齊真實的 `PaymentProcessingService`
 */
@Injectable()
class ComplexPaymentProcessingService {
  private readonly logger = new Logger(ComplexPaymentProcessingService.name);

  /**
   * @method processPayment
   * @description 處理支付 (對齊 PaymentProcessingService)
   * @param paymentId - 在此範例中，我們使用 subscriptionId 作為 paymentId
   * @param paymentMethodId
   * @param amount
   */
  async processPayment(paymentId: string, paymentMethodId: string, amount: Money): Promise<PaymentProcessingResult> {
    this.logger.log(`處理支付: paymentId=${paymentId}, paymentMethodId=${paymentMethodId}, amount=${amount.format()}`);

    // 模擬支付方式驗證
    if (paymentMethodId === 'pm_expired_card') {
      return {
        success: false,
        errorMessage: '信用卡已過期',
        failureCategory: PaymentFailureCategory.NON_RETRIABLE,
        isRetriable: false,
      };
    }

    if (!paymentMethodId) {
      return {
        success: false,
        errorMessage: '無效的付款方式ID',
        failureCategory: PaymentFailureCategory.NON_RETRIABLE,
        isRetriable: false,
      };
    }

    // 模擬支付處理
    this.logger.log(`處理用戶的付款，金額: ${amount.format()}`);
    if (amount.isGreaterThan(new Money(5500, 'TWD'))) {
      return {
        success: false,
        errorMessage: '帳戶餘額不足',
        failureCategory: PaymentFailureCategory.DELAYED_RETRY,
        isRetriable: true,
      };
    }

    return {
      success: true,
      transactionId: `txn_${Date.now()}`,
    };
  }
}

/**
 * 模擬促銷服務 - 負責處理折扣與促銷
 * NOTE: 此模擬服務的方法簽名已對齊真實的 `PromotionService`
 */
@Injectable()
class ComplexPromotionService {
  private readonly logger = new Logger(ComplexPromotionService.name);

  /**
   * @method validatePromotion
   * @description 驗證優惠碼 (對齊 PromotionService)
   */
  async validatePromotion(request: { code: string; productId: string; customerId: string; orderAmount?: number }): Promise<{
    valid: boolean;
    discount?: { calculatedAmount?: number };
  }> {
    this.logger.log(`驗證折扣碼 ${request.code}，訂閱ID: ${request.customerId}`);
    if (request.code === 'SAVE20' && request.orderAmount) {
      const discountAmount = new Money(request.orderAmount, 'TWD').multiply(0.2);
      return {
        valid: true,
        discount: {
          calculatedAmount: discountAmount.amount,
        },
      };
    }
    return { valid: false };
  }

  /**
   * @method autoApplyBestPromotion
   * @description 自動應用最佳優惠 (對齊 PromotionService)
   */
  async autoApplyBestPromotion(request: { productId: string; customerId: string; orderAmount: number }): Promise<{
    appliedPromotion?: any;
    finalAmount: number;
  }> {
    this.logger.log(`為客戶 ${request.customerId} 尋找最佳自動促銷`);
    const amount = new Money(request.orderAmount, 'TWD');
    if (amount.isGreaterOrEqual(new Money(1000, 'TWD'))) {
      const discountAmount = new Money(150, 'TWD');
      return {
        appliedPromotion: {
          description: '消費滿千折150',
        },
        finalAmount: amount.subtract(discountAmount).amount,
      };
    }
    return {
      finalAmount: amount.amount,
    };
  }
}

/**
 * 模擬業務規則引擎 - 負責執行高階業務規則
 * NOTE: 此模擬服務的方法簽名已對齊真實的 `BillingRulesEngine`
 */
@Injectable()
class ComplexBillingRulesEngine {
  private readonly logger = new Logger(ComplexBillingRulesEngine.name);

  /**
   * @method evaluateBillingDecision
   * @description 評估扣款決策 (對齊 BillingRulesEngine)
   */
  async evaluateBillingDecision(context: any): Promise<{ shouldAttemptBilling: boolean; reason: string }> {
    this.logger.log(`評估訂閱 ${context.subscriptionId} 的計費決策`);

    if (!context.paymentMethodValid) {
      return {
        shouldAttemptBilling: false,
        reason: '無效的付款方式',
      };
    }

    // 在此範例中，我們總是嘗試計費
    return {
      shouldAttemptBilling: true,
      reason: '符合標準計費條件',
    };
  }
}

// =============== 核心處理器 (Core Processor) ===============

@Injectable()
export class ComplexDailyBillingProcessor {
  private readonly logger = new Logger(ComplexDailyBillingProcessor.name);
  private results: ComplexBillingResult[] = [];

  constructor(
    private readonly subscriptionService: ComplexSubscriptionService,
    private readonly paymentService: ComplexPaymentProcessingService,
    private readonly promotionService: ComplexPromotionService,
    private readonly rulesEngine: ComplexBillingRulesEngine,
  ) {}

  async processBillingForDate(targetDate: Date): Promise<void> {
    this.logger.log(`開始處理 ${targetDate.toISOString().split('T')[0]} 的每日帳單...`);

    const dueSubscriptions = await this.subscriptionService.getSubscriptionsDueForBilling();

    this.logger.log(`找到 ${dueSubscriptions.length} 個到期訂閱，開始處理...`);

    for (const subscription of dueSubscriptions) {
      this.logger.log(`處理訂閱 ${subscription.subscriptionId}，客戶ID: ${subscription.customerId}`);

      // 1. 規則引擎決策
      const billingDecisionContext = {
        subscriptionId: subscription.subscriptionId,
        subscriptionStatus: subscription.status,
        currentAmount: subscription.pricing.baseAmount,
        billingCycle: subscription.billingCycle, // 修正: billingCycle 直接在 subscription 物件下
        failureCount: subscription.retryState.retryCount, // 修正: 使用 retryState.retryCount
        paymentMethodValid: !!subscription.paymentMethodId && subscription.paymentMethodId !== 'pm_expired_card',
      };
      const decision = await this.rulesEngine.evaluateBillingDecision(billingDecisionContext);

      if (!decision.shouldAttemptBilling) {
        this.logger.warn(`訂閱 ${subscription.subscriptionId} 被規則引擎跳過，原因: ${decision.reason}`);
        this.results.push({
          subscriptionId: subscription.subscriptionId,
          scenario: '規則引擎跳過',
          success: false,
          errorMessage: decision.reason,
          processingDetails: {},
        });
        continue;
      }

      let finalAmount = subscription.pricing.baseAmount;
      let discountApplied = false;
      let scenario = '標準計費';

      // 2. 處理折扣碼和自動促銷
      if (subscription.subscriptionId === 'sub_discount_code') {
        scenario = '折扣碼計費';
        const promoRequest = {
          code: 'SAVE20',
          productId: subscription.productId,
          customerId: subscription.customerId,
          orderAmount: finalAmount.amount,
        };
        const discountResult = await this.promotionService.validatePromotion(promoRequest);
        if (discountResult.valid && discountResult.discount?.calculatedAmount) {
          finalAmount = new Money(finalAmount.amount - discountResult.discount.calculatedAmount, 'TWD');
          this.logger.log(`訂閱 ${subscription.subscriptionId} 套用折扣碼成功，折扣後金額: ${finalAmount.format()}`);
          discountApplied = true;
        }
      } else if (subscription.subscriptionId === 'sub_auto_best_promo') {
        scenario = '自動促銷計費';
        const promoRequest = {
          productId: subscription.productId,
          customerId: subscription.customerId,
          orderAmount: finalAmount.amount,
        };
        const promotionResult = await this.promotionService.autoApplyBestPromotion(promoRequest);
        if (promotionResult.appliedPromotion) {
          finalAmount = new Money(promotionResult.finalAmount, 'TWD');
          this.logger.log(`訂閱 ${subscription.subscriptionId} 套用自動促銷成功，折扣後金額: ${finalAmount.format()}`);
          discountApplied = true;
        }
      }

      // 根據 subscriptionId 分配其他情境
      switch (subscription.subscriptionId) {
        case 'sub_expired_card':
          scenario = '信用卡過期';
          break;
        case 'sub_insufficient_funds':
          scenario = '餘額不足';
          break;
        case 'sub_no_payment':
          scenario = '無付款方式';
          break;
        case 'sub_auto_promo':
          scenario = '標準計費(高單價)';
          break;
      }

      // 3. 執行支付
      const paymentResult = await this.paymentService.processPayment(subscription.subscriptionId, subscription.paymentMethodId, finalAmount);

      const result: ComplexBillingResult = {
        subscriptionId: subscription.subscriptionId,
        scenario,
        success: paymentResult.success,
        amount: subscription.pricing.baseAmount,
        finalAmount: finalAmount,
        discountApplied,
        errorMessage: paymentResult.errorMessage,
        processingDetails: {
          paymentResult,
        },
      };

      // 4. 更新訂閱狀態並獲取最新資訊
      if (paymentResult.success) {
        this.logger.log(`訂閱 ${subscription.subscriptionId} 付款成功，交易ID: ${paymentResult.transactionId}`);
        await this.subscriptionService.recordSuccessfulBilling(subscription.subscriptionId);
      } else {
        this.logger.error(`訂閱 ${subscription.subscriptionId} 付款失敗，原因: ${paymentResult.errorMessage}`);
        await this.subscriptionService.recordFailedBilling(subscription.subscriptionId, paymentResult);
      }

      // 獲取更新後的訂閱狀態以用於報告
      const updatedSub = await this.subscriptionService.getSubscriptionById(subscription.subscriptionId);
      if (updatedSub) {
        if (updatedSub.status === SubscriptionStatus.ACTIVE && result.success) {
          // 成功付款後狀態應為 ACTIVE
          result.nextBillingDate = updatedSub.currentPeriod.endDate.toISOString().split('T')[0];
        } else if (updatedSub.status === SubscriptionStatus.PAST_DUE && updatedSub.retryState.nextRetryDate) {
          result.retryInfo = `第 ${updatedSub.retryState.retryCount} 次，下次 ${updatedSub.retryState.nextRetryDate.toISOString().split('T')[0]}`;
        }
      }

      this.results.push(result);
    }
    this.logger.log('每日帳單處理完畢。');
    this.printSummary(this.results);
  }

  private printSummary(results: ComplexBillingResult[]): void {
    this.logger.log('\\n' + '='.repeat(120));
    this.logger.log(' '.repeat(50) + '每日帳單摘要報告');
    this.logger.log('='.repeat(120));

    const table = results.map((r) => ({
      訂閱ID: r.subscriptionId,
      情境: r.scenario,
      結果: r.success ? '✅ 成功' : '❌ 失敗',
      原始金額: r.amount?.format() || 'N/A',
      最終金額: r.finalAmount?.format() || 'N/A',
      折扣: r.discountApplied ? '是' : '否',
      下次扣款日: r.nextBillingDate || '-',
      重試資訊: r.retryInfo || '-',
      錯誤訊息: r.errorMessage || '-',
    }));

    console.table(table);

    this.logger.log('='.repeat(120) + '\\n');
  }
}

// =============== 執行入口 (Execution Entry Point) ===============

/**
 * 主執行函數
 */
async function main() {
  const logger = new Logger('BillingRunner');
  logger.log('初始化計費服務...');

  const subscriptionService = new ComplexSubscriptionService();
  const paymentService = new ComplexPaymentProcessingService();
  const promotionService = new ComplexPromotionService();
  const rulesEngine = new ComplexBillingRulesEngine();

  const billingProcessor = new ComplexDailyBillingProcessor(subscriptionService, paymentService, promotionService, rulesEngine);

  const targetDate = new Date();
  logger.log(`設定目標日期: ${targetDate.toISOString().split('T')[0]}`);

  await billingProcessor.processBillingForDate(targetDate);

  logger.log('計費流程執行完畢。');
}

// 執行主函數
main().catch((error) => {
  console.error('執行計費演示時發生錯誤:', error);
  process.exit(1);
});
