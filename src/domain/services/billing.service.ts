import { Injectable } from '@nestjs/common';
import { SubscriptionEntity } from '../entities';
import { PaymentEntity } from '../entities';
import { SubscriptionRepository } from '../../infra/repositories/subscription.repository';
import { PaymentService } from './payment.service';
import { SubscriptionService } from './subscription.service';
import { CustomDefinition } from '@xxxhand/app-common';

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
        subscription.amount,
        subscription.currency,
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
      subscription.recordFailedBilling();

      // 根據失敗次數決定處理方式
      const failedPayments = await this.paymentService.getPaymentsBySubscriptionId(subscription.id);
      const recentFailures = failedPayments.filter((p) => p.isFailed()).filter((p) => p.createdAt.getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000).length; // 30天內

      if (recentFailures >= 3) {
        // 連續失敗3次，標記為逾期
        const gracePeriodEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7天寬限期
        subscription.markPastDue(gracePeriodEnd);
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
