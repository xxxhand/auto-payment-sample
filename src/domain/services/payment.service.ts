import { Injectable } from '@nestjs/common';
import { PaymentEntity, PaymentStatus } from '../entities';
import { PaymentRepository } from '../../infra/repositories/payment.repository';
import { SubscriptionRepository } from '../../infra/repositories/subscription.repository';
import { CustomDefinition } from '@xxxhand/app-common';

/**
 * 支付處理服務
 * 負責支付流程管理、狀態追蹤和錯誤處理
 */
@Injectable()
export class PaymentService {
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
}
