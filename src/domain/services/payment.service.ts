import { Inject, Injectable, forwardRef, Optional } from '@nestjs/common';
import { PaymentEntity, PaymentStatus, PaymentFailureCategory } from '../entities';
import { PaymentRepository } from '../../infra/repositories/payment.repository';
import { SubscriptionRepository } from '../../infra/repositories/subscription.repository';
import { CustomDefinition } from '@xxxhand/app-common';
import { RetryStrategyEngine } from './rules-engine/retry-strategy.engine';
import { PaymentProcessingService } from './payment-processing.service';
import { Money } from '../value-objects/money';
import { mapFailureCategoryFromMessage, isCategoryRetriable } from '../utils/payment-failure.util';
import { RetryPolicy } from '../value-objects/retry-policy';
import { BillingService } from './billing.service';

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
  // legacy defaults kept as fallback; rule engine will override
  private readonly maxRetryAttempts = 3;
  private readonly retryDelayMs = 1000;
  private readonly paymentAttempts: PaymentAttempt[] = [];

  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly retryStrategyEngine: RetryStrategyEngine,
    @Inject(forwardRef(() => PaymentProcessingService)) private readonly paymentProcessingService: PaymentProcessingService,
    @Optional() @Inject(forwardRef(() => BillingService)) private readonly billingService?: BillingService,
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

    // 允許首次嘗試（狀態為 PENDING），或在具備重試資格時再次嘗試
    if (payment.status === PaymentStatus.PENDING || payment.canRetry()) {
      payment.startAttempt();
    } else {
      throw new Error(`Payment ${paymentId} cannot be retried`);
    }
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
    const saved = await this.paymentRepository.save(payment);

    // 同步更新訂閱狀態
    try {
      if (this.billingService) {
        await this.billingService.handlePaymentSuccess(paymentId);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Failed to handle subscription after payment success:', e);
    }

    return saved;
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
    const saved = await this.paymentRepository.save(payment);

    // 同步更新訂閱重試/寬限狀態
    try {
      if (this.billingService) {
        await this.billingService.handlePaymentFailure(paymentId);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Failed to handle subscription after payment failure:', e);
    }

    return saved;
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
    const { paymentId, paymentMethodId, amount, currency } = paymentData;
    let attempts = 0;
    let lastError: string | undefined;

    // 驅動重試的規則引擎上下文：需要 subscriptionId 與歷史
    const payment = await this.paymentRepository.findById(paymentId);
    const subscriptionId = payment?.subscriptionId || '';
    const priorFailures = await this.paymentRepository.findBySubscriptionId(subscriptionId);
    const totalFailureCount = priorFailures.filter((p) => p.isFailed()).length;

    // 以規則引擎為主導的嘗試迴圈
    // 注意：attempts 代表已完成的次數，故提供給引擎時用 attempts
    while (true) {
      attempts++;
      const attemptId = `${paymentId}_attempt_${attempts}`;
      const attemptStart = new Date().toISOString();

      // 建立嘗試紀錄
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

      try {
        // 執行一次實際支付處理（呼叫 PaymentProcessingService）
        const processingResult = await this.paymentProcessingService.processPayment(paymentId, paymentMethodId, new Money(amount, currency));
        const completedAt = new Date().toISOString();
        const processingTime = new Date(completedAt).getTime() - new Date(attemptStart).getTime();

        if (processingResult.success) {
          paymentAttempt.status = 'SUCCESS';
          paymentAttempt.completedAt = completedAt;
          paymentAttempt.processingTime = processingTime;
          paymentAttempt.metadata.gatewayTransactionId = processingResult.transactionId;

          await this.markPaymentSucceeded(paymentId, processingResult.transactionId);
          return { success: true, paymentId, transactionId: processingResult.transactionId, attempts };
        }

        // 失敗 → 透過 RetryStrategyEngine 決策
        paymentAttempt.status = 'FAILED';
        paymentAttempt.completedAt = completedAt;
        paymentAttempt.processingTime = processingTime;
        paymentAttempt.errorMessage = processingResult.errorMessage;
        paymentAttempt.errorCode = processingResult.errorCode || 'PAYMENT_FAILED';
        lastError = processingResult.errorMessage;

        // 依處理結果的類別或訊息進行失敗類別 mapping
        const failureCategory: PaymentFailureCategory =
          processingResult.failureCategory !== undefined ? processingResult.failureCategory : mapFailureCategoryFromMessage(processingResult.errorMessage);
        const decision = await this.retryStrategyEngine.evaluateRetryDecision({
          paymentId,
          subscriptionId,
          failureCategory,
          failureReason: processingResult.errorMessage || 'UNKNOWN',
          attemptNumber: attempts,
          lastAttemptDate: new Date(),
          totalFailureCount,
          paymentAmount: amount,
          currency,
        });

        // 後備策略（若規則未提供數值）
        const fallbackPolicy = RetryPolicy.forCategory(failureCategory);

        // 同步重試決策到 PaymentEntity.retryState 與 failureDetails（便於外部觀察與後續排程）
        try {
          const p = await this.paymentRepository.findById(paymentId);
          if (p) {
            p.failureDetails = {
              errorCode: paymentAttempt.errorCode,
              errorMessage: lastError,
              category: failureCategory,
              isRetriable: isCategoryRetriable(failureCategory),
              failedAt: new Date(),
            };
            p.retryState = {
              attemptNumber: attempts,
              maxRetries: decision.maxRetries ?? fallbackPolicy.config.maxRetries,
              nextRetryAt: decision.nextRetryDate ?? fallbackPolicy.nextRetryAt(attempts),
              lastFailureReason: lastError,
              failureCategory,
              retryStrategy: String(decision.retryStrategy || fallbackPolicy.config.strategy || 'UNKNOWN'),
            };
            await this.paymentRepository.save(p);
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('Failed to persist payment retryState after failure:', e);
        }

        if (!decision.shouldRetry) {
          // 不重試：標記 payment 失敗並結束，保存精確失敗類別
          const p = await this.paymentRepository.findById(paymentId);
          if (p) {
            p.markAsFailed(
              {
                errorCode: paymentAttempt.errorCode,
                errorMessage: lastError,
                category: failureCategory,
                isRetriable: isCategoryRetriable(failureCategory),
              },
              false,
            );
            await this.paymentRepository.save(p);
          } else {
            await this.markPaymentFailed(paymentId, lastError, 'NO_RETRY_DECIDED');
          }
          return { success: false, paymentId, attempts, finalError: lastError };
        }

        // 需要重試：依決策延遲（使用策略後備）
        const delayMinutes = decision.delayMinutes ?? fallbackPolicy.calculateDelayMinutes(attempts);
        const delayMs = Math.min(delayMinutes * 60 * 1000, process.env.JEST_WORKER_ID ? 100 : 60_000);
        if (delayMs > 0) {
          await this.delay(delayMs);
        }

        // 硬上限：使用決策或策略後備
        const maxRetries = decision.maxRetries ?? fallbackPolicy.config.maxRetries ?? this.maxRetryAttempts;
        if (attempts >= maxRetries) {
          const p = await this.paymentRepository.findById(paymentId);
          if (p) {
            p.markAsFailed(
              {
                errorCode: paymentAttempt.errorCode,
                errorMessage: lastError,
                category: failureCategory,
                isRetriable: isCategoryRetriable(failureCategory),
              },
              false,
            );
            await this.paymentRepository.save(p);
          } else {
            await this.markPaymentFailed(paymentId, lastError, 'MAX_RETRIES_EXCEEDED');
          }
          return { success: false, paymentId, attempts, finalError: lastError };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        lastError = errorMessage;
        const attempt = this.paymentAttempts.find((a) => a.paymentId === paymentId && a.attemptNumber === attempts);
        if (attempt) {
          attempt.status = 'FAILED';
          attempt.completedAt = new Date().toISOString();
          attempt.errorMessage = errorMessage;
          attempt.errorCode = 'PROCESSING_ERROR';
        }

        // 將此處處理錯誤也走引擎：用 DELAYED_RETRY 作為保守類別
        const failureCategory = PaymentFailureCategory.DELAYED_RETRY;
        const decision = await this.retryStrategyEngine.evaluateRetryDecision({
          paymentId,
          subscriptionId,
          failureCategory,
          failureReason: errorMessage,
          attemptNumber: attempts,
          lastAttemptDate: new Date(),
          totalFailureCount,
          paymentAmount: amount,
          currency,
        });
        const fallbackPolicy = RetryPolicy.forCategory(failureCategory);

        // 同步決策至 PaymentEntity.retryState 以供觀察
        try {
          const p = await this.paymentRepository.findById(paymentId);
          if (p) {
            p.failureDetails = {
              errorCode: 'PROCESSING_ERROR',
              errorMessage: errorMessage,
              category: failureCategory,
              isRetriable: true,
              failedAt: new Date(),
            };
            p.retryState = {
              attemptNumber: attempts,
              maxRetries: decision.maxRetries ?? fallbackPolicy.config.maxRetries,
              nextRetryAt: decision.nextRetryDate ?? fallbackPolicy.nextRetryAt(attempts),
              lastFailureReason: errorMessage,
              failureCategory,
              retryStrategy: String(decision.retryStrategy || fallbackPolicy.config.strategy || 'UNKNOWN'),
            };
            await this.paymentRepository.save(p);
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('Failed to persist payment retryState after catch failure:', e);
        }

        if (!decision.shouldRetry) {
          const p = await this.paymentRepository.findById(paymentId);
          if (p) {
            p.markAsFailed(
              {
                errorCode: 'PROCESSING_ERROR',
                errorMessage: lastError,
                category: failureCategory,
                isRetriable: true,
              },
              false,
            );
            await this.paymentRepository.save(p);
          } else {
            await this.markPaymentFailed(paymentId, lastError, 'NO_RETRY_DECIDED');
          }
          return { success: false, paymentId, attempts, finalError: lastError };
        }

        const delayMinutes = decision.delayMinutes ?? fallbackPolicy.calculateDelayMinutes(attempts);
        const delayMs = Math.min(delayMinutes * 60 * 1000, process.env.JEST_WORKER_ID ? 100 : 60_000);
        if (delayMs > 0) {
          await this.delay(delayMs);
        }

        const maxRetries = decision.maxRetries ?? fallbackPolicy.config.maxRetries ?? this.maxRetryAttempts;
        if (attempts >= maxRetries) {
          const p = await this.paymentRepository.findById(paymentId);
          if (p) {
            p.markAsFailed(
              {
                errorCode: 'PROCESSING_ERROR',
                errorMessage: lastError,
                category: failureCategory,
                isRetriable: true,
              },
              false,
            );
            await this.paymentRepository.save(p);
          } else {
            await this.markPaymentFailed(paymentId, lastError, 'MAX_RETRIES_EXCEEDED');
          }
          return { success: false, paymentId, attempts, finalError: lastError };
        }
      }
    }
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

  /**
   * 將模擬器的錯誤訊息映射至失敗類別，與 gateway 行為對齊
   */
  // mapping 與 retriable 判斷改由 util 提供
}
