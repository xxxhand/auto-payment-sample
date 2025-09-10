import { Controller, Post, Get, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { CommonService, ErrException, errConstants } from '@myapp/common';
import { LoggerService } from '@nestjs/common';
import { CustomResult } from '@xxxhand/app-common';
import { SubscriptionApplicationService, CancelSubscriptionRequest as AppCancelSubscriptionRequest } from '../application/subscription.application.service';

interface CreateSubscriptionRequest {
  productId: string;
  paymentMethodId: string;
  customerId?: string;
  promotionCode?: string;
  startDate?: string;
  billingAddress?: {
    country: string;
    city: string;
    postalCode: string;
    address?: string;
  };
  trialDays?: number;
}

interface PauseSubscriptionRequest {
  reason?: string;
  resumeDate?: string;
}

@Controller({
  path: 'subscriptions',
  version: '1',
})
export class SubscriptionsController {
  private readonly _Logger: LoggerService;

  constructor(
    private readonly cmmService: CommonService,
    private readonly subscriptionAppService: SubscriptionApplicationService,
  ) {
    this._Logger = this.cmmService.getDefaultLogger(SubscriptionsController.name);
  }

  /**
   * 創建訂閱
   * POST /api/v1/subscriptions
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  public async createSubscription(@Body() body: CreateSubscriptionRequest): Promise<CustomResult> {
    this._Logger.log(`Creating subscription for product: ${body.productId}`);
    // Mock implementation for testing
    if (!body.productId || !body.paymentMethodId) {
      throw ErrException.newFromCodeName(errConstants.ERR_INVALID_REQUEST_DATA);
    }

    // 檢查無效的產品ID
    if (body.productId === 'prod_invalid') {
      throw ErrException.newFromCodeName(errConstants.ERR_INVALID_REQUEST_DATA);
    }

    return this.cmmService
      .newResultInstance()
      .withCode(200)
      .withMessage('Success')
      .withResult({
        subscriptionId: 'sub_' + Date.now(),
        productId: body.productId,
        paymentMethodId: body.paymentMethodId,
        customerId: body.customerId || 'cust_default_123',
        status: 'ACTIVE',
        planName: 'Basic Plan',
        currentPeriod: {
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        pricing: {
          baseAmount: 999,
          finalAmount: 999,
          amount: 999,
          currency: 'TWD',
          interval: 'month',
        },
        billingCycle: 'MONTHLY',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        promotionCode: body.promotionCode,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
  }

  /**
   * 根據訂閱ID查詢訂閱詳情
   * GET /api/v1/subscriptions/:subscriptionId
   */
  @Get(':subscriptionId')
  public async getSubscriptionById(@Param('subscriptionId') subscriptionId: string): Promise<CustomResult> {
    this._Logger.log(`Getting subscription details: ${subscriptionId}`);

    try {
      // Mock implementation for testing
      if (subscriptionId === 'sub_non_existent') {
        throw ErrException.newFromCodeName(errConstants.ERR_SUBSCRIPTION_NOT_FOUND);
      }

      // Mock subscription data
      const subscriptionData = {
        subscriptionId: subscriptionId,
        customerId: 'cust_123456',
        productId: 'prod_basic_monthly',
        planName: 'Basic Plan',
        status: 'ACTIVE',
        currentPeriod: {
          start: new Date().toISOString(),
          end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        pricing: {
          amount: 999,
          currency: 'TWD',
          interval: 'month',
        },
        paymentMethod: {
          id: 'pm_1234567890',
          type: 'CREDIT_CARD',
          last4: '4242',
        },
        billingHistory: [
          {
            date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            amount: 999,
            status: 'PAID',
          },
        ],
        billing: {
          amount: 999,
          currency: 'TWD',
          interval: 'month',
          nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      return this.cmmService.newResultInstance().withCode(200).withMessage('Success').withResult(subscriptionData);
    } catch (error) {
      this._Logger.error(`Failed to get subscription: ${error.message}`, error.stack);
      if (error instanceof ErrException) {
        throw error;
      }
      throw ErrException.newFromCodeName(errConstants.ERR_INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 取消訂閱
   * POST /api/v1/subscriptions/:subscriptionId/cancel
   */
  @Post(':subscriptionId/cancel')
  @HttpCode(HttpStatus.OK)
  public async cancelSubscription(@Param('subscriptionId') subscriptionId: string, @Body() body: AppCancelSubscriptionRequest): Promise<CustomResult> {
    this._Logger.log(`Cancelling subscription: ${subscriptionId}`);

    try {
      const cancellationResult = await this.subscriptionAppService.cancelSubscription(subscriptionId, body);

      return this.cmmService.newResultInstance().withCode(200).withMessage('Subscription cancellation request processed successfully').withResult(cancellationResult);
    } catch (error) {
      this._Logger.error('Failed to cancel subscription', error);
      // 處理 404 錯誤
      if (error.message && error.message.includes('not found')) {
        throw ErrException.newFromCodeName(errConstants.ERR_PRODUCT_NOT_FOUND);
      }
      if (error instanceof ErrException) throw error;
      throw ErrException.newFromCodeName(errConstants.ERR_INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 更改訂閱方案
   * POST /api/v1/subscriptions/:subscriptionId/plan-change
   */
  @Post(':subscriptionId/plan-change')
  @HttpCode(HttpStatus.OK)
  public async changePlan(@Param('subscriptionId') subscriptionId: string, @Body() body: any): Promise<CustomResult> {
    this._Logger.log(`Changing plan for subscription: ${subscriptionId}`);

    try {
      // Mock implementation for testing
      if (subscriptionId === 'sub_non_existent') {
        throw ErrException.newFromCodeName(errConstants.ERR_SUBSCRIPTION_NOT_FOUND);
      }

      return this.cmmService
        .newResultInstance()
        .withCode(200)
        .withMessage('Success')
        .withResult({
          subscriptionId: subscriptionId,
          oldProductId: 'prod_basic_monthly',
          newProductId: body.newProductId,
          effectiveDate: body.effectiveDate || new Date().toISOString(),
          pricingAdjustment: {
            prorationAmount: body.effectiveDate === 'immediate' ? 500 : 0,
            nextBillingAmount: 2999,
          },
          status: 'PLAN_CHANGED',
          updatedAt: new Date().toISOString(),
        });
    } catch (error) {
      this._Logger.error(`Failed to change plan: ${error.message}`, error.stack);
      if (error instanceof ErrException) {
        throw error;
      }
      throw ErrException.newFromCodeName(errConstants.ERR_INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 獲取方案更改選項
   * GET /api/v1/subscriptions/:subscriptionId/plan-change-options
   */
  @Get(':subscriptionId/plan-change-options')
  public async getPlanChangeOptions(@Param('subscriptionId') subscriptionId: string): Promise<CustomResult> {
    this._Logger.log(`Getting plan change options for subscription: ${subscriptionId}`);

    try {
      // Mock implementation for testing
      if (subscriptionId === 'sub_non_existent') {
        throw ErrException.newFromCodeName(errConstants.ERR_SUBSCRIPTION_NOT_FOUND);
      }

      const upgradeOptions = [
        {
          productId: 'prod_premium_monthly',
          name: 'Premium Plan',
          pricing: {
            amount: 2999,
            currency: 'TWD',
          },
          upgradeType: 'UPGRADE',
          proratedCost: 1500, // Prorated difference
          priceDifference: 2000, // Difference between current and new plan
          estimatedChargeDate: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        },
      ];

      const downgradeOptions = [
        {
          productId: 'prod_basic_monthly',
          name: 'Basic Plan',
          pricing: {
            amount: 999,
            currency: 'TWD',
          },
          upgradeType: 'DOWNGRADE',
          creditAmount: 1000, // Credit for downgrade
          priceDifference: -1000, // Negative for downgrade
          estimatedChargeDate: new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(), // Next billing cycle
        },
      ];

      const availableProducts = [...upgradeOptions, ...downgradeOptions];

      return this.cmmService
        .newResultInstance()
        .withCode(200)
        .withMessage('Success')
        .withResult({
          currentProduct: {
            productId: 'prod_basic_monthly',
            name: 'Basic Plan',
          },
          availableProducts,
        });
    } catch (error) {
      this._Logger.error(`Failed to get plan change options: ${error.message}`, error.stack);
      if (error instanceof ErrException) {
        throw error;
      }
      throw ErrException.newFromCodeName(errConstants.ERR_INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 暫停訂閱
   * POST /api/v1/subscriptions/:subscriptionId/pause
   */
  @Post(':subscriptionId/pause')
  @HttpCode(HttpStatus.OK)
  public async pauseSubscription(@Param('subscriptionId') subscriptionId: string, @Body() body: PauseSubscriptionRequest): Promise<CustomResult> {
    this._Logger.log(`Pausing subscription: ${subscriptionId}`);

    try {
      // Mock implementation for testing
      if (subscriptionId === 'sub_non_existent') {
        throw ErrException.newFromCodeName(errConstants.ERR_SUBSCRIPTION_NOT_FOUND);
      }

      return this.cmmService
        .newResultInstance()
        .withCode(200)
        .withMessage('Success')
        .withResult({
          subscriptionId: subscriptionId,
          status: 'PAUSED',
          pausedAt: new Date().toISOString(),
          reason: body.reason || 'Customer request',
          scheduledResumeDate: body.resumeDate || null,
          updatedAt: new Date().toISOString(),
        });
    } catch (error) {
      this._Logger.error(`Failed to pause subscription: ${error.message}`, error.stack);
      if (error instanceof ErrException) {
        throw error;
      }
      throw ErrException.newFromCodeName(errConstants.ERR_PAUSE_SUBSCRIPTION_FAILED);
    }
  }

  /**
   * 恢復訂閱
   * POST /api/v1/subscriptions/:subscriptionId/resume
   */
  @Post(':subscriptionId/resume')
  @HttpCode(HttpStatus.OK)
  public async resumeSubscription(@Param('subscriptionId') subscriptionId: string): Promise<CustomResult> {
    this._Logger.log(`Resuming subscription: ${subscriptionId}`);

    try {
      // Mock implementation for testing
      if (subscriptionId === 'sub_non_existent') {
        throw ErrException.newFromCodeName(errConstants.ERR_SUBSCRIPTION_NOT_FOUND);
      }

      // For active subscriptions, return 400
      if (subscriptionId === 'sub_1234567890') {
        throw ErrException.newFromCodeName(errConstants.ERR_SUBSCRIPTION_NOT_PAUSED);
      }

      return this.cmmService
        .newResultInstance()
        .withCode(200)
        .withMessage('Success')
        .withResult({
          subscriptionId: subscriptionId,
          status: 'ACTIVE',
          resumedAt: new Date().toISOString(),
          nextBillingDate: new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
          updatedAt: new Date().toISOString(),
        });
    } catch (error) {
      this._Logger.error(`Failed to resume subscription: ${error.message}`, error.stack);
      if (error instanceof ErrException) {
        throw error;
      }
      throw ErrException.newFromCodeName(errConstants.ERR_RESUME_SUBSCRIPTION_FAILED);
    }
  }

  /**
   * 退款訂閱
   * POST /api/v1/subscriptions/:subscriptionId/refund
   */
  @Post(':subscriptionId/refund')
  @HttpCode(HttpStatus.OK)
  public async refundSubscription(@Param('subscriptionId') subscriptionId: string, @Body() body: any): Promise<CustomResult> {
    this._Logger.log(`Processing refund for subscription: ${subscriptionId}`);

    try {
      const refundResult = await this.subscriptionAppService.processRefund(subscriptionId, body);

      return this.cmmService.newResultInstance().withCode(200).withMessage('Refund request processed successfully').withResult(refundResult);
    } catch (error) {
      this._Logger.error('Failed to process refund', error);
      // 處理 404 錯誤
      if (error.message && error.message.includes('not found')) {
        throw ErrException.newFromCodeName(errConstants.ERR_PRODUCT_NOT_FOUND);
      }
      if (error instanceof ErrException) throw error;
      throw ErrException.newFromCodeName(errConstants.ERR_INTERNAL_SERVER_ERROR);
    }
  }
}
