import { Controller, Get, Post, Param, Body, Query, HttpException, HttpStatus } from '@nestjs/common';
import { CommonService } from '@myapp/common';
import { LoggerService } from '@nestjs/common';
import { CustomResult } from '@xxxhand/app-common';
import { BillingService } from '../domain/services/billing.service';
import { ProcessBillingRequest, BillingQueryRequest } from '../domain/value-objects/billing.request';

@Controller({
  path: 'billing',
  version: '1',
})
export class BillingController {
  private readonly _Logger: LoggerService;

  constructor(
    private readonly cmmService: CommonService,
    private readonly billingService: BillingService,
  ) {
    this._Logger = this.cmmService.getDefaultLogger(BillingController.name);
  }

  /**
   * 處理單個訂閱的計費
   * POST /api/v1/billing/process
   */
  @Post('process')
  public async processSubscriptionBilling(@Body() body: ProcessBillingRequest): Promise<CustomResult> {
    this._Logger.log(`Processing billing for subscription: ${body.subscriptionId}`);

    try {
      const result = await this.billingService.processSubscriptionBilling(body.subscriptionId);

      if (result.success) {
        return this.cmmService.newResultInstance().withResult({
          success: true,
          paymentId: result.payment?.id,
          subscriptionId: body.subscriptionId,
          amount: result.payment?.amount,
          currency: result.payment?.currency,
          status: result.payment?.status,
          createdAt: result.payment?.createdAt,
        });
      } else {
        throw new HttpException(result.error || 'Billing processing failed', HttpStatus.BAD_REQUEST);
      }
    } catch (error) {
      this._Logger.error(`Failed to process billing: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to process billing', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 批量處理到期計費
   * POST /api/v1/billing/process-due
   */
  @Post('process-due')
  public async processDueBilling(@Body() body: BillingQueryRequest): Promise<CustomResult> {
    this._Logger.log(`Processing due billing with limit: ${body.limit}`);

    try {
      const result = await this.billingService.processDueBilling();

      return this.cmmService.newResultInstance().withResult({
        processed: result.processed,
        succeeded: result.succeeded,
        failed: result.failed,
        errors: result.errors,
        completedAt: new Date(),
      });
    } catch (error) {
      this._Logger.error(`Failed to process due billing: ${error.message}`, error.stack);
      throw new HttpException('Failed to process due billing', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 檢查訂閱的計費狀態
   * GET /api/v1/billing/status/:subscriptionId
   */
  @Get('status/:subscriptionId')
  public async checkBillingStatus(@Param('subscriptionId') subscriptionId: string): Promise<CustomResult> {
    this._Logger.log(`Checking billing status for subscription: ${subscriptionId}`);

    try {
      const status = await this.billingService.checkSubscriptionBillingStatus(subscriptionId);

      if (!status.subscription) {
        throw new HttpException('Subscription not found', HttpStatus.NOT_FOUND);
      }

      return this.cmmService.newResultInstance().withResult({
        subscriptionId: status.subscription.id,
        customerId: status.subscription.customerId,
        status: status.subscription.status,
        isDue: status.isDue,
        nextBillingDate: status.nextBillingDate,
        currentPeriodStart: status.subscription.currentPeriodStart,
        currentPeriodEnd: status.subscription.currentPeriodEnd,
        recentPayments: status.recentPayments.map((payment) => ({
          paymentId: payment.id,
          amount: payment.amount,
          status: payment.status,
          createdAt: payment.createdAt,
          paidAt: payment.paidAt,
          failedAt: payment.failedAt,
        })),
      });
    } catch (error) {
      this._Logger.error(`Failed to check billing status: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to check billing status', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 獲取需要計費的訂閱列表
   * GET /api/v1/billing/due-subscriptions
   */
  @Get('due-subscriptions')
  public async getDueSubscriptions(@Query() query: BillingQueryRequest): Promise<CustomResult> {
    this._Logger.log(`Getting due subscriptions with limit: ${query.limit}`);

    try {
      const subscriptions = await this.billingService.getSubscriptionsDueForBilling(query.limit);

      return this.cmmService.newResultInstance().withResult({
        subscriptions: subscriptions.map((subscription) => ({
          subscriptionId: subscription.id,
          customerId: subscription.customerId,
          planName: subscription.planName,
          amount: subscription.amount,
          currency: subscription.currency,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
        })),
        total: subscriptions.length,
      });
    } catch (error) {
      this._Logger.error(`Failed to get due subscriptions: ${error.message}`, error.stack);
      throw new HttpException('Failed to get due subscriptions', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 重試失敗的支付
   * POST /api/v1/billing/retry-failed
   */
  @Post('retry-failed')
  public async retryFailedPayments(): Promise<CustomResult> {
    this._Logger.log('Retrying failed payments');

    try {
      const result = await this.billingService.retryFailedPayments();

      return this.cmmService.newResultInstance().withResult({
        processed: result.processed,
        succeeded: result.succeeded,
        failed: result.failed,
        completedAt: new Date(),
      });
    } catch (error) {
      this._Logger.error(`Failed to retry failed payments: ${error.message}`, error.stack);
      throw new HttpException('Failed to retry failed payments', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 處理支付成功的回調
   * POST /api/v1/billing/payment/:paymentId/success
   */
  @Post('payment/:paymentId/success')
  public async handlePaymentSuccess(@Param('paymentId') paymentId: string): Promise<CustomResult> {
    this._Logger.log(`Handling payment success: ${paymentId}`);

    try {
      await this.billingService.handlePaymentSuccess(paymentId);

      return this.cmmService.newResultInstance().withResult({
        paymentId,
        status: 'processed',
        processedAt: new Date(),
      });
    } catch (error) {
      this._Logger.error(`Failed to handle payment success: ${error.message}`, error.stack);
      if (error.message.includes('not found')) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      throw new HttpException('Failed to handle payment success', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 處理支付失敗的回調
   * POST /api/v1/billing/payment/:paymentId/failure
   */
  @Post('payment/:paymentId/failure')
  public async handlePaymentFailure(@Param('paymentId') paymentId: string): Promise<CustomResult> {
    this._Logger.log(`Handling payment failure: ${paymentId}`);

    try {
      await this.billingService.handlePaymentFailure(paymentId);

      return this.cmmService.newResultInstance().withResult({
        paymentId,
        status: 'processed',
        processedAt: new Date(),
      });
    } catch (error) {
      this._Logger.error(`Failed to handle payment failure: ${error.message}`, error.stack);
      if (error.message.includes('not found')) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      throw new HttpException('Failed to handle payment failure', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
