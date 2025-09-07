import { Controller, Get, Post, Put, Param, Body, Query, HttpException, HttpStatus } from '@nestjs/common';
import { CommonService } from '@myapp/common';
import { LoggerService } from '@nestjs/common';
import { CustomResult } from '@xxxhand/app-common';
import { PaymentService } from '../domain/services/payment.service';
import { CreatePaymentRequest, PaymentQueryRequest, PaymentOperationRequest, RefundRequest } from '../domain/value-objects/payment.request';

@Controller({
  path: 'payments',
  version: '1',
})
export class PaymentsController {
  private readonly _Logger: LoggerService;

  constructor(
    private readonly cmmService: CommonService,
    private readonly paymentService: PaymentService,
  ) {
    this._Logger = this.cmmService.getDefaultLogger(PaymentsController.name);
  }

  /**
   * 創建支付記錄
   * POST /api/v1/payments
   */
  @Post()
  public async createPayment(@Body() body: CreatePaymentRequest): Promise<CustomResult> {
    this._Logger.log(`Creating payment for subscription: ${body.subscriptionId}`);

    try {
      const payment = await this.paymentService.createPayment(body.subscriptionId, body.customerId, body.paymentMethodId, body.amount, body.currency, body.description);

      return this.cmmService.newResultInstance().withResult({
        paymentId: payment.id,
        subscriptionId: payment.subscriptionId,
        customerId: payment.customerId,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        createdAt: payment.createdAt,
      });
    } catch (error) {
      this._Logger.error(`Failed to create payment: ${error.message}`, error.stack);
      if (error.message.includes('not found')) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      throw new HttpException('Failed to create payment', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 根據 ID 獲取支付記錄
   * GET /api/v1/payments/:id
   */
  @Get(':id')
  public async getPayment(@Param('id') id: string): Promise<CustomResult> {
    this._Logger.log(`Getting payment: ${id}`);

    try {
      const payment = await this.paymentService.getPaymentById(id);
      if (!payment) {
        throw new HttpException('Payment not found', HttpStatus.NOT_FOUND);
      }

      return this.cmmService.newResultInstance().withResult({
        paymentId: payment.id,
        subscriptionId: payment.subscriptionId,
        customerId: payment.customerId,
        paymentMethodId: payment.paymentMethodId,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        attemptCount: payment.attemptCount,
        description: payment.description,
        createdAt: payment.createdAt,
        paidAt: payment.paidAt,
        failedAt: payment.failedAt,
        refundedAmount: payment.refundedAmount,
        externalTransactionId: payment.externalTransactionId,
      });
    } catch (error) {
      this._Logger.error(`Failed to get payment: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to get payment', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 查詢支付記錄
   * GET /api/v1/payments
   */
  @Get()
  public async getPayments(@Query() query: PaymentQueryRequest): Promise<CustomResult> {
    this._Logger.log(`Querying payments with filters: ${JSON.stringify(query)}`);

    try {
      let payments: any[] = [];

      if (query.subscriptionId) {
        payments = await this.paymentService.getPaymentsBySubscriptionId(query.subscriptionId);
      } else if (query.customerId) {
        payments = await this.paymentService.getPaymentsByCustomerId(query.customerId, query.limit);
      } else if (query.status) {
        // 只支持查詢失敗的支付
        if (query.status === 'FAILED') {
          payments = await this.paymentService.getFailedPayments(query.limit);
        } else {
          throw new HttpException('Only failed payment status query is supported', HttpStatus.BAD_REQUEST);
        }
      } else {
        throw new HttpException('At least one filter parameter is required', HttpStatus.BAD_REQUEST);
      }

      return this.cmmService.newResultInstance().withResult({
        payments: payments.map((payment) => ({
          paymentId: payment.id,
          subscriptionId: payment.subscriptionId,
          customerId: payment.customerId,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          createdAt: payment.createdAt,
          paidAt: payment.paidAt,
          failedAt: payment.failedAt,
        })),
        total: payments.length,
      });
    } catch (error) {
      this._Logger.error(`Failed to query payments: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to query payments', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 開始支付嘗試
   * POST /api/v1/payments/:id/attempt
   */
  @Post(':id/attempt')
  public async startPaymentAttempt(@Param('id') id: string): Promise<CustomResult> {
    this._Logger.log(`Starting payment attempt: ${id}`);

    try {
      const payment = await this.paymentService.startPaymentAttempt(id);
      if (!payment) {
        throw new HttpException('Payment not found', HttpStatus.NOT_FOUND);
      }

      return this.cmmService.newResultInstance().withResult({
        paymentId: payment.id,
        status: payment.status,
        attemptCount: payment.attemptCount,
        lastAttemptAt: payment.lastAttemptAt,
      });
    } catch (error) {
      this._Logger.error(`Failed to start payment attempt: ${error.message}`, error.stack);
      if (error.message.includes('not found')) {
        throw new HttpException('Payment not found', HttpStatus.NOT_FOUND);
      }
      if (error.message.includes('cannot be retried')) {
        throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
      }
      throw new HttpException('Failed to start payment attempt', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 標記支付成功
   * PUT /api/v1/payments/:id/success
   */
  @Put(':id/success')
  public async markPaymentSucceeded(@Param('id') id: string, @Body() body: PaymentOperationRequest): Promise<CustomResult> {
    this._Logger.log(`Marking payment as succeeded: ${id}`);

    try {
      const payment = await this.paymentService.markPaymentSucceeded(id, body.externalTransactionId);
      if (!payment) {
        throw new HttpException('Payment not found', HttpStatus.NOT_FOUND);
      }

      return this.cmmService.newResultInstance().withResult({
        paymentId: payment.id,
        status: payment.status,
        paidAt: payment.paidAt,
        externalTransactionId: payment.externalTransactionId,
      });
    } catch (error) {
      this._Logger.error(`Failed to mark payment as succeeded: ${error.message}`, error.stack);
      if (error.message.includes('not found')) {
        throw new HttpException('Payment not found', HttpStatus.NOT_FOUND);
      }
      throw new HttpException('Failed to mark payment as succeeded', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 標記支付失敗
   * PUT /api/v1/payments/:id/failure
   */
  @Put(':id/failure')
  public async markPaymentFailed(@Param('id') id: string, @Body() body: PaymentOperationRequest): Promise<CustomResult> {
    this._Logger.log(`Marking payment as failed: ${id}`);

    try {
      const payment = await this.paymentService.markPaymentFailed(id, body.failureReason, body.failureCode);
      if (!payment) {
        throw new HttpException('Payment not found', HttpStatus.NOT_FOUND);
      }

      return this.cmmService.newResultInstance().withResult({
        paymentId: payment.id,
        status: payment.status,
        failedAt: payment.failedAt,
        failureReason: payment.failureReason,
        failureCode: payment.failureCode,
      });
    } catch (error) {
      this._Logger.error(`Failed to mark payment as failed: ${error.message}`, error.stack);
      if (error.message.includes('not found')) {
        throw new HttpException('Payment not found', HttpStatus.NOT_FOUND);
      }
      throw new HttpException('Failed to mark payment as failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 取消支付
   * PUT /api/v1/payments/:id/cancel
   */
  @Put(':id/cancel')
  public async cancelPayment(@Param('id') id: string): Promise<CustomResult> {
    this._Logger.log(`Canceling payment: ${id}`);

    try {
      const payment = await this.paymentService.cancelPayment(id);
      if (!payment) {
        throw new HttpException('Payment not found', HttpStatus.NOT_FOUND);
      }

      return this.cmmService.newResultInstance().withResult({
        paymentId: payment.id,
        status: payment.status,
        updatedAt: payment.updatedAt,
      });
    } catch (error) {
      this._Logger.error(`Failed to cancel payment: ${error.message}`, error.stack);
      if (error.message.includes('not found')) {
        throw new HttpException('Payment not found', HttpStatus.NOT_FOUND);
      }
      throw new HttpException('Failed to cancel payment', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 處理退款
   * POST /api/v1/payments/:id/refund
   */
  @Post(':id/refund')
  public async processRefund(@Param('id') id: string, @Body() body: RefundRequest): Promise<CustomResult> {
    this._Logger.log(`Processing refund for payment: ${id}`);

    try {
      const payment = await this.paymentService.processRefund(id, body.refundAmount, body.refundReason);
      if (!payment) {
        throw new HttpException('Payment not found', HttpStatus.NOT_FOUND);
      }

      return this.cmmService.newResultInstance().withResult({
        paymentId: payment.id,
        refundedAmount: payment.refundedAmount,
        refundReason: payment.refundReason,
        refundedAt: payment.refundedAt,
      });
    } catch (error) {
      this._Logger.error(`Failed to process refund: ${error.message}`, error.stack);
      if (error.message.includes('not found')) {
        throw new HttpException('Payment not found', HttpStatus.NOT_FOUND);
      }
      if (error.message.includes('must be successful')) {
        throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
      }
      throw new HttpException('Failed to process refund', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 獲取支付統計資料
   * GET /api/v1/payments/statistics
   */
  @Get('statistics')
  public async getPaymentStatistics(@Query() query: { startDate?: string; endDate?: string }): Promise<CustomResult> {
    this._Logger.log(`Getting payment statistics from ${query.startDate} to ${query.endDate}`);

    try {
      const startDate = query.startDate ? new Date(query.startDate) : undefined;
      const endDate = query.endDate ? new Date(query.endDate) : undefined;

      const stats = await this.paymentService.getPaymentStatistics(startDate, endDate);

      return this.cmmService.newResultInstance().withResult({
        totalAmount: stats.totalAmount,
        successCount: stats.successCount,
        failureCount: stats.failureCount,
        refundedAmount: stats.refundedAmount,
        period: {
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString(),
        },
      });
    } catch (error) {
      this._Logger.error(`Failed to get payment statistics: ${error.message}`, error.stack);
      throw new HttpException('Failed to get payment statistics', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 查詢訂閱的支付歷史
   * GET /api/v1/payments/subscription/:subscriptionId?page=1&limit=10&status=COMPLETED
   */
  @Get('subscription/:subscriptionId')
  public async getSubscriptionPayments(
    @Param('subscriptionId') subscriptionId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('status') status?: string,
  ): Promise<CustomResult> {
    this._Logger.log(`Getting payment history for subscription: ${subscriptionId}`);

    try {
      const pageNumber = parseInt(page, 10);
      const limitNumber = parseInt(limit, 10);

      // 參數驗證
      if (pageNumber < 1) {
        throw new HttpException('Page number must be greater than 0', HttpStatus.BAD_REQUEST);
      }
      if (limitNumber < 1 || limitNumber > 50) {
        throw new HttpException('Limit must be between 1 and 50', HttpStatus.BAD_REQUEST);
      }

      // TODO: 實作訂閱支付歷史查詢邏輯，目前返回模擬數據
      const mockPayments = [
        {
          paymentId: 'pay_1234567890',
          subscriptionId: subscriptionId,
          amount: {
            original: 999,
            discount: 100,
            final: 899,
            currency: 'TWD',
          },
          status: 'COMPLETED',
          billingCycle: {
            cycleNumber: 1,
            periodStart: '2024-01-01T00:00:00Z',
            periodEnd: '2024-02-01T00:00:00Z',
          },
          paymentMethod: {
            type: 'CREDIT_CARD',
            displayName: '**** 1234',
            provider: 'stripe',
          },
          processedAt: '2024-01-01T00:00:00Z',
          createdAt: '2024-01-01T00:00:00Z',
        },
        {
          paymentId: 'pay_1234567891',
          subscriptionId: subscriptionId,
          amount: {
            original: 999,
            discount: 0,
            final: 999,
            currency: 'TWD',
          },
          status: 'FAILED',
          billingCycle: {
            cycleNumber: 2,
            periodStart: '2024-02-01T00:00:00Z',
            periodEnd: '2024-03-01T00:00:00Z',
          },
          paymentMethod: {
            type: 'CREDIT_CARD',
            displayName: '**** 1234',
            provider: 'stripe',
          },
          failureReason: 'Insufficient funds',
          processedAt: '2024-02-01T00:00:00Z',
          createdAt: '2024-02-01T00:00:00Z',
        },
      ];

      // 狀態篩選
      let filteredPayments = mockPayments;
      if (status) {
        filteredPayments = mockPayments.filter((payment) => payment.status === status.toUpperCase());
      }

      // 分頁處理
      const totalItems = filteredPayments.length;
      const totalPages = Math.ceil(totalItems / limitNumber);
      const startIndex = (pageNumber - 1) * limitNumber;
      const endIndex = startIndex + limitNumber;
      const paginatedPayments = filteredPayments.slice(startIndex, endIndex);

      return this.cmmService.newResultInstance().withResult({
        subscriptionId,
        payments: paginatedPayments,
        pagination: {
          currentPage: pageNumber,
          totalPages,
          totalItems,
          itemsPerPage: limitNumber,
        },
      });
    } catch (error) {
      this._Logger.error(`Failed to get subscription payments: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to get subscription payments', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 重試失敗的支付
   * POST /api/v1/payments/:paymentId/retry
   */
  @Post(':paymentId/retry')
  public async retryPayment(@Param('paymentId') paymentId: string, @Body() body: { paymentMethodId?: string }): Promise<CustomResult> {
    this._Logger.log(`Retrying payment: ${paymentId}, new payment method: ${body.paymentMethodId || 'original'}`);

    try {
      // 檢查支付是否存在
      const payment = await this.paymentService.getPaymentById(paymentId);
      if (!payment) {
        throw new HttpException('Payment not found', HttpStatus.NOT_FOUND);
      }

      // 檢查支付狀態是否可以重試
      if (payment.status !== 'FAILED') {
        throw new HttpException('Only failed payments can be retried', HttpStatus.BAD_REQUEST);
      }

      // TODO: 實作支付重試邏輯，目前返回模擬結果
      const retryResult = {
        paymentId: paymentId,
        status: 'PROCESSING',
        retryAttempt: (payment.attemptCount || 0) + 1,
        paymentMethodId: body.paymentMethodId || payment.paymentMethodId,
        updatedAt: new Date().toISOString(),
        message: 'Payment retry initiated successfully',
      };

      return this.cmmService.newResultInstance().withResult(retryResult);
    } catch (error) {
      this._Logger.error(`Failed to retry payment: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to retry payment', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
