import { HttpStatus } from '@nestjs/common';
import * as superTest from 'supertest';
import { AppHelper } from './__helpers__/app.helper';

describe('ProductsController (e2e)', () => {
  let agent: superTest.SuperAgentTest;

  beforeAll(async () => {
    agent = await AppHelper.getAgentWithMockers(new Map());
  });

  afterAll(async () => {
    await AppHelper.closeAgent();
  });

  describe('GET /api/v1/products', () => {
    it('should return all products', async () => {
      const response = await agent.get('/api/v1/products').expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('traceId');
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('result');
      expect(response.body.result).toHaveProperty('products');
      expect(Array.isArray(response.body.result.products)).toBe(true);
      expect(response.body.result.products.length).toBeGreaterThan(0);

      // 驗證產品結構
      const product = response.body.result.products[0];
      expect(product).toHaveProperty('productId');
      expect(product).toHaveProperty('name');
      expect(product).toHaveProperty('description');
      expect(product).toHaveProperty('pricing');
      expect(product).toHaveProperty('billing');
      expect(product).toHaveProperty('features');
      expect(product).toHaveProperty('status');
    });

    it('should filter products by status', async () => {
      const response = await agent.get('/api/v1/products?status=ACTIVE').expect(HttpStatus.OK);

      expect(response.body.code).toBe(200);
      expect(response.body.result.products).toBeDefined();

      // 所有產品都應該是ACTIVE狀態
      response.body.result.products.forEach((product: any) => {
        expect(product.status).toBe('ACTIVE');
      });
    });

    it('should filter products by billing interval', async () => {
      const response = await agent.get('/api/v1/products?billing_interval=MONTHLY').expect(HttpStatus.OK);

      expect(response.body.code).toBe(200);
      expect(response.body.result.products).toBeDefined();

      // 所有產品都應該是月付
      response.body.result.products.forEach((product: any) => {
        expect(product.billing.interval).toBe('MONTHLY');
      });
    });

    it('should return empty array for invalid status', async () => {
      const response = await agent.get('/api/v1/products?status=INVALID_STATUS').expect(HttpStatus.OK);

      expect(response.body.code).toBe(200);
      expect(response.body.result.products).toEqual([]);
    });
  });

  describe('GET /api/v1/products/:productId', () => {
    it('should return specific product details', async () => {
      const productId = 'prod_basic_monthly';

      const response = await agent.get(`/api/v1/products/${productId}`).expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('traceId');
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('result');
      expect(response.body.result).toHaveProperty('productId', productId);
      expect(response.body.result).toHaveProperty('name');
      expect(response.body.result).toHaveProperty('description');
      expect(response.body.result).toHaveProperty('pricing');
      expect(response.body.result).toHaveProperty('billing');
      expect(response.body.result).toHaveProperty('features');

      // 驗證定價結構
      expect(response.body.result.pricing).toHaveProperty('amount');
      expect(response.body.result.pricing).toHaveProperty('currency');
      expect(typeof response.body.result.pricing.amount).toBe('number');
      expect(typeof response.body.result.pricing.currency).toBe('string');

      // 驗證計費結構
      expect(response.body.result.billing).toHaveProperty('interval');
      expect(response.body.result.billing).toHaveProperty('trial_days');
    });

    it('should return 404 for non-existent product', async () => {
      const productId = 'prod_non_existent';

      const response = await agent.get(`/api/v1/products/${productId}`).expect(HttpStatus.NOT_FOUND);

      expect(response.body).toHaveProperty('traceId');
      expect(response.body).toHaveProperty('code');
      expect(response.body.code).not.toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Product not found');
    });

    it('should handle invalid product ID format', async () => {
      const productId = 'invalid-id-format';

      const response = await agent.get(`/api/v1/products/${productId}`).expect(HttpStatus.NOT_FOUND);

      expect(response.body).toHaveProperty('traceId');
      expect(response.body).toHaveProperty('code');
      expect(response.body.code).not.toBe(200);
    });
  });

  describe('GET /api/v1/products/:productId/upgrade-options', () => {
    it('should return upgrade options for basic plan', async () => {
      const productId = 'prod_basic_monthly';

      const response = await agent.get(`/api/v1/products/${productId}/upgrade-options`).expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('traceId');
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('result');
      expect(response.body.result).toHaveProperty('currentProduct');
      expect(response.body.result).toHaveProperty('upgradeOptions');
      expect(Array.isArray(response.body.result.upgradeOptions)).toBe(true);

      // 驗證升級選項結構
      if (response.body.result.upgradeOptions.length > 0) {
        const upgradeOption = response.body.result.upgradeOptions[0];
        expect(upgradeOption).toHaveProperty('productId');
        expect(upgradeOption).toHaveProperty('name');
        expect(upgradeOption).toHaveProperty('pricing');
        expect(upgradeOption).toHaveProperty('priceDifference');
        expect(upgradeOption).toHaveProperty('estimatedChargeDate');
      }
    });

    it('should return empty options for premium plan', async () => {
      const productId = 'prod_premium_monthly';

      const response = await agent.get(`/api/v1/products/${productId}/upgrade-options`).expect(HttpStatus.OK);

      expect(response.body.code).toBe(200);
      expect(response.body.result.upgradeOptions).toEqual([]);
    });

    it('should return 404 for non-existent product', async () => {
      const productId = 'prod_non_existent';

      await agent.get(`/api/v1/products/${productId}/upgrade-options`).expect(HttpStatus.NOT_FOUND);
    });
  });
});
