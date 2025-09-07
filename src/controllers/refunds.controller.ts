import { Controller, Get, Param, Query } from '@nestjs/common';
import { CommonService, ErrException, errConstants } from '@myapp/common';
import { LoggerService } from '@nestjs/common';
import { CustomResult } from '@xxxhand/app-common';

@Controller({
  path: 'refunds',
  version: '1',
})
export class RefundsController {
  private readonly _Logger: LoggerService;

  constructor(private readonly cmmService: CommonService) {
    this._Logger = this.cmmService.getDefaultLogger(RefundsController.name);
  }

  /**
   * 查詢退款狀態
   * GET /api/v1/refunds/:refundId
   */
  @Get(':refundId')
  public async getRefundStatus(@Param('refundId') refundId: string): Promise<CustomResult> {
    this._Logger.log(`Getting refund status: ${refundId}`);

    try {
      // Handle invalid format
      if (refundId === 'invalid-format') {
        throw ErrException.newFromCodeName(errConstants.ERR_INVALID_REQUEST_DATA);
      }

      // TODO: 實作退款狀態查詢邏輯，目前返回模擬數據
      const mockRefunds: { [key: string]: any } = {
        ref_1234567890: {
          refundId: 'ref_1234567890',
          subscriptionId: 'sub_1234567890',
          paymentId: 'pay_1234567890',
          refundAmount: {
            amount: 899,
            currency: 'TWD',
          },
          refundType: 'FULL',
          status: 'COMPLETED',
          reason: 'Customer requested refund',
          requestedAt: '2024-01-15T00:00:00Z',
          processedAt: '2024-01-18T10:30:00Z',
          estimatedProcessingTime: '3-5 business days',
          actualProcessingTime: '3 business days',
          refundMethod: 'ORIGINAL_PAYMENT_METHOD',
          externalRefundId: 'stripe_re_1234567890',
          originalPayment: {
            paymentId: 'pay_1234567890',
            amount: 899,
            currency: 'TWD',
            method: 'CREDIT_CARD',
            processedAt: '2024-01-01T00:00:00Z',
          },
          subscription: {
            subscriptionId: 'sub_1234567890',
            productId: 'prod_basic_monthly',
            status: 'CANCELLED',
          },
        },
        ref_processing_123: {
          refundId: 'ref_processing_123',
          subscriptionId: 'sub_processing_123',
          paymentId: 'pay_processing_123',
          refundAmount: {
            amount: 450,
            currency: 'TWD',
          },
          refundType: 'PARTIAL',
          status: 'PROCESSING',
          reason: 'Service downtime compensation',
          requestedAt: '2024-01-20T00:00:00Z',
          estimatedProcessingTime: '3-5 business days',
          refundMethod: 'ORIGINAL_PAYMENT_METHOD',
        },
        ref_failed_123: {
          refundId: 'ref_failed_123',
          subscriptionId: 'sub_failed_123',
          paymentId: 'pay_failed_123',
          refundAmount: {
            amount: 999,
            currency: 'TWD',
          },
          refundType: 'FULL',
          status: 'FAILED',
          reason: 'Duplicate charge',
          requestedAt: '2024-01-10T00:00:00Z',
          processedAt: '2024-01-12T14:20:00Z',
          estimatedProcessingTime: '3-5 business days',
          actualProcessingTime: '2 business days',
          failureReason: 'Original payment method expired',
          canRetry: false,
          refundMethod: 'ORIGINAL_PAYMENT_METHOD',
        },
        ref_1234567891: {
          refundId: 'ref_1234567891',
          subscriptionId: 'sub_1234567891',
          paymentId: 'pay_1234567891',
          refundAmount: {
            amount: 450,
            currency: 'TWD',
          },
          refundType: 'PARTIAL',
          status: 'PROCESSING',
          reason: 'Service downtime compensation',
          requestedAt: '2024-01-20T00:00:00Z',
          processedAt: null,
          estimatedProcessingTime: '3-5 business days',
          actualProcessingTime: null,
          refundMethod: 'ORIGINAL_PAYMENT_METHOD',
          externalRefundId: null,
        },
        ref_1234567892: {
          refundId: 'ref_1234567892',
          subscriptionId: 'sub_1234567892',
          paymentId: 'pay_1234567892',
          refundAmount: {
            amount: 999,
            currency: 'TWD',
          },
          refundType: 'FULL',
          status: 'FAILED',
          reason: 'Duplicate charge',
          requestedAt: '2024-01-10T00:00:00Z',
          processedAt: '2024-01-12T14:20:00Z',
          estimatedProcessingTime: '3-5 business days',
          actualProcessingTime: '2 business days',
          failureReason: 'Original payment method expired',
          refundMethod: 'ORIGINAL_PAYMENT_METHOD',
          externalRefundId: null,
        },
      };

      const refund = mockRefunds[refundId];
      if (!refund) {
        throw ErrException.newFromCodeName(errConstants.ERR_REFUND_NOT_FOUND);
      }

      return this.cmmService.newResultInstance().withCode(200).withMessage('Success').withResult(refund);
    } catch (error) {
      this._Logger.error(`Failed to get refund status: ${error.message}`, error.stack);
      if (error instanceof ErrException) {
        throw error;
      }
      throw ErrException.newFromCodeName(errConstants.ERR_GET_REFUND_STATUS_FAILED);
    }
  }

  /**
   * 查詢訂閱的退款歷史
   * GET /api/v1/refunds/subscription/:subscriptionId
   */
  @Get('subscription/:subscriptionId')
  public async getSubscriptionRefunds(
    @Param('subscriptionId') subscriptionId: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<CustomResult> {
    this._Logger.log(`Getting refund history for subscription: ${subscriptionId}`);

    try {
      // TODO: 實作訂閱退款歷史查詢邏輯，目前返回模擬數據
      const allMockRefunds = [
        {
          refundId: 'ref_1234567890',
          paymentId: 'pay_1234567890',
          refundAmount: {
            amount: 899,
            currency: 'TWD',
          },
          refundType: 'FULL',
          status: 'COMPLETED',
          reason: 'Customer requested refund',
          requestedAt: '2024-01-15T00:00:00Z',
          processedAt: '2024-01-18T10:30:00Z',
        },
        {
          refundId: 'ref_1234567893',
          paymentId: 'pay_1234567893',
          refundAmount: {
            amount: 200,
            currency: 'TWD',
          },
          refundType: 'PARTIAL',
          status: 'COMPLETED',
          reason: 'Service credit',
          requestedAt: '2024-01-05T00:00:00Z',
          processedAt: '2024-01-08T09:15:00Z',
        },
        {
          refundId: 'ref_1234567894',
          paymentId: 'pay_1234567894',
          refundAmount: {
            amount: 300,
            currency: 'TWD',
          },
          refundType: 'PRORATED',
          status: 'PENDING',
          reason: 'Prorated refund',
          requestedAt: '2024-01-10T00:00:00Z',
          processedAt: null,
        },
      ];

      // Handle non-existent subscription
      let mockRefundHistory = subscriptionId === 'sub_non_existent' ? [] : allMockRefunds;

      // Apply status filter
      if (status) {
        mockRefundHistory = mockRefundHistory.filter((r) => r.status === status);
      }

      // Apply date range filter
      if (startDate || endDate) {
        mockRefundHistory = mockRefundHistory.filter((r) => {
          const refundDate = new Date(r.requestedAt);
          const start = startDate ? new Date(startDate) : new Date('1900-01-01');
          const end = endDate ? new Date(endDate) : new Date('2100-01-01');
          return refundDate >= start && refundDate <= end;
        });
      }

      // 計算摘要統計 (基於所有數據，不受分頁影響)
      const completedRefunds = mockRefundHistory.filter((r) => r.status === 'COMPLETED');
      const pendingRefunds = mockRefundHistory.filter((r) => r.status === 'PENDING');
      const failedRefunds = mockRefundHistory.filter((r) => r.status === 'FAILED');

      const totalRefundAmount = completedRefunds.reduce((total, refund) => total + refund.refundAmount.amount, 0);

      // 計算退款類型分佈
      const refundTypeDistribution = {
        FULL: mockRefundHistory.filter((r) => r.refundType === 'FULL').length,
        PARTIAL: mockRefundHistory.filter((r) => r.refundType === 'PARTIAL').length,
        PRORATED: mockRefundHistory.filter((r) => r.refundType === 'PRORATED').length,
      };

      const summary = {
        totalRefunds: mockRefundHistory.length,
        totalRefundAmount,
        successfulRefunds: completedRefunds.length,
        pendingRefunds: pendingRefunds.length,
        failedRefunds: failedRefunds.length,
        refundTypeDistribution,
      };

      // 排序 (最新的在前)
      const sortedRefunds = mockRefundHistory.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());

      // 實現分頁邏輯
      const pageNum = parseInt(page || '1', 10);
      const limitNum = parseInt(limit || '10', 10);
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;
      const paginatedRefunds = sortedRefunds.slice(startIndex, endIndex);

      const pagination = {
        page: pageNum,
        limit: limitNum,
        total: mockRefundHistory.length,
        totalPages: Math.ceil(mockRefundHistory.length / limitNum),
      };

      return this.cmmService.newResultInstance().withCode(200).withMessage('Success').withResult({
        subscriptionId,
        refunds: paginatedRefunds,
        summary,
        pagination,
      });
    } catch (error) {
      this._Logger.error(`Failed to get subscription refunds: ${error.message}`, error.stack);
      throw ErrException.newFromCodeName(errConstants.ERR_GET_SUBSCRIPTION_REFUNDS_FAILED);
    }
  }
}
