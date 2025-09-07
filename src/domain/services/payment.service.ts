import { Injectable } from '@nestjs/common';
import { PaymentEntity, PaymentStatus } from '../entities';
import { PaymentRepository } from '../../infra/repositories/payment.repository';
import { SubscriptionRepository } from '../../infra/repositories/subscription.repository';
import { CustomDefinition } from '@xxxhand/app-common';

export interface PaymentAttempt {
  id: string;
  paymentId: string;
  attemptNumber: number;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  amount: number;
  currency: string;
  paymentMethodId: string;
  errorCode?: string;
  errorMessage?: string;
  processingTime?: number;
  attemptedAt: string;
  completedAt?: string;
  metadata: {
    gatewayTransactionId?: string;
    gatewayResponse?: string;
    riskScore?: number;
    fraudCheck?: boolean;
  };
}

export interface PaymentProcessor {
  processPayment(paymentData: {
    amount: number;
    currency: string;
    paymentMethodId: string;
    customerId: string;
  }): Promise<{ success: boolean; transactionId?: string; errorMessage?: string }>;
  refundPayment(transactionId: string, amount: number): Promise<{ success: boolean; refundId?: string; errorMessage?: string }>;
  getTransactionStatus(transactionId: string): Promise<{ status: string; details?: any }>;
}

/**
 * 支付處理服務
 * 負責支付流程管理、狀態追蹤和錯誤處理
 */
@Injectable()
export class PaymentService {
  private readonly maxRetryAttempts = 3;
  private readonly retryDelayMs = 1000;
  private readonly paymentAttempts: PaymentAttempt[] = [];

  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly subscriptionRepository: SubscriptionRepository,
  ) {}

  /**
   * 創建新支付記錄
   */
  public async createPayment(
    subscriptionId: string,
    customerId: string,
    paymentMethodId: string,
    amount: number,
    currency: string = 'TWD',
    description?: string,
  ): Promise<PaymentEntity> {
    // 驗證訂閱存在
    const subscription = await this.subscriptionRepository.findById(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription with ID ${subscriptionId} not found`);
    }

    const payment = new PaymentEntity(subscriptionId, customerId, paymentMethodId, amount, subscription.currentPeriodStart, subscription.currentPeriodEnd);

    payment.currency = currency;
    if (description) {
      payment.description = description;
    }

    return await this.paymentRepository.save(payment);
  }

  /**
   * 根據 ID 獲取支付記錄
   */
  public async getPaymentById(id: string): Promise<CustomDefinition.TNullable<PaymentEntity>> {
    return await this.paymentRepository.findById(id);
  }

  /**
   * 根據訂閱 ID 獲取支付記錄
   */
  public async getPaymentsBySubscriptionId(subscriptionId: string): Promise<PaymentEntity[]> {
    return await this.paymentRepository.findBySubscriptionId(subscriptionId);
  }

  /**
   * 根據客戶 ID 獲取支付記錄
   */
  public async getPaymentsByCustomerId(customerId: string, limit: number = 50): Promise<PaymentEntity[]> {
    return await this.paymentRepository.findByCustomerId(customerId, limit);
  }

  /**
   * 開始支付嘗試
   */
  public async startPaymentAttempt(paymentId: string): Promise<CustomDefinition.TNullable<PaymentEntity>> {
    const payment = await this.paymentRepository.findById(paymentId);
    if (!payment) {
      throw new Error(`Payment with ID ${paymentId} not found`);
    }

    if (!payment.canRetry()) {
      throw new Error(`Payment ${paymentId} cannot be retried`);
    }

    payment.startAttempt();
    return await this.paymentRepository.save(payment);
  }

  /**
   * 標記支付成功
   */
  public async markPaymentSucceeded(paymentId: string, externalTransactionId?: string): Promise<CustomDefinition.TNullable<PaymentEntity>> {
    const payment = await this.paymentRepository.findById(paymentId);
    if (!payment) {
      throw new Error(`Payment with ID ${paymentId} not found`);
    }

    payment.markSucceeded(externalTransactionId);
    return await this.paymentRepository.save(payment);
  }

  /**
   * 標記支付失敗
   */
  public async markPaymentFailed(paymentId: string, failureReason?: string, failureCode?: string): Promise<CustomDefinition.TNullable<PaymentEntity>> {
    const payment = await this.paymentRepository.findById(paymentId);
    if (!payment) {
      throw new Error(`Payment with ID ${paymentId} not found`);
    }

    payment.markFailed(failureReason, failureCode);
    return await this.paymentRepository.save(payment);
  }

  /**
   * 取消支付
   */
  public async cancelPayment(paymentId: string): Promise<CustomDefinition.TNullable<PaymentEntity>> {
    const payment = await this.paymentRepository.findById(paymentId);
    if (!payment) {
      throw new Error(`Payment with ID ${paymentId} not found`);
    }

    payment.markCanceled();
    return await this.paymentRepository.save(payment);
  }

  /**
   * 處理退款
   */
  public async processRefund(paymentId: string, refundAmount: number, refundReason?: string): Promise<CustomDefinition.TNullable<PaymentEntity>> {
    const payment = await this.paymentRepository.findById(paymentId);
    if (!payment) {
      throw new Error(`Payment with ID ${paymentId} not found`);
    }

    if (!payment.isSuccessful()) {
      throw new Error(`Payment ${paymentId} must be successful to process refund`);
    }

    payment.processRefund(refundAmount, refundReason);
    return await this.paymentRepository.save(payment);
  }

  /**
   * 獲取失敗的支付記錄
   */
  public async getFailedPayments(limit: number = 100): Promise<PaymentEntity[]> {
    return await this.paymentRepository.findByStatus(PaymentStatus.FAILED, limit);
  }

  /**
   * 獲取需要重試的支付記錄
   */
  public async getPaymentsForRetry(): Promise<PaymentEntity[]> {
    const failedPayments = await this.getFailedPayments();
    return failedPayments.filter((payment) => payment.canRetry());
  }

  /**
   * 根據外部交易 ID 查找支付記錄
   */
  public async getPaymentByExternalTransactionId(externalTransactionId: string): Promise<CustomDefinition.TNullable<PaymentEntity>> {
    return await this.paymentRepository.findByExternalTransactionId(externalTransactionId);
  }

  /**
   * 獲取支付統計資料
   */
  public async getPaymentStatistics(
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalAmount: number;
    successCount: number;
    failureCount: number;
    refundedAmount: number;
  }> {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 預設 30 天前
    const end = endDate || new Date();
    return await this.paymentRepository.getPaymentStatistics(start, end);
  }

  /**
   * 批量處理重試支付
   */
  public async processRetryPayments(): Promise<{ processed: number; started: number; failed: number }> {
    const retryPayments = await this.getPaymentsForRetry();
    let processed = 0;
    let started = 0;
    let failed = 0;

    for (const payment of retryPayments) {
      try {
        await this.startPaymentAttempt(payment.id);
        started++;
      } catch (error) {
        console.error(`Failed to retry payment ${payment.id}:`, error);
        failed++;
      }
      processed++;
    }

    return { processed, started, failed };
  }

  /**
   * 驗證支付狀態一致性
   */
  public async validatePaymentConsistency(paymentId: string): Promise<{
    isConsistent: boolean;
    issues: string[];
  }> {
    const payment = await this.paymentRepository.findById(paymentId);
    if (!payment) {
      return {
        isConsistent: false,
        issues: [`Payment with ID ${paymentId} not found`],
      };
    }

    const issues: string[] = [];

    // 檢查狀態邏輯一致性
    if (payment.isSuccessful() && !payment.paidAt) {
      issues.push('Payment is marked as successful but has no paidAt timestamp');
    }

    if (payment.isFailed() && !payment.failedAt) {
      issues.push('Payment is marked as failed but has no failedAt timestamp');
    }

    if (payment.refundedAmount && payment.refundedAmount > payment.amount) {
      issues.push('Refunded amount exceeds payment amount');
    }

    if (payment.attemptCount < 0) {
      issues.push('Attempt count cannot be negative');
    }

    return {
      isConsistent: issues.length === 0,
      issues,
    };
  }

  /**
   * 處理支付（包含重試機制）
   */
  public async processPaymentWithRetry(paymentData: {
    paymentId: string;
    customerId: string;
    paymentMethodId: string;
    amount: number;
    currency: string;
  }): Promise<{ success: boolean; paymentId: string; transactionId?: string; attempts: number; finalError?: string }> {
    const { paymentId, customerId, paymentMethodId, amount, currency } = paymentData;
    let attempts = 0;
    let lastError: string | undefined;

    while (attempts < this.maxRetryAttempts) {
      attempts++;

      try {
        const attemptId = `${paymentId}_attempt_${attempts}`;
        const attemptStart = new Date().toISOString();

        // 創建支付嘗試記錄
        const paymentAttempt: PaymentAttempt = {
          id: attemptId,
          paymentId,
          attemptNumber: attempts,
          status: 'PENDING',
          amount,
          currency,
          paymentMethodId,
          attemptedAt: attemptStart,
          metadata: {},
        };
        this.paymentAttempts.push(paymentAttempt);

        // 模擬支付處理邏輯
        const processingResult = await this.simulatePaymentProcessing({
          amount,
          currency,
          paymentMethodId,
          customerId,
        });

        const completedAt = new Date().toISOString();
        const processingTime = new Date(completedAt).getTime() - new Date(attemptStart).getTime();

        if (processingResult.success) {
          // 支付成功
          paymentAttempt.status = 'SUCCESS';
          paymentAttempt.completedAt = completedAt;
          paymentAttempt.processingTime = processingTime;
          paymentAttempt.metadata.gatewayTransactionId = processingResult.transactionId;

          await this.markPaymentSucceeded(paymentId, processingResult.transactionId);

          return {
            success: true,
            paymentId,
            transactionId: processingResult.transactionId,
            attempts,
          };
        } else {
          // 支付失敗
          paymentAttempt.status = 'FAILED';
          paymentAttempt.completedAt = completedAt;
          paymentAttempt.processingTime = processingTime;
          paymentAttempt.errorMessage = processingResult.errorMessage;
          paymentAttempt.errorCode = 'PAYMENT_FAILED';

          lastError = processingResult.errorMessage;

          if (attempts < this.maxRetryAttempts) {
            // 等待後重試
            await this.delay(this.retryDelayMs * attempts);
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        lastError = errorMessage;

        // 更新嘗試記錄
        const attempt = this.paymentAttempts.find((a) => a.paymentId === paymentId && a.attemptNumber === attempts);
        if (attempt) {
          attempt.status = 'FAILED';
          attempt.completedAt = new Date().toISOString();
          attempt.errorMessage = errorMessage;
          attempt.errorCode = 'PROCESSING_ERROR';
        }

        if (attempts < this.maxRetryAttempts) {
          await this.delay(this.retryDelayMs * attempts);
        }
      }
    }

    // 所有重試都失敗了
    await this.markPaymentFailed(paymentId, lastError, 'MAX_RETRIES_EXCEEDED');

    return {
      success: false,
      paymentId,
      attempts,
      finalError: lastError,
    };
  }

  /**
   * 取得支付嘗試記錄
   */
  public async getPaymentAttempts(paymentId: string): Promise<{ attempts: PaymentAttempt[] }> {
    const attempts = this.paymentAttempts.filter((attempt) => attempt.paymentId === paymentId);
    return { attempts: attempts.sort((a, b) => a.attemptNumber - b.attemptNumber) };
  }

  /**
   * 批量處理未完成支付
   */
  public async processPendingPayments(): Promise<{ processed: number; succeeded: number; failed: number }> {
    // 獲取處理中狀態超過30分鐘的支付
    const pendingPayments = await this.paymentRepository.findByStatus(PaymentStatus.PROCESSING, 100);
    const stalePayments = pendingPayments.filter((payment) => {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      return payment.createdAt < thirtyMinutesAgo;
    });

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (const payment of stalePayments) {
      try {
        const result = await this.processPaymentWithRetry({
          paymentId: payment.id,
          customerId: payment.customerId,
          paymentMethodId: payment.paymentMethodId,
          amount: payment.amount,
          currency: payment.currency || 'TWD',
        });

        if (result.success) {
          succeeded++;
        } else {
          failed++;
        }
        processed++;
      } catch (error) {
        console.error(`Failed to process pending payment ${payment.id}:`, error);
        failed++;
        processed++;
      }
    }

    return { processed, succeeded, failed };
  }

  /**
   * 模擬支付處理（實際實作中會調用真實的支付網關）
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async simulatePaymentProcessing(_paymentData: {
    amount: number;
    currency: string;
    paymentMethodId: string;
    customerId: string;
  }): Promise<{ success: boolean; transactionId?: string; errorMessage?: string }> {
    // 模擬處理時間
    await this.delay(Math.random() * 2000 + 1000);

    // 模擬支付成功率（85%）
    const successRate = 0.85;
    const isSuccess = Math.random() < successRate;

    if (isSuccess) {
      return {
        success: true,
        transactionId: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };
    } else {
      const errorMessages = ['Insufficient funds', 'Card declined', 'Network timeout', 'Invalid payment method', 'Fraud detection triggered'];

      return {
        success: false,
        errorMessage: errorMessages[Math.floor(Math.random() * errorMessages.length)],
      };
    }
  }

  /**
   * 延遲執行
   */
  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
