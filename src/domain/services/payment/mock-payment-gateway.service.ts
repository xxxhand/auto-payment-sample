import { Injectable, Logger } from '@nestjs/common';
import {
  IPaymentGateway,
  PaymentCreateOptions,
  PaymentResult,
  PaymentStatus,
  PaymentConfirmOptions,
  RefundOptions,
  RefundResult,
  RefundStatus,
  WebhookResult,
  SubscriptionCreateOptions,
  SubscriptionResult,
  SubscriptionUpdateOptions,
} from '../../interfaces/payment/payment-gateway.interface';

/**
 * Mock 支付閘道實作
 * 用於測試環境，模擬各種支付場景
 */
@Injectable()
export class MockPaymentGateway implements IPaymentGateway {
  private readonly logger = new Logger(MockPaymentGateway.name);
  private readonly payments: Map<string, any> = new Map();
  private readonly refunds: Map<string, any> = new Map();
  private readonly subscriptions: Map<string, any> = new Map();

  getName(): string {
    return 'mock';
  }

  /**
   * 創建模擬支付
   */
  async createPayment(options: PaymentCreateOptions): Promise<PaymentResult> {
    this.logger.debug('Creating mock payment', options);

    // 模擬處理延時
    await this.simulateProcessingDelay();

    const paymentId = this.generateId('pay');
    const simulationResult = this.simulatePaymentScenario(options);

    const paymentData = {
      id: paymentId,
      amount: options.amount,
      currency: options.currency,
      status: simulationResult.status,
      paymentMethodId: options.paymentMethodId,
      customerId: options.customerId,
      description: options.description,
      metadata: options.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.payments.set(paymentId, paymentData);

    const result: PaymentResult = {
      success: simulationResult.success,
      paymentId,
      status: simulationResult.status,
      amount: options.amount,
      currency: options.currency,
      clientSecret: simulationResult.status === PaymentStatus.REQUIRES_ACTION ? this.generateClientSecret(paymentId) : undefined,
      nextAction: simulationResult.nextAction,
      gatewayResponse: {
        mockPayment: paymentData,
        simulationScenario: simulationResult.scenario,
      },
      errorMessage: simulationResult.errorMessage,
      errorCode: simulationResult.errorCode,
      metadata: options.metadata,
    };

    this.logger.log('Mock payment created', {
      paymentId,
      status: result.status,
      scenario: simulationResult.scenario,
    });

    return result;
  }

  /**
   * 確認支付
   */
  async confirmPayment(paymentId: string, options?: PaymentConfirmOptions): Promise<PaymentResult> {
    this.logger.debug('Confirming mock payment', { paymentId, options });

    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new Error(`Payment ${paymentId} not found`);
    }

    // 模擬確認處理延時
    await this.simulateProcessingDelay();

    // 根據原始狀態決定確認結果
    let newStatus: PaymentStatus;
    let success = true;
    let errorMessage: string | undefined;

    if (payment.status === PaymentStatus.REQUIRES_ACTION) {
      // 90% 機率確認成功
      if (Math.random() > 0.1) {
        newStatus = PaymentStatus.SUCCEEDED;
      } else {
        newStatus = PaymentStatus.FAILED;
        success = false;
        errorMessage = 'Authentication failed';
      }
    } else {
      newStatus = payment.status;
      success = payment.status === PaymentStatus.SUCCEEDED;
    }

    // 更新支付狀態
    payment.status = newStatus;
    payment.updatedAt = new Date();
    this.payments.set(paymentId, payment);

    const result: PaymentResult = {
      success,
      paymentId,
      status: newStatus,
      amount: payment.amount,
      currency: payment.currency,
      gatewayResponse: {
        mockPayment: payment,
        confirmationResult: 'confirmed',
      },
      errorMessage,
      metadata: payment.metadata,
    };

    this.logger.log('Mock payment confirmed', {
      paymentId,
      status: newStatus,
      success,
    });

    return result;
  }

  /**
   * 獲取支付狀態
   */
  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new Error(`Payment ${paymentId} not found`);
    }

    return payment.status;
  }

  /**
   * 創建退款
   */
  async createRefund(paymentId: string, options?: RefundOptions): Promise<RefundResult> {
    this.logger.debug('Creating mock refund', { paymentId, options });

    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new Error(`Payment ${paymentId} not found`);
    }

    if (payment.status !== PaymentStatus.SUCCEEDED) {
      throw new Error(`Cannot refund payment with status ${payment.status}`);
    }

    // 模擬處理延時
    await this.simulateProcessingDelay();

    const refundId = this.generateId('ref');
    const refundAmount = options?.amount || payment.amount;

    // 95% 機率退款成功
    const success = Math.random() > 0.05;
    const status = success ? RefundStatus.SUCCEEDED : RefundStatus.FAILED;

    const refundData = {
      id: refundId,
      paymentId,
      amount: refundAmount,
      currency: payment.currency,
      status,
      reason: options?.reason || 'Customer request',
      metadata: options?.metadata,
      createdAt: new Date(),
    };

    this.refunds.set(refundId, refundData);

    // 更新支付狀態
    if (success) {
      payment.status = refundAmount >= payment.amount ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED;
      payment.updatedAt = new Date();
      this.payments.set(paymentId, payment);
    }

    const result: RefundResult = {
      success,
      refundId,
      paymentId,
      status,
      amount: refundAmount,
      currency: payment.currency,
      gatewayResponse: {
        mockRefund: refundData,
      },
      errorMessage: success ? undefined : 'Refund processing failed',
      errorCode: success ? undefined : 'REFUND_FAILED',
      metadata: options?.metadata,
    };

    this.logger.log('Mock refund created', {
      refundId,
      paymentId,
      status,
      amount: refundAmount,
    });

    return result;
  }

  /**
   * 獲取退款狀態
   */
  async getRefundStatus(refundId: string): Promise<RefundStatus> {
    const refund = this.refunds.get(refundId);
    if (!refund) {
      throw new Error(`Refund ${refundId} not found`);
    }

    return refund.status;
  }

  /**
   * 處理 Webhook
   */
  async handleWebhook(payload: any, signature?: string): Promise<WebhookResult> {
    this.logger.debug('Handling mock webhook', { payload, signature });

    // 模擬 Webhook 事件處理
    const eventType = payload.type || 'payment.succeeded';
    const paymentId = payload.data?.object?.id;

    return {
      success: true,
      eventType,
      paymentId,
      data: payload,
    };
  }

  /**
   * 創建訂閱 (可選功能)
   */
  async createSubscription(options: SubscriptionCreateOptions): Promise<SubscriptionResult> {
    this.logger.debug('Creating mock subscription', options);

    await this.simulateProcessingDelay();

    const subscriptionId = this.generateId('sub');
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const subscriptionData = {
      id: subscriptionId,
      customerId: options.customerId,
      planId: options.planId,
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      trialEnd: options.trialPeriodDays ? new Date(now.getTime() + options.trialPeriodDays * 24 * 60 * 60 * 1000) : undefined,
      metadata: options.metadata,
      createdAt: now,
    };

    this.subscriptions.set(subscriptionId, subscriptionData);

    const result: SubscriptionResult = {
      success: true,
      subscriptionId,
      customerId: options.customerId,
      planId: options.planId,
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      gatewayResponse: {
        mockSubscription: subscriptionData,
      },
      metadata: options.metadata,
    };

    this.logger.log('Mock subscription created', {
      subscriptionId,
      customerId: options.customerId,
      planId: options.planId,
    });

    return result;
  }

  /**
   * 更新訂閱
   */
  async updateSubscription(subscriptionId: string, options: SubscriptionUpdateOptions): Promise<SubscriptionResult> {
    this.logger.debug('Updating mock subscription', { subscriptionId, options });

    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription ${subscriptionId} not found`);
    }

    await this.simulateProcessingDelay();

    // 更新訂閱資料
    if (options.planId) subscription.planId = options.planId;
    if (options.trialEnd) subscription.trialEnd = options.trialEnd;
    if (options.metadata) subscription.metadata = { ...subscription.metadata, ...options.metadata };

    subscription.updatedAt = new Date();
    this.subscriptions.set(subscriptionId, subscription);

    const result: SubscriptionResult = {
      success: true,
      subscriptionId,
      customerId: subscription.customerId,
      planId: subscription.planId,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      gatewayResponse: {
        mockSubscription: subscription,
      },
      metadata: subscription.metadata,
    };

    this.logger.log('Mock subscription updated', { subscriptionId });

    return result;
  }

  /**
   * 取消訂閱
   */
  async cancelSubscription(subscriptionId: string): Promise<SubscriptionResult> {
    this.logger.debug('Canceling mock subscription', { subscriptionId });

    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription ${subscriptionId} not found`);
    }

    await this.simulateProcessingDelay();

    subscription.status = 'canceled';
    subscription.canceledAt = new Date();
    subscription.updatedAt = new Date();
    this.subscriptions.set(subscriptionId, subscription);

    const result: SubscriptionResult = {
      success: true,
      subscriptionId,
      customerId: subscription.customerId,
      planId: subscription.planId,
      status: 'canceled',
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      gatewayResponse: {
        mockSubscription: subscription,
      },
      metadata: subscription.metadata,
    };

    this.logger.log('Mock subscription canceled', { subscriptionId });

    return result;
  }

  /**
   * 產生 Webhook 事件 (測試用)
   */
  generateWebhookEvent(eventType: string, paymentId: string): any {
    return {
      id: this.generateId('evt'),
      type: eventType,
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: paymentId,
          status: eventType.includes('succeeded') ? 'succeeded' : 'failed',
          amount: 1000,
          currency: 'twd',
        },
      },
    };
  }

  /**
   * 模擬支付場景
   */
  private simulatePaymentScenario(options: PaymentCreateOptions): {
    success: boolean;
    status: PaymentStatus;
    scenario: string;
    errorMessage?: string;
    errorCode?: string;
    nextAction?: any;
  } {
    const amount = options.amount;

    // 根據金額模擬不同場景
    if (amount === 1) {
      // 特殊金額：模擬失敗
      return {
        success: false,
        status: PaymentStatus.FAILED,
        scenario: 'insufficient_funds',
        errorMessage: 'Insufficient funds',
        errorCode: 'INSUFFICIENT_FUNDS',
      };
    }

    if (amount === 2) {
      // 特殊金額：模擬需要額外驗證
      return {
        success: true,
        status: PaymentStatus.REQUIRES_ACTION,
        scenario: 'requires_3d_secure',
        nextAction: {
          type: '3d_secure',
          redirectUrl: 'https://mock-3ds.example.com/authenticate',
        },
      };
    }

    if (amount === 3) {
      // 特殊金額：模擬處理中
      return {
        success: true,
        status: PaymentStatus.PROCESSING,
        scenario: 'processing',
      };
    }

    // 一般情況：90% 成功率
    if (Math.random() > 0.1) {
      return {
        success: true,
        status: PaymentStatus.SUCCEEDED,
        scenario: 'success',
      };
    } else {
      const failureScenarios = [
        {
          scenario: 'card_declined',
          errorMessage: 'Card declined',
          errorCode: 'CARD_DECLINED',
        },
        {
          scenario: 'network_error',
          errorMessage: 'Network error',
          errorCode: 'NETWORK_ERROR',
        },
        {
          scenario: 'invalid_card',
          errorMessage: 'Invalid card',
          errorCode: 'INVALID_CARD',
        },
      ];

      const failure = failureScenarios[Math.floor(Math.random() * failureScenarios.length)];

      return {
        success: false,
        status: PaymentStatus.FAILED,
        ...failure,
      };
    }
  }

  /**
   * 模擬處理延時
   */
  private async simulateProcessingDelay(): Promise<void> {
    const delay = Math.random() * 1000 + 100; // 100-1100ms
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * 產生 ID
   */
  private generateId(prefix: string): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2);
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * 產生客戶端密鑰
   */
  private generateClientSecret(paymentId: string): string {
    return `${paymentId}_secret_${Math.random().toString(36).substring(2)}`;
  }

  /**
   * 獲取所有模擬資料 (用於測試和調試)
   */
  getMockData(): {
    payments: Array<any>;
    refunds: Array<any>;
    subscriptions: Array<any>;
  } {
    return {
      payments: Array.from(this.payments.values()),
      refunds: Array.from(this.refunds.values()),
      subscriptions: Array.from(this.subscriptions.values()),
    };
  }

  /**
   * 清除所有模擬資料
   */
  clearMockData(): void {
    this.payments.clear();
    this.refunds.clear();
    this.subscriptions.clear();
    this.logger.log('Mock data cleared');
  }
}
