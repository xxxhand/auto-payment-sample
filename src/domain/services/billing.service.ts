import { Injectable } from '@nestjs/common';
import { SubscriptionEntity } from '../entities';
import { PaymentEntity } from '../entities';
import { SubscriptionRepository } from '../../infra/repositories/subscription.repository';
import { PaymentService } from './payment.service';
import { SubscriptionService } from './subscription.service';
import { CustomDefinition } from '@xxxhand/app-common';
import { BillingRulesEngine } from './rules-engine/billing-rules.engine';
import { RetryStrategyEngine } from './rules-engine/retry-strategy.engine';
import { PaymentMethodRepository } from '../../infra/repositories/payment-method.repository';
import { Money } from '../value-objects/money';
import { PaymentFailureCategory, SubscriptionStatus } from '../enums/codes.const';

/**
 * 計費處理服務
 * 負責訂閱計費邏輯、帳單生成和支付協調
 */
@Injectable()
export class BillingService {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly paymentService: PaymentService,
    private readonly subscriptionService: SubscriptionService,
    private readonly billingRulesEngine: BillingRulesEngine,
    private readonly retryStrategyEngine: RetryStrategyEngine,
    private readonly paymentMethodRepository: PaymentMethodRepository,
  ) {}

  /**
   * 為訂閱創建支付記錄並執行計費
   */
  public async processSubscriptionBilling(subscriptionId: string): Promise<{
    success: boolean;
    payment?: PaymentEntity;
    error?: string;
  }> {
    const subscription = await this.subscriptionRepository.findById(subscriptionId);
    if (!subscription) {
      return {
        success: false,
        error: `Subscription with ID ${subscriptionId} not found`,
      };
    }

    if (!subscription.isActive()) {
      return {
        success: false,
        error: `Subscription ${subscriptionId} is not active for billing`,
      };
    }

    try {
      // 0. 事前決策：使用 BillingRulesEngine 決定是否進行本次扣款
      const paymentMethod = subscription.paymentMethodId ? await this.paymentMethodRepository.findById(subscription.paymentMethodId) : undefined;

      const billingDecision = await this.billingRulesEngine.evaluateBillingDecision({
        subscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        currentAmount: subscription.pricing.baseAmount,
        billingCycle: subscription.billingCycle,
        lastPaymentDate: subscription.lastSuccessfulBillingDate || undefined,
        failureCount: subscription.consecutiveFailures,
        gracePeriodEndDate: subscription.gracePeriodEndDate || undefined,
        paymentMethodValid: !!paymentMethod?.isAvailable(),
      });

      if (!billingDecision.shouldAttemptBilling) {
        return {
          success: false,
          error: `Billing blocked: ${billingDecision.reason}`,
        };
      }

      const amountToBill: Money = billingDecision.recommendedAmount || subscription.pricing.baseAmount;

      // 檢查是否有有效的支付方式
      if (!subscription.paymentMethodId) {
        return {
          success: false,
          error: 'No payment method configured',
        };
      }

      // 創建支付記錄
      const payment = await this.paymentService.createPayment(
        subscription.id,
        subscription.customerId,
        subscription.paymentMethodId,
        amountToBill.amount,
        amountToBill.currency,
        `Subscription billing for period ${subscription.currentPeriodStart.toISOString()} to ${subscription.currentPeriodEnd.toISOString()}`,
      );

      // 啟動支付處理
      await this.paymentService.startPaymentAttempt(payment.id);

      return {
        success: true,
        payment,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * 處理支付成功後的訂閱更新
   */
  public async handlePaymentSuccess(paymentId: string): Promise<void> {
    const payment = await this.paymentService.getPaymentById(paymentId);
    if (!payment) {
      throw new Error(`Payment with ID ${paymentId} not found`);
    }

    // 更新訂閱狀態 - 記錄成功計費
    const subscription = await this.subscriptionRepository.findById(payment.subscriptionId);
    if (subscription) {
      // 首次扣款成功或問題解除時，依狀態機守門條件轉為 ACTIVE
      if (subscription.status === SubscriptionStatus.PENDING) {
        subscription.transitionToStatus(SubscriptionStatus.ACTIVE, {
          reason: 'Initial payment succeeded',
          metadata: { paymentSuccessful: true },
        });
      } else if ([SubscriptionStatus.GRACE_PERIOD, SubscriptionStatus.RETRY, SubscriptionStatus.PAST_DUE].includes(subscription.status)) {
        subscription.transitionToStatus(SubscriptionStatus.ACTIVE, {
          reason: 'Payment issue resolved',
          metadata: { paymentResolved: true },
        });
        // 恢復後重置重試狀態
        subscription.resetRetryState();
      } else if (subscription.status === SubscriptionStatus.TRIALING) {
        // 試用期後的首次成功付款也轉為 ACTIVE（此轉換不需 metadata）
        subscription.transitionToStatus(SubscriptionStatus.ACTIVE, {
          reason: 'First paid billing after trial',
        });
      }
      // 統一由 SubscriptionService 處理成功扣款後的週期推進與日期計算
      await this.subscriptionService.recordSuccessfulBilling(subscription.id);
    }
  }

  /**
   * 處理支付失敗後的訂閱處理
   */
  public async handlePaymentFailure(paymentId: string): Promise<void> {
    const payment = await this.paymentService.getPaymentById(paymentId);
    if (!payment) {
      throw new Error(`Payment with ID ${paymentId} not found`);
    }

    const subscription = await this.subscriptionRepository.findById(payment.subscriptionId);
    if (subscription) {
      // 1) 訂閱失敗記錄（先維持原有記數）
      subscription.recordFailedBilling();

      // 2) 查詢此訂閱近期嘗試與失敗類別（暫以 RETRIABLE 類別估置，實務上應由支付流程提供）
      const failedPayments = await this.paymentService.getPaymentsBySubscriptionId(subscription.id);
      const totalFailures = failedPayments.filter((p) => p.isFailed()).length;
      const lastAttemptDate = failedPayments.length ? failedPayments[failedPayments.length - 1].updatedAt || new Date() : new Date();

      // 3) 透過 RetryStrategyEngine 取得重試決策
      const failureCategory = payment.failureDetails?.category ?? PaymentFailureCategory.RETRIABLE;
      const retryDecision = await this.retryStrategyEngine.evaluateRetryDecision({
        paymentId: payment.id,
        subscriptionId: subscription.id,
        failureCategory,
        failureReason: payment.failureReason || 'UNKNOWN',
        attemptNumber: payment.retryState?.attemptNumber || 1,
        lastAttemptDate,
        totalFailureCount: totalFailures,
        paymentAmount: payment.amount,
        currency: payment.currency || 'TWD',
      });

      if (retryDecision.shouldRetry && retryDecision.nextRetryDate) {
        // 進入重試狀態並設定下次重試日
        subscription.enterRetryState(retryDecision.nextRetryDate);
      } else {
        // 不重試：先進入寬限期，再轉為 PAST_DUE 以符合狀態機轉換規則
        const graceEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        subscription.enterGracePeriod(graceEnd);
        // 立即標記為逾期
        subscription.transitionToStatus(SubscriptionStatus.PAST_DUE, {
          reason: 'Payment failed, marked past due',
          metadata: { paymentFailed: true },
        });
      }

      await this.subscriptionRepository.save(subscription);
    }
  }

  /**
   * 獲取需要計費的訂閱
   */
  public async getSubscriptionsDueForBilling(limit: number = 100): Promise<SubscriptionEntity[]> {
    const now = new Date();
    const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 前一天
    return await this.subscriptionRepository.findDueForBilling(startDate, now, limit);
  }

  /**
   * 批量處理到期計費
   */
  public async processDueBilling(): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    errors: Array<{ subscriptionId: string; error: string }>;
  }> {
    const dueSubscriptions = await this.getSubscriptionsDueForBilling();
    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    const errors: Array<{ subscriptionId: string; error: string }> = [];

    for (const subscription of dueSubscriptions) {
      try {
        const result = await this.processSubscriptionBilling(subscription.id);

        if (result.success) {
          succeeded++;
        } else {
          failed++;
          errors.push({
            subscriptionId: subscription.id,
            error: result.error || 'Unknown error',
          });
        }
      } catch (error) {
        failed++;
        errors.push({
          subscriptionId: subscription.id,
          error: (error as Error).message,
        });
      }
      processed++;
    }

    return { processed, succeeded, failed, errors };
  }

  /**
   * 檢查訂閱的計費狀態
   */
  public async checkSubscriptionBillingStatus(subscriptionId: string): Promise<{
    subscription: CustomDefinition.TNullable<SubscriptionEntity>;
    isDue: boolean;
    nextBillingDate: Date;
    recentPayments: PaymentEntity[];
  }> {
    const subscription = await this.subscriptionRepository.findById(subscriptionId);
    if (!subscription) {
      return {
        subscription: null,
        isDue: false,
        nextBillingDate: new Date(),
        recentPayments: [],
      };
    }

    const now = new Date();
    const isDue = subscription.currentPeriodEnd <= now;
    const recentPayments = await this.paymentService.getPaymentsBySubscriptionId(subscriptionId);

    return {
      subscription,
      isDue,
      nextBillingDate: subscription.currentPeriodEnd,
      recentPayments,
    };
  }

  /**
   * 重試失敗的支付
   */
  public async retryFailedPayments(): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    const retryPayments = await this.paymentService.getPaymentsForRetry();
    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (const payment of retryPayments) {
      try {
        await this.paymentService.startPaymentAttempt(payment.id);
        succeeded++;
      } catch (error) {
        console.error(`Failed to retry payment ${payment.id}:`, error);
        failed++;
      }
      processed++;
    }

    return { processed, succeeded, failed };
  }
}
