import { HttpStatus } from '@nestjs/common';
import * as superTest from 'supertest';
import { AppHelper } from './__helpers__/app.helper';

describe('PromotionsController (e2e)', () => {
  let agent: superTest.SuperAgentTest;

  beforeAll(async () => {
    agent = await AppHelper.getAgentWithMockers(new Map());
  });

  afterAll(async () => {
    await AppHelper.closeAgent();
  });

  describe('POST /api/v1/promotions/validate', () => {
    it('should validate a valid promotion code', async () => {
      const requestBody = {
        code: 'SUMMER2024',
        productId: 'prod_basic_monthly',
        customerId: 'cust_1234567890',
      };

      const response = await agent.post('/api/v1/promotions/validate').send(requestBody).expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('traceId');
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('result');
      expect(response.body.result).toHaveProperty('valid', true);
      expect(response.body.result).toHaveProperty('promotion');
      expect(response.body.result).toHaveProperty('discount');
      expect(response.body.result).toHaveProperty('eligibility');

      // 驗證優惠資訊結構
      const promotion = response.body.result.promotion;
      expect(promotion).toHaveProperty('code');
      expect(promotion).toHaveProperty('name');
      expect(promotion).toHaveProperty('description');
      expect(promotion).toHaveProperty('type');
      expect(promotion).toHaveProperty('status');

      // 驗證折扣資訊
      const discount = response.body.result.discount;
      expect(discount).toHaveProperty('type');
      expect(discount).toHaveProperty('value');
      expect(discount).toHaveProperty('applicablePeriod');

      // 驗證資格檢查
      const eligibility = response.body.result.eligibility;
      expect(eligibility).toHaveProperty('eligible', true);
      expect(eligibility).toHaveProperty('reasons');
    });

    it('should return invalid for expired promotion code', async () => {
      const requestBody = {
        code: 'EXPIRED2023',
        productId: 'prod_basic_monthly',
        customerId: 'cust_1234567890',
      };

      const response = await agent.post('/api/v1/promotions/validate').send(requestBody).expect(HttpStatus.OK);

      expect(response.body.code).toBe(200);
      expect(response.body.result).toHaveProperty('valid', false);
      expect(response.body.result).toHaveProperty('eligibility');
      expect(response.body.result.eligibility).toHaveProperty('eligible', false);
      expect(response.body.result.eligibility.reasons).toContain('Promotion code has expired');
    });

    it('should return invalid for non-existent promotion code', async () => {
      const requestBody = {
        code: 'NONEXISTENT',
        productId: 'prod_basic_monthly',
        customerId: 'cust_1234567890',
      };

      const response = await agent.post('/api/v1/promotions/validate').send(requestBody).expect(HttpStatus.NOT_FOUND);

      expect(response.body).toHaveProperty('traceId');
      expect(response.body).toHaveProperty('code');
      expect(response.body.code).not.toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Promotion code not found');
    });

    it('should return validation error for missing required fields', async () => {
      const requestBody = {
        code: 'SUMMER2024',
        // 缺少 productId 和 customerId
      };

      const response = await agent.post('/api/v1/promotions/validate').send(requestBody).expect(HttpStatus.BAD_REQUEST);

      expect(response.body).toHaveProperty('traceId');
      expect(response.body).toHaveProperty('code');
      expect(response.body.code).not.toBe(200);
      expect(response.body).toHaveProperty('message');
    });

    it('should handle product-specific promotion eligibility', async () => {
      const requestBody = {
        code: 'PREMIUM_ONLY',
        productId: 'prod_basic_monthly',
        customerId: 'cust_1234567890',
      };

      const response = await agent.post('/api/v1/promotions/validate').send(requestBody).expect(HttpStatus.OK);

      expect(response.body.code).toBe(200);
      expect(response.body.result).toHaveProperty('valid', false);
      expect(response.body.result.eligibility).toHaveProperty('eligible', false);
      expect(response.body.result.eligibility.reasons).toContain('Product not eligible for this promotion');
    });

    it('should handle customer-specific promotion eligibility', async () => {
      const requestBody = {
        code: 'NEW_CUSTOMER_ONLY',
        productId: 'prod_basic_monthly',
        customerId: 'cust_existing_customer',
      };

      const response = await agent.post('/api/v1/promotions/validate').send(requestBody).expect(HttpStatus.OK);

      expect(response.body.code).toBe(200);
      expect(response.body.result).toHaveProperty('valid', false);
      expect(response.body.result.eligibility).toHaveProperty('eligible', false);
      expect(response.body.result.eligibility.reasons).toContain('Customer not eligible for this promotion');
    });
  });

  describe('GET /api/v1/promotions', () => {
    it('should return available promotions for product', async () => {
      const response = await agent.get('/api/v1/promotions?productId=prod_basic_monthly').expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('traceId');
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('result');
      expect(response.body.result).toHaveProperty('promotions');
      expect(Array.isArray(response.body.result.promotions)).toBe(true);

      // 驗證優惠清單結構
      if (response.body.result.promotions.length > 0) {
        const promotion = response.body.result.promotions[0];
        expect(promotion).toHaveProperty('code');
        expect(promotion).toHaveProperty('name');
        expect(promotion).toHaveProperty('description');
        expect(promotion).toHaveProperty('type');
        expect(promotion).toHaveProperty('discount');
        expect(promotion).toHaveProperty('validFrom');
        expect(promotion).toHaveProperty('validUntil');
        expect(promotion).toHaveProperty('status');
      }
    });

    it('should filter promotions by customer eligibility', async () => {
      const response = await agent.get('/api/v1/promotions?productId=prod_basic_monthly&customerId=cust_1234567890').expect(HttpStatus.OK);

      expect(response.body.code).toBe(200);
      expect(response.body.result.promotions).toBeDefined();

      // 所有返回的優惠都應該是該客戶可用的
      response.body.result.promotions.forEach((promotion: any) => {
        expect(promotion.status).toBe('ACTIVE');
      });
    });

    it('should return empty array for non-existent product', async () => {
      const response = await agent.get('/api/v1/promotions?productId=prod_nonexistent').expect(HttpStatus.OK);

      expect(response.body.code).toBe(200);
      expect(response.body.result.promotions).toEqual([]);
    });

    it('should handle missing productId parameter', async () => {
      const response = await agent.get('/api/v1/promotions').expect(HttpStatus.BAD_REQUEST);

      expect(response.body).toHaveProperty('traceId');
      expect(response.body).toHaveProperty('code');
      expect(response.body.code).not.toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('productId is required');
    });

    it('should filter by promotion type', async () => {
      const response = await agent.get('/api/v1/promotions?productId=prod_basic_monthly&type=PERCENTAGE').expect(HttpStatus.OK);

      expect(response.body.code).toBe(200);

      // 所有返回的優惠都應該是百分比類型
      response.body.result.promotions.forEach((promotion: any) => {
        expect(promotion.discount.type).toBe('PERCENTAGE');
      });
    });

    it('should include usage limits information', async () => {
      const response = await agent.get('/api/v1/promotions?productId=prod_basic_monthly').expect(HttpStatus.OK);

      expect(response.body.code).toBe(200);

      // 驗證使用限制資訊
      response.body.result.promotions.forEach((promotion: any) => {
        expect(promotion).toHaveProperty('usageLimit');
        expect(promotion).toHaveProperty('currentUsage');
        expect(promotion).toHaveProperty('remainingUsage');
      });
    });
  });
});
