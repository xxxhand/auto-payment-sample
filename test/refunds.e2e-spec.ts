import { HttpStatus } from '@nestjs/common';
import * as superTest from 'supertest';
import { AppHelper } from './__helpers__/app.helper';

describe('RefundsController (e2e)', () => {
  let agent: superTest.SuperAgentTest;

  beforeAll(async () => {
    agent = await AppHelper.getAgentWithMockers(new Map());
  });

  afterAll(async () => {
    await AppHelper.closeAgent();
  });

  describe('GET /api/v1/refunds/:refundId', () => {
    it('should return refund status for completed refund', async () => {
      const refundId = 'ref_1234567890';

      const response = await agent.get(`/api/v1/refunds/${refundId}`).expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('traceId');
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('result');

      // 驗證退款基本資訊
      const refund = response.body.result;
      expect(refund).toHaveProperty('refundId', refundId);
      expect(refund).toHaveProperty('status');
      expect(refund).toHaveProperty('refundAmount');
      expect(refund).toHaveProperty('refundType');
      expect(refund).toHaveProperty('requestedAt');
      expect(refund).toHaveProperty('processedAt');
      expect(refund).toHaveProperty('estimatedProcessingTime');

      // 驗證金額結構
      expect(refund.refundAmount).toHaveProperty('amount');
      expect(refund.refundAmount).toHaveProperty('currency');
      expect(typeof refund.refundAmount.amount).toBe('number');
      expect(typeof refund.refundAmount.currency).toBe('string');

      // 驗證相關資訊
      expect(refund).toHaveProperty('originalPayment');
      expect(refund).toHaveProperty('subscription');
    });

    it('should return refund status for processing refund', async () => {
      const refundId = 'ref_processing_123';

      const response = await agent.get(`/api/v1/refunds/${refundId}`).expect(HttpStatus.OK);

      expect(response.body.code).toBe(200);
      expect(response.body.result).toHaveProperty('status', 'PROCESSING');
      expect(response.body.result).toHaveProperty('estimatedProcessingTime');
      expect(response.body.result).not.toHaveProperty('processedAt');
      expect(response.body.result).not.toHaveProperty('actualProcessingTime');
    });

    it('should return refund status for failed refund', async () => {
      const refundId = 'ref_failed_123';

      const response = await agent.get(`/api/v1/refunds/${refundId}`).expect(HttpStatus.OK);

      expect(response.body.code).toBe(200);
      expect(response.body.result).toHaveProperty('status', 'FAILED');
      expect(response.body.result).toHaveProperty('failureReason');
      expect(response.body.result).toHaveProperty('canRetry');
      expect(typeof response.body.result.canRetry).toBe('boolean');
    });

    it('should return 404 for non-existent refund', async () => {
      const refundId = 'ref_non_existent';

      const response = await agent.get(`/api/v1/refunds/${refundId}`).expect(HttpStatus.NOT_FOUND);

      expect(response.body).toHaveProperty('traceId');
      expect(response.body).toHaveProperty('code');
      expect(response.body.code).not.toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Refund not found');
    });

    it('should handle invalid refund ID format', async () => {
      const refundId = 'invalid-format';

      const response = await agent.get(`/api/v1/refunds/${refundId}`).expect(HttpStatus.BAD_REQUEST);

      expect(response.body).toHaveProperty('traceId');
      expect(response.body).toHaveProperty('code');
      expect(response.body.code).not.toBe(200);
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('GET /api/v1/refunds/subscription/:subscriptionId', () => {
    it('should return refund history for subscription', async () => {
      const subscriptionId = 'sub_1234567890';

      const response = await agent.get(`/api/v1/refunds/subscription/${subscriptionId}`).expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('traceId');
      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('result');

      // 驗證退款歷史結構
      const data = response.body.result;
      expect(data).toHaveProperty('subscriptionId', subscriptionId);
      expect(data).toHaveProperty('refunds');
      expect(data).toHaveProperty('summary');
      expect(Array.isArray(data.refunds)).toBe(true);

      // 驗證摘要資訊
      const summary = data.summary;
      expect(summary).toHaveProperty('totalRefunds');
      expect(summary).toHaveProperty('totalRefundAmount');
      expect(summary).toHaveProperty('successfulRefunds');
      expect(summary).toHaveProperty('pendingRefunds');
      expect(summary).toHaveProperty('failedRefunds');
      expect(typeof summary.totalRefunds).toBe('number');
      expect(typeof summary.successfulRefunds).toBe('number');

      // 驗證退款記錄結構
      if (data.refunds.length > 0) {
        const refund = data.refunds[0];
        expect(refund).toHaveProperty('refundId');
        expect(refund).toHaveProperty('status');
        expect(refund).toHaveProperty('refundAmount');
        expect(refund).toHaveProperty('refundType');
        expect(refund).toHaveProperty('requestedAt');
      }
    });

    it('should filter refunds by status', async () => {
      const subscriptionId = 'sub_1234567890';

      const response = await agent.get(`/api/v1/refunds/subscription/${subscriptionId}?status=COMPLETED`).expect(HttpStatus.OK);

      expect(response.body.code).toBe(200);

      // 所有退款都應該是已完成狀態
      response.body.result.refunds.forEach((refund: any) => {
        expect(refund.status).toBe('COMPLETED');
      });
    });

    it('should filter refunds by date range', async () => {
      const subscriptionId = 'sub_1234567890';
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';

      const response = await agent.get(`/api/v1/refunds/subscription/${subscriptionId}?startDate=${startDate}&endDate=${endDate}`).expect(HttpStatus.OK);

      expect(response.body.code).toBe(200);
      expect(response.body.result.refunds).toBeDefined();

      // 驗證日期範圍
      response.body.result.refunds.forEach((refund: any) => {
        const refundDate = new Date(refund.requestedAt);
        expect(refundDate).toBeInstanceOf(Date);
        expect(refundDate.getFullYear()).toBe(2024);
      });
    });

    it('should return empty history for non-existent subscription', async () => {
      const subscriptionId = 'sub_non_existent';

      const response = await agent.get(`/api/v1/refunds/subscription/${subscriptionId}`).expect(HttpStatus.OK);

      expect(response.body.code).toBe(200);
      expect(response.body.result.refunds).toEqual([]);
      expect(response.body.result.summary.totalRefunds).toBe(0);
    });

    it('should handle pagination', async () => {
      const subscriptionId = 'sub_1234567890';

      const response = await agent.get(`/api/v1/refunds/subscription/${subscriptionId}?page=1&limit=5`).expect(HttpStatus.OK);

      expect(response.body.code).toBe(200);
      expect(response.body.result).toHaveProperty('pagination');

      const pagination = response.body.result.pagination;
      expect(pagination).toHaveProperty('page', 1);
      expect(pagination).toHaveProperty('limit', 5);
      expect(pagination).toHaveProperty('total');
      expect(pagination).toHaveProperty('totalPages');
      expect(typeof pagination.total).toBe('number');
      expect(typeof pagination.totalPages).toBe('number');
    });

    it('should sort refunds by date (newest first by default)', async () => {
      const subscriptionId = 'sub_1234567890';

      const response = await agent.get(`/api/v1/refunds/subscription/${subscriptionId}`).expect(HttpStatus.OK);

      expect(response.body.code).toBe(200);

      const refunds = response.body.result.refunds;
      if (refunds.length > 1) {
        // 驗證按時間倒序排列
        for (let i = 0; i < refunds.length - 1; i++) {
          const currentDate = new Date(refunds[i].requestedAt);
          const nextDate = new Date(refunds[i + 1].requestedAt);
          expect(currentDate.getTime()).toBeGreaterThanOrEqual(nextDate.getTime());
        }
      }
    });

    it('should include refund type distribution', async () => {
      const subscriptionId = 'sub_1234567890';

      const response = await agent.get(`/api/v1/refunds/subscription/${subscriptionId}`).expect(HttpStatus.OK);

      expect(response.body.code).toBe(200);
      expect(response.body.result.summary).toHaveProperty('refundTypeDistribution');

      const distribution = response.body.result.summary.refundTypeDistribution;
      expect(distribution).toHaveProperty('FULL');
      expect(distribution).toHaveProperty('PARTIAL');
      expect(distribution).toHaveProperty('PRORATED');
    });
  });
});
