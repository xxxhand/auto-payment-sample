import { Test, TestingModule } from '@nestjs/testing';
import { PaymentGatewayManager } from '../src/domain/services/payment/payment-gateway-manager.service';
import { MockPaymentGateway } from '../src/domain/services/payment/mock-payment-gateway.service';
import { PaymentStatus, PaymentMethodType, RefundStatus } from '../src/domain/interfaces/payment/payment-gateway.interface';

// TODO: Not a very good mock way, the mock gateway should implement here, not in src, fix it in the future
describe('Payment Gateway Integration (e2e)', () => {
  let gatewayManager: PaymentGatewayManager;
  let mockGateway: MockPaymentGateway;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [PaymentGatewayManager, MockPaymentGateway],
    }).compile();

    gatewayManager = moduleFixture.get<PaymentGatewayManager>(PaymentGatewayManager);
    mockGateway = moduleFixture.get<MockPaymentGateway>(MockPaymentGateway);

    // 註冊 Mock 支付閘道
    gatewayManager.registerGateway('mock', mockGateway, {
      name: 'mock',
      enabled: true,
      testMode: true,
      supportedCurrencies: ['TWD', 'USD'],
      supportedPaymentMethods: [PaymentMethodType.CREDIT_CARD],
      minimumAmount: 1,
      maximumAmount: 1000000,
      processingFeeRate: 0.029,
    });

    gatewayManager.setDefaultGateway('mock');
  });

  beforeEach(() => {
    // 清除 Mock 資料
    mockGateway.clearMockData();
  });

  describe('Payment Creation', () => {
    it('should create a successful payment', async () => {
      const paymentOptions = {
        amount: 1000,
        currency: 'TWD',
        paymentMethodId: 'pm_test_card',
        customerId: 'cus_test',
        description: 'Test payment',
        metadata: { orderId: 'order_123', __forceScenario: 'success' },
      } as any;

      const result = await gatewayManager.processPayment('mock', paymentOptions);

      expect(result.success).toBe(true);
      expect(result.status).toBe(PaymentStatus.SUCCEEDED);
      expect(result.amount).toBe(paymentOptions.amount);
      expect(result.currency).toBe(paymentOptions.currency);
      expect(result.paymentId).toBeDefined();
      expect(result.gatewayResponse).toBeDefined();
    });

    it('should handle payment failure scenarios', async () => {
      const paymentOptions = {
        amount: 1, // 特殊金額：模擬失敗
        currency: 'TWD',
        paymentMethodId: 'pm_test_card',
        customerId: 'cus_test',
      };

      const result = await gatewayManager.processPayment('mock', paymentOptions);

      expect(result.success).toBe(false);
      expect(result.status).toBe(PaymentStatus.FAILED);
      expect(result.errorMessage).toBeDefined();
      expect(result.errorCode).toBe('INSUFFICIENT_FUNDS');
    });

    it('should handle payment requiring additional action', async () => {
      const paymentOptions = {
        amount: 2, // 特殊金額：需要額外驗證
        currency: 'TWD',
        paymentMethodId: 'pm_test_card',
        customerId: 'cus_test',
      };

      const result = await gatewayManager.processPayment('mock', paymentOptions);

      expect(result.success).toBe(true);
      expect(result.status).toBe(PaymentStatus.REQUIRES_ACTION);
      expect(result.clientSecret).toBeDefined();
      expect(result.nextAction).toBeDefined();
      expect(result.nextAction?.type).toBe('3d_secure');
    });

    it('should handle processing status', async () => {
      const paymentOptions = {
        amount: 3, // 特殊金額：處理中
        currency: 'TWD',
        paymentMethodId: 'pm_test_card',
        customerId: 'cus_test',
      };

      const result = await gatewayManager.processPayment('mock', paymentOptions);

      expect(result.success).toBe(true);
      expect(result.status).toBe(PaymentStatus.PROCESSING);
    });
  });

  describe('Payment Confirmation', () => {
    it('should confirm payment requiring action', async () => {
      // 首先創建需要驗證的支付
      const paymentOptions = {
        amount: 2,
        currency: 'TWD',
        paymentMethodId: 'pm_test_card',
        customerId: 'cus_test',
      };

      const createResult = await gatewayManager.processPayment('mock', paymentOptions);
      expect(createResult.status).toBe(PaymentStatus.REQUIRES_ACTION);

      // 確認支付 (Mock 實作中有 90% 成功率)
      const gateway = gatewayManager.getGateway('mock');
      const confirmResult = await gateway.confirmPayment(createResult.paymentId);

      // 結果應該是成功或失敗
      expect([true, false]).toContain(confirmResult.success);
      expect([PaymentStatus.SUCCEEDED, PaymentStatus.FAILED]).toContain(confirmResult.status);
    });

    it('should get payment status', async () => {
      const paymentOptions = {
        amount: 1000,
        currency: 'TWD',
        paymentMethodId: 'pm_test_card',
        metadata: { __forceScenario: 'success' },
      } as any;

      const result = await gatewayManager.processPayment('mock', paymentOptions);
      const gateway = gatewayManager.getGateway('mock');
      const status = await gateway.getPaymentStatus(result.paymentId);

      expect(status).toBe(PaymentStatus.SUCCEEDED);
    });
  });

  describe('Refund Processing', () => {
    it('should create full refund successfully', async () => {
      // 使用確定成功的支付金額
      const paymentOptions = {
        amount: 5000, // 使用較大金額確保成功
        currency: 'TWD',
        paymentMethodId: 'pm_test_card',
        customerId: 'cus_test',
        metadata: { __forceScenario: 'success' },
      } as any;

      const paymentResult = await gatewayManager.processPayment('mock', paymentOptions);
      expect(paymentResult.success).toBe(true);

      // 創建退款
      const refundOptions = {
        reason: 'Customer request',
        metadata: { refundId: 'ref_123', __forceRefund: 'success' },
      } as any;

      const refundResult = await gatewayManager.processRefund('mock', paymentResult.paymentId, refundOptions);

      expect(refundResult.success).toBe(true);
      expect(refundResult.status).toBe(RefundStatus.SUCCEEDED);
      expect(refundResult.amount).toBe(paymentOptions.amount);
      expect(refundResult.paymentId).toBe(paymentResult.paymentId);
      expect(refundResult.refundId).toBeDefined();
    });

    it('should create partial refund successfully', async () => {
      const paymentOptions = {
        amount: 1000,
        currency: 'TWD',
        paymentMethodId: 'pm_test_card',
        metadata: { __forceScenario: 'success' },
      } as any;

      const paymentResult = await gatewayManager.processPayment('mock', paymentOptions);
      const refundAmount = 500;

      const refundResult = await gatewayManager.processRefund('mock', paymentResult.paymentId, { amount: refundAmount, metadata: { __forceRefund: 'success' } } as any);

      expect(refundResult.success).toBe(true);
      expect(refundResult.amount).toBe(refundAmount);
    });

    it('should fail refund for non-successful payment', async () => {
      const paymentOptions = {
        amount: 1, // 失敗的支付
        currency: 'TWD',
        paymentMethodId: 'pm_test_card',
      };

      const paymentResult = await gatewayManager.processPayment('mock', paymentOptions);
      expect(paymentResult.success).toBe(false);

      await expect(gatewayManager.processRefund('mock', paymentResult.paymentId)).rejects.toThrow('Cannot refund payment with status FAILED');
    });
  });

  describe('Gateway Management', () => {
    it('should get available gateways', () => {
      const gateways = gatewayManager.getAvailableGateways();
      expect(gateways).toContain('mock');
    });

    it('should select optimal gateway based on criteria', () => {
      const gateway = gatewayManager.selectOptimalGateway({
        amount: 1000,
        currency: 'TWD',
        paymentMethodType: 'credit_card',
      });

      expect(gateway).toBeDefined();
      expect(gateway.getName()).toBe('mock');
    });

    it('should throw error for non-existent gateway', () => {
      expect(() => gatewayManager.getGateway('non-existent')).toThrow("Payment gateway 'non-existent' not found");
    });

    it('should get system status', () => {
      const status = gatewayManager.getSystemStatus();

      expect(status.totalGateways).toBeGreaterThan(0);
      expect(status.enabledGateways).toBeGreaterThan(0);
      expect(status.defaultGateway).toBe('mock');
      expect(status.gateways).toBeInstanceOf(Array);
    });
  });

  describe('Webhook Processing', () => {
    it('should handle webhook events', async () => {
      const webhookPayload = {
        type: 'payment.succeeded',
        data: {
          object: {
            id: 'pay_test_123',
            status: 'succeeded',
            amount: 1000,
            currency: 'twd',
          },
        },
      };

      const result = await gatewayManager.handleWebhook('mock', webhookPayload);

      expect(result.success).toBe(true);
      expect(result.eventType).toBe('payment.succeeded');
      expect(result.paymentId).toBe('pay_test_123');
    });
  });

  describe('Subscription Management', () => {
    it('should create subscription', async () => {
      const gateway = gatewayManager.getGateway('mock');

      if (gateway.createSubscription) {
        const subscriptionOptions = {
          customerId: 'cus_test',
          planId: 'plan_monthly',
          paymentMethodId: 'pm_test_card',
          metadata: { source: 'test' },
        };

        const result = await gateway.createSubscription(subscriptionOptions);

        expect(result.success).toBe(true);
        expect(result.subscriptionId).toBeDefined();
        expect(result.customerId).toBe(subscriptionOptions.customerId);
        expect(result.planId).toBe(subscriptionOptions.planId);
        expect(result.status).toBe('active');
      }
    });

    it('should update subscription', async () => {
      const gateway = gatewayManager.getGateway('mock');

      if (gateway.createSubscription && gateway.updateSubscription) {
        // 首先創建訂閱
        const createResult = await gateway.createSubscription({
          customerId: 'cus_test',
          planId: 'plan_monthly',
        });

        // 更新訂閱
        const updateResult = await gateway.updateSubscription(createResult.subscriptionId, {
          planId: 'plan_yearly',
          metadata: { updated: 'true' },
        });

        expect(updateResult.success).toBe(true);
        expect(updateResult.planId).toBe('plan_yearly');
      }
    });

    it('should cancel subscription', async () => {
      const gateway = gatewayManager.getGateway('mock');

      if (gateway.createSubscription && gateway.cancelSubscription) {
        // 首先創建訂閱
        const createResult = await gateway.createSubscription({
          customerId: 'cus_test',
          planId: 'plan_monthly',
        });

        // 取消訂閱
        const cancelResult = await gateway.cancelSubscription(createResult.subscriptionId);

        expect(cancelResult.success).toBe(true);
        expect(cancelResult.status).toBe('canceled');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle network simulation errors gracefully', async () => {
      // 測試多次支付以觸發不同的錯誤場景
      const results = await Promise.allSettled(
        Array.from({ length: 10 }, (_, i) =>
          gatewayManager.processPayment('mock', {
            amount: 100 + i,
            currency: 'TWD',
            paymentMethodId: 'pm_test_card',
          }),
        ),
      );

      // 至少應該有一些成功的支付
      const successfulPayments = results.filter((result) => result.status === 'fulfilled' && result.value.success);

      expect(successfulPayments.length).toBeGreaterThan(0);
    });

    it('should handle payment not found error', async () => {
      const gateway = gatewayManager.getGateway('mock');

      await expect(gateway.getPaymentStatus('non_existent_payment')).rejects.toThrow('Payment non_existent_payment not found');
    });

    it('should handle refund not found error', async () => {
      const gateway = gatewayManager.getGateway('mock');

      await expect(gateway.getRefundStatus('non_existent_refund')).rejects.toThrow('Refund non_existent_refund not found');
    });
  });
});
