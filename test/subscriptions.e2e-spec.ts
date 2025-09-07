import { HttpStatus } from '@nestjs/common';
import * as superTest from 'supertest';
import { AppHelper } from './__helpers__/app.helper';

describe('SubscriptionsController (e2e)', () => {
  let agent: superTest.SuperAgentTest;

  beforeAll(async () => {
    agent = await AppHelper.getAgentWithMockers(new Map());
  });

  afterAll(async () => {
    await AppHelper.closeAgent();
  });

  describe('POST /api/v1/subscriptions', () => {
    it('should create a new subscription successfully', async () => {
      const requestBody = {
        productId: 'prod_basic_monthly',
        paymentMethodId: 'pm_1234567890',
        promotionCode: 'SUMMER2024',
        startDate: '2024-01-01T00:00:00Z',
        billingAddress: {
          country: 'TW',
          city: 'Taipei',
          postalCode: '10001',
        },
      };

      const response = await agent.post('/api/v1/subscriptions').send(requestBody).expect(HttpStatus.CREATED);

      expect(response.body).toHaveProperty('traceId');
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('result');

      const subscription = response.body.result;
      expect(subscription).toHaveProperty('subscriptionId');
      expect(subscription).toHaveProperty('status', 'ACTIVE');
      expect(subscription).toHaveProperty('productId', requestBody.productId);
      expect(subscription).toHaveProperty('currentPeriod');
      expect(subscription).toHaveProperty('pricing');

      // 驗證計費週期
      expect(subscription.currentPeriod).toHaveProperty('startDate');
      expect(subscription.currentPeriod).toHaveProperty('endDate');
      expect(subscription.currentPeriod).toHaveProperty('nextBillingDate');

      // 驗證定價資訊
      expect(subscription.pricing).toHaveProperty('baseAmount');
      expect(subscription.pricing).toHaveProperty('finalAmount');
      expect(subscription.pricing).toHaveProperty('currency');
    });

    it('should handle invalid product ID', async () => {
      const requestBody = {
        productId: 'prod_invalid',
        paymentMethodId: 'pm_1234567890',
      };

      const response = await agent.post('/api/v1/subscriptions').send(requestBody).expect(HttpStatus.BAD_REQUEST);

      expect(response.body).toHaveProperty('traceId');
      expect(response.body).toHaveProperty('code');
      expect(response.body.code).not.toBe(200);
      expect(response.body).toHaveProperty('message');
    });

    it('should handle missing required fields', async () => {
      const requestBody = {
        productId: 'prod_basic_monthly',
        // 缺少 paymentMethodId
      };

      const response = await agent.post('/api/v1/subscriptions').send(requestBody).expect(HttpStatus.BAD_REQUEST);

      expect(response.body).toHaveProperty('traceId');
      expect(response.body).toHaveProperty('code');
      expect(response.body.code).not.toBe(200);
    });
  });

  describe('GET /api/v1/subscriptions/:subscriptionId', () => {
    it('should return subscription details', async () => {
      const subscriptionId = 'sub_1234567890';

      const response = await agent.get(`/api/v1/subscriptions/${subscriptionId}`).expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('traceId');
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('result');

      const subscription = response.body.result;
      expect(subscription).toHaveProperty('subscriptionId', subscriptionId);
      expect(subscription).toHaveProperty('status');
      expect(subscription).toHaveProperty('productId');
      expect(subscription).toHaveProperty('customerId');
      expect(subscription).toHaveProperty('currentPeriod');
      expect(subscription).toHaveProperty('pricing');
      expect(subscription).toHaveProperty('paymentMethod');
      expect(subscription).toHaveProperty('billingHistory');
    });

    it('should return 404 for non-existent subscription', async () => {
      const subscriptionId = 'sub_non_existent';

      const response = await agent.get(`/api/v1/subscriptions/${subscriptionId}`).expect(HttpStatus.NOT_FOUND);

      expect(response.body).toHaveProperty('traceId');
      expect(response.body).toHaveProperty('code');
      expect(response.body.code).not.toBe(200);
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /api/v1/subscriptions/:subscriptionId/cancel', () => {
    it('should cancel subscription successfully', async () => {
      const subscriptionId = 'sub_1234567890';
      const requestBody = {
        reason: 'User requested cancellation',
        immediate: false,
      };

      const response = await agent.post(`/api/v1/subscriptions/${subscriptionId}/cancel`).send(requestBody).expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('traceId');
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('result');

      const cancellation = response.body.result;
      expect(cancellation).toHaveProperty('subscriptionId', subscriptionId);
      expect(cancellation).toHaveProperty('status', 'CANCELLED');
      expect(cancellation).toHaveProperty('cancelledAt');
      expect(cancellation).toHaveProperty('effectiveDate');
      expect(cancellation).toHaveProperty('reason', requestBody.reason);
    });

    it('should handle immediate cancellation', async () => {
      const subscriptionId = 'sub_1234567890';
      const requestBody = {
        reason: 'Immediate cancellation requested',
        immediate: true,
      };

      const response = await agent.post(`/api/v1/subscriptions/${subscriptionId}/cancel`).send(requestBody).expect(HttpStatus.OK);

      expect(response.body.code).toBe(200);
      expect(response.body.result).toHaveProperty('status', 'CANCELLED');
      expect(response.body.result).toHaveProperty('refund');
    });

    it('should return 404 for non-existent subscription', async () => {
      const subscriptionId = 'sub_non_existent';
      const requestBody = {
        reason: 'Test cancellation',
        immediate: false,
      };

      await agent.post(`/api/v1/subscriptions/${subscriptionId}/cancel`).send(requestBody).expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('POST /api/v1/subscriptions/:subscriptionId/plan-change', () => {
    it('should change subscription plan successfully', async () => {
      const subscriptionId = 'sub_1234567890';
      const requestBody = {
        newProductId: 'prod_premium_monthly',
        effectiveDate: 'next_billing_cycle',
        prorationBehavior: 'create_prorations',
      };

      const response = await agent.post(`/api/v1/subscriptions/${subscriptionId}/plan-change`).send(requestBody).expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('traceId');
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('result');

      const planChange = response.body.result;
      expect(planChange).toHaveProperty('subscriptionId', subscriptionId);
      expect(planChange).toHaveProperty('oldProductId');
      expect(planChange).toHaveProperty('newProductId', requestBody.newProductId);
      expect(planChange).toHaveProperty('effectiveDate');
      expect(planChange).toHaveProperty('pricingAdjustment');
    });

    it('should handle immediate plan change with proration', async () => {
      const subscriptionId = 'sub_1234567890';
      const requestBody = {
        newProductId: 'prod_premium_monthly',
        effectiveDate: 'immediate',
        prorationBehavior: 'create_prorations',
      };

      const response = await agent.post(`/api/v1/subscriptions/${subscriptionId}/plan-change`).send(requestBody).expect(HttpStatus.OK);

      expect(response.body.code).toBe(200);
      expect(response.body.result).toHaveProperty('pricingAdjustment');
      expect(response.body.result.pricingAdjustment).toHaveProperty('prorationAmount');
      expect(response.body.result.pricingAdjustment).toHaveProperty('nextBillingAmount');
    });

    it('should return 404 for non-existent subscription', async () => {
      const subscriptionId = 'sub_non_existent';
      const requestBody = {
        newProductId: 'prod_premium_monthly',
        effectiveDate: 'immediate',
      };

      await agent.post(`/api/v1/subscriptions/${subscriptionId}/plan-change`).send(requestBody).expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('GET /api/v1/subscriptions/:subscriptionId/plan-change-options', () => {
    it('should return available plan change options', async () => {
      const subscriptionId = 'sub_1234567890';

      const response = await agent.get(`/api/v1/subscriptions/${subscriptionId}/plan-change-options`).expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('traceId');
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('result');

      const options = response.body.result;
      expect(options).toHaveProperty('currentProduct');
      expect(options).toHaveProperty('availableProducts');
      expect(Array.isArray(options.availableProducts)).toBe(true);

      // 驗證可用產品結構
      if (options.availableProducts.length > 0) {
        const product = options.availableProducts[0];
        expect(product).toHaveProperty('productId');
        expect(product).toHaveProperty('name');
        expect(product).toHaveProperty('pricing');
        expect(product).toHaveProperty('priceDifference');
        expect(product).toHaveProperty('estimatedChargeDate');
      }
    });

    it('should return 404 for non-existent subscription', async () => {
      const subscriptionId = 'sub_non_existent';

      await agent.get(`/api/v1/subscriptions/${subscriptionId}/plan-change-options`).expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('POST /api/v1/subscriptions/:subscriptionId/pause', () => {
    it('should pause subscription successfully', async () => {
      const subscriptionId = 'sub_1234567890';
      const requestBody = {
        reason: 'Temporary pause requested by user',
        resumeDate: '2024-03-01T00:00:00Z',
      };

      const response = await agent.post(`/api/v1/subscriptions/${subscriptionId}/pause`).send(requestBody).expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('traceId');
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('result');

      const pause = response.body.result;
      expect(pause).toHaveProperty('subscriptionId', subscriptionId);
      expect(pause).toHaveProperty('status', 'PAUSED');
      expect(pause).toHaveProperty('pausedAt');
      expect(pause).toHaveProperty('scheduledResumeDate', requestBody.resumeDate);
      expect(pause).toHaveProperty('reason', requestBody.reason);
    });

    it('should return 404 for non-existent subscription', async () => {
      const subscriptionId = 'sub_non_existent';
      const requestBody = {
        reason: 'Test pause',
        resumeDate: '2024-03-01T00:00:00Z',
      };

      await agent.post(`/api/v1/subscriptions/${subscriptionId}/pause`).send(requestBody).expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('POST /api/v1/subscriptions/:subscriptionId/resume', () => {
    it('should resume paused subscription successfully', async () => {
      const subscriptionId = 'sub_paused_123';

      const response = await agent.post(`/api/v1/subscriptions/${subscriptionId}/resume`).expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('traceId');
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('result');

      const resume = response.body.result;
      expect(resume).toHaveProperty('subscriptionId', subscriptionId);
      expect(resume).toHaveProperty('status', 'ACTIVE');
      expect(resume).toHaveProperty('resumedAt');
      expect(resume).toHaveProperty('nextBillingDate');
    });

    it('should return 400 for non-paused subscription', async () => {
      const subscriptionId = 'sub_1234567890'; // active subscription

      const response = await agent.post(`/api/v1/subscriptions/${subscriptionId}/resume`).expect(HttpStatus.BAD_REQUEST);

      expect(response.body).toHaveProperty('traceId');
      expect(response.body).toHaveProperty('code');
      expect(response.body.code).not.toBe(200);
    });
  });

  describe('POST /api/v1/subscriptions/:subscriptionId/refund', () => {
    it('should process full refund successfully', async () => {
      const subscriptionId = 'sub_1234567890';
      const requestBody = {
        refundType: 'FULL',
        reason: 'Customer requested refund',
      };

      const response = await agent.post(`/api/v1/subscriptions/${subscriptionId}/refund`).send(requestBody).expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('traceId');
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('result');

      const refund = response.body.result;
      expect(refund).toHaveProperty('refundId');
      expect(refund).toHaveProperty('subscriptionId', subscriptionId);
      expect(refund).toHaveProperty('refundType', 'FULL');
      expect(refund).toHaveProperty('refundAmount');
      expect(refund).toHaveProperty('status', 'REQUESTED');
      expect(refund).toHaveProperty('estimatedProcessingTime');
    });

    it('should process partial refund successfully', async () => {
      const subscriptionId = 'sub_1234567890';
      const requestBody = {
        refundType: 'PARTIAL',
        refundAmount: {
          amount: 500,
          currency: 'TWD',
        },
        reason: 'Partial service issue',
      };

      const response = await agent.post(`/api/v1/subscriptions/${subscriptionId}/refund`).send(requestBody).expect(HttpStatus.OK);

      expect(response.body.code).toBe(200);
      expect(response.body.result).toHaveProperty('refundType', 'PARTIAL');
      expect(response.body.result.refundAmount).toEqual(requestBody.refundAmount);
    });

    it('should return 404 for non-existent subscription', async () => {
      const subscriptionId = 'sub_non_existent';
      const requestBody = {
        refundType: 'FULL',
        reason: 'Test refund',
      };

      await agent.post(`/api/v1/subscriptions/${subscriptionId}/refund`).send(requestBody).expect(HttpStatus.NOT_FOUND);
    });
  });
});
