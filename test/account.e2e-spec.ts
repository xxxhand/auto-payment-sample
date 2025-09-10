import { HttpStatus } from '@nestjs/common';
import * as superTest from 'supertest';
import { AppHelper } from './__helpers__/app.helper';
import { MongoHelper } from './__helpers__/mongo.helper';

describe('AccountController (e2e)', () => {
  let agent: superTest.SuperAgentTest;
  const dbHelper = new MongoHelper('AccountController');
  const db = dbHelper.mongo;

  beforeAll(async () => {
    agent = await AppHelper.getAgent();
    await db.tryConnect();
  });
  afterAll(async () => {
    await AppHelper.closeAgent();
    await dbHelper.clear();
    db.close();
  });

  describe('GET /api/v1/account/profile', () => {
    it('should return account profile information', async () => {
      const response = await agent.get('/api/v1/account/profile').expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('traceId');
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('result');

      const profile = response.body.result;
      expect(profile).toHaveProperty('customerId');
      expect(profile).toHaveProperty('email');
      expect(profile).toHaveProperty('name');
      expect(profile).toHaveProperty('subscriptions');
      expect(profile).toHaveProperty('paymentMethods');
      expect(profile).toHaveProperty('billingAddress');
      expect(profile).toHaveProperty('preferences');

      // 驗證訂閱摘要
      expect(profile.subscriptions).toHaveProperty('total');
      expect(profile.subscriptions).toHaveProperty('active');
      expect(profile.subscriptions).toHaveProperty('paused');

      // 驗證支付方式摘要
      expect(profile.paymentMethods).toHaveProperty('total');
      expect(profile.paymentMethods).toHaveProperty('default');

      // 驗證偏好設定
      expect(profile.preferences).toHaveProperty('currency');
      expect(profile.preferences).toHaveProperty('timezone');
      expect(profile.preferences).toHaveProperty('notifications');
    });
  });

  describe('GET /api/v1/account/payment-methods', () => {
    it('should return all payment methods', async () => {
      const response = await agent.get('/api/v1/account/payment-methods').expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('traceId');
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('result');

      const data = response.body.result;
      expect(data).toHaveProperty('paymentMethods');
      expect(Array.isArray(data.paymentMethods)).toBe(true);

      // 驗證支付方式結構
      if (data.paymentMethods.length > 0) {
        const paymentMethod = data.paymentMethods[0];
        expect(paymentMethod).toHaveProperty('paymentMethodId');
        expect(paymentMethod).toHaveProperty('type');
        expect(paymentMethod).toHaveProperty('isDefault');
        expect(paymentMethod).toHaveProperty('status');
        expect(paymentMethod).toHaveProperty('createdAt');
        expect(paymentMethod).toHaveProperty('lastUsedAt');

        // 驗證卡片資訊（脫敏顯示）
        if (paymentMethod.type === 'CREDIT_CARD') {
          expect(paymentMethod).toHaveProperty('card');
          expect(paymentMethod.card).toHaveProperty('last4');
          expect(paymentMethod.card).toHaveProperty('brand');
          expect(paymentMethod.card).toHaveProperty('expMonth');
          expect(paymentMethod.card).toHaveProperty('expYear');
        }
      }
    });
  });

  describe('POST /api/v1/account/payment-methods', () => {
    it('should add new credit card payment method', async () => {
      const requestBody = {
        type: 'CREDIT_CARD',
        card: {
          number: '4242424242424242',
          expMonth: 12,
          expYear: 2025,
          cvc: '123',
          holderName: 'John Doe',
        },
        billingAddress: {
          country: 'TW',
          city: 'Taipei',
          postalCode: '10001',
          address: '123 Main St',
        },
      };

      const response = await agent.post('/api/v1/account/payment-methods').send(requestBody).expect(HttpStatus.CREATED);

      expect(response.body).toHaveProperty('traceId');
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('result');

      const paymentMethod = response.body.result;
      expect(paymentMethod).toHaveProperty('paymentMethodId');
      expect(paymentMethod).toHaveProperty('type', 'CREDIT_CARD');
      expect(paymentMethod).toHaveProperty('status', 'ACTIVE');
      expect(paymentMethod).toHaveProperty('isDefault');

      // 驗證脫敏的卡片資訊
      expect(paymentMethod.card).toHaveProperty('last4', '4242');
      expect(paymentMethod.card).toHaveProperty('brand');
      expect(paymentMethod.card).not.toHaveProperty('number');
      expect(paymentMethod.card).not.toHaveProperty('cvc');
    });

    it('should handle invalid card number', async () => {
      const requestBody = {
        type: 'CREDIT_CARD',
        card: {
          number: '1234567890123456', // invalid
          expMonth: 12,
          expYear: 2025,
          cvc: '123',
          holderName: 'John Doe',
        },
      };

      const response = await agent.post('/api/v1/account/payment-methods').send(requestBody).expect(HttpStatus.BAD_REQUEST);

      expect(response.body).toHaveProperty('traceId');
      expect(response.body).toHaveProperty('code');
      expect(response.body.code).not.toBe(200);
      expect(response.body).toHaveProperty('message');
    });

    it('should handle expired card', async () => {
      const requestBody = {
        type: 'CREDIT_CARD',
        card: {
          number: '4242424242424242',
          expMonth: 12,
          expYear: 2020, // expired
          cvc: '123',
          holderName: 'John Doe',
        },
      };

      const response = await agent.post('/api/v1/account/payment-methods').send(requestBody).expect(HttpStatus.BAD_REQUEST);

      expect(response.body).toHaveProperty('code');
      expect(response.body.code).not.toBe(200);
      expect(response.body.message).toContain('expired');
    });
  });

  describe('PUT /api/v1/account/payment-methods/:paymentMethodId', () => {
    it('should update payment method successfully', async () => {
      const paymentMethodId = 'pm_1234567890';
      const requestBody = {
        billingAddress: {
          country: 'TW',
          city: 'New Taipei',
          postalCode: '24001',
          address: '456 Updated St',
        },
        metadata: {
          nickname: 'My Primary Card',
        },
      };

      const response = await agent.put(`/api/v1/account/payment-methods/${paymentMethodId}`).send(requestBody).expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('traceId');
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('result');

      const paymentMethod = response.body.result;
      expect(paymentMethod).toHaveProperty('paymentMethodId', paymentMethodId);
      expect(paymentMethod).toHaveProperty('updatedAt');
      expect(paymentMethod.billingAddress).toMatchObject(requestBody.billingAddress);
      expect(paymentMethod.metadata).toMatchObject(requestBody.metadata);
    });

    it('should return 404 for non-existent payment method', async () => {
      const paymentMethodId = 'pm_non_existent';
      const requestBody = {
        billingAddress: {
          country: 'TW',
          city: 'Taipei',
        },
      };

      const response = await agent.put(`/api/v1/account/payment-methods/${paymentMethodId}`).send(requestBody).expect(HttpStatus.NOT_FOUND);

      expect(response.body).toHaveProperty('traceId');
      expect(response.body).toHaveProperty('code');
      expect(response.body.code).not.toBe(200);
    });
  });

  describe('DELETE /api/v1/account/payment-methods/:paymentMethodId', () => {
    it('should delete payment method successfully', async () => {
      const paymentMethodId = 'pm_deletable_123';

      const response = await agent.delete(`/api/v1/account/payment-methods/${paymentMethodId}`).expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('traceId');
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('result');

      const result = response.body.result;
      expect(result).toHaveProperty('paymentMethodId', paymentMethodId);
      expect(result).toHaveProperty('status', 'DELETED');
      expect(result).toHaveProperty('deletedAt');
    });

    it('should not delete default payment method with active subscriptions', async () => {
      const paymentMethodId = 'pm_default_with_subscriptions';

      const response = await agent.delete(`/api/v1/account/payment-methods/${paymentMethodId}`).expect(HttpStatus.BAD_REQUEST);

      expect(response.body).toHaveProperty('traceId');
      expect(response.body).toHaveProperty('code');
      expect(response.body.code).not.toBe(200);
      expect(response.body.message).toContain('default payment method');
      expect(response.body.message).toContain('active subscriptions');
    });

    it('should return 404 for non-existent payment method', async () => {
      const paymentMethodId = 'pm_non_existent';

      await agent.delete(`/api/v1/account/payment-methods/${paymentMethodId}`).expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('POST /api/v1/account/payment-methods/:paymentMethodId/set-default', () => {
    it('should set payment method as default successfully', async () => {
      const paymentMethodId = 'pm_1234567890';

      const response = await agent.post(`/api/v1/account/payment-methods/${paymentMethodId}/set-default`).expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('traceId');
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('result');

      const result = response.body.result;
      expect(result).toHaveProperty('paymentMethodId', paymentMethodId);
      expect(result).toHaveProperty('isDefault', true);
      expect(result).toHaveProperty('previousDefault');
    });

    it('should handle already default payment method', async () => {
      const paymentMethodId = 'pm_already_default';

      const response = await agent.post(`/api/v1/account/payment-methods/${paymentMethodId}/set-default`).expect(HttpStatus.OK);

      expect(response.body.code).toBe(200);
      expect(response.body.result).toHaveProperty('isDefault', true);
      expect(response.body.result).toHaveProperty('message', 'Payment method is already the default');
    });

    it('should return 404 for non-existent payment method', async () => {
      const paymentMethodId = 'pm_non_existent';

      await agent.post(`/api/v1/account/payment-methods/${paymentMethodId}/set-default`).expect(HttpStatus.NOT_FOUND);
    });

    it('should not set inactive payment method as default', async () => {
      const paymentMethodId = 'pm_inactive_123';

      const response = await agent.post(`/api/v1/account/payment-methods/${paymentMethodId}/set-default`).expect(HttpStatus.BAD_REQUEST);

      expect(response.body).toHaveProperty('code');
      expect(response.body.code).not.toBe(200);
      expect(response.body.message).toContain('inactive payment method');
    });
  });
});
