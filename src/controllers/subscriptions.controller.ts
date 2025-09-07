import { Controller, Post, Get, Put, Body, Param, Query, HttpStatus, HttpException } from '@nestjs/common';
import { CommonService, ErrException, errConstants } from '@myapp/common';
import { LoggerService } from '@nestjs/common';
import { CustomResult } from '@xxxhand/app-common';
import { SubscriptionService } from '../domain/services/subscription.service';
import { CustomerService } from '../domain/services/customer.service';
import {
  CreateSubscriptionRequest,
  CancelSubscriptionRequest,
  PlanChangeRequest,
  PauseSubscriptionRequest,
  RefundSubscriptionRequest,
} from '../domain/value-objects/subscription.request';

@Controller({
  path: 'subscriptions',
  version: '1',
})
export class SubscriptionsController {
  private readonly _Logger: LoggerService;

  constructor(
    private readonly cmmService: CommonService,
    private readonly subscriptionService: SubscriptionService,
    private readonly customerService: CustomerService,
  ) {
    this._Logger = this.cmmService.getDefaultLogger(SubscriptionsController.name);
  }

  /**
   * 創建訂閱
   * POST /api/v1/subscriptions
   */
  @Post()
  public async createSubscription(@Body() body: CreateSubscriptionRequest): Promise<CustomResult> {
    this._Logger.log(`Creating subscription for customer: ${body.customerId}`);

    try {
      // 驗證客戶是否存在
      const customer = await this.customerService.getCustomerById(body.customerId);
      if (!customer) {
        throw ErrException.newFromCodeName(errConstants.ERR_CLIENT_NOT_FOUND);
      }

      const subscription = await this.subscriptionService.createSubscription(
        body.customerId,
        body.paymentMethodId,
        body.planName,
        body.amount,
        body.billingCycle,
        body.trialEndDate ? Math.ceil((new Date(body.trialEndDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : undefined,
      );

      return this.cmmService.newResultInstance().withResult({
        subscriptionId: subscription.id,
        customerId: subscription.customerId,
        planName: subscription.planName,
        amount: subscription.amount,
        currency: subscription.currency,
        status: subscription.status,
        billingCycle: subscription.billingCycle,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        nextBillingDate: subscription.nextBillingDate,
        createdAt: subscription.createdAt,
      });
    } catch (error) {
      this._Logger.error(`Failed to create subscription: ${error.message}`, error.stack);
      if (error instanceof ErrException) {
        throw error;
      }
      throw new HttpException('Failed to create subscription', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 查詢訂閱列表 (帶分頁和篩選)
   * GET /api/v1/subscriptions?status=ACTIVE&page=1&limit=20&sort=-createdAt
   */
  @Get()
  public async getSubscriptions(
    @Query('status') status?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('sort') sort: string = '-createdAt',
  ): Promise<CustomResult> {
    this._Logger.log(`Getting subscriptions list - status: ${status}, page: ${page}, limit: ${limit}, sort: ${sort}`);

    try {
      const pageNumber = parseInt(page, 10);
      const limitNumber = parseInt(limit, 10);

      // 參數驗證
      if (pageNumber < 1) {
        throw new HttpException('Page number must be greater than 0', HttpStatus.BAD_REQUEST);
      }
      if (limitNumber < 1 || limitNumber > 100) {
        throw new HttpException('Limit must be between 1 and 100', HttpStatus.BAD_REQUEST);
      }

      // TODO: 實作訂閱列表查詢邏輯，目前返回模擬數據
      const mockSubscriptions = [
        {
          subscriptionId: 'sub_1234567890',
          status: 'ACTIVE',
          product: {
            productId: '64f5c8e5a1b2c3d4e5f67890',
            productName: 'Premium Plan',
            displayName: '高級方案',
          },
          plan: {
            planId: '64f5c8e5a1b2c3d4e5f67891',
            planName: 'Monthly Premium',
            pricing: {
              amount: 999,
              currency: 'TWD',
            },
          },
          currentPeriod: {
            nextBillingDate: '2024-02-01T00:00:00Z',
          },
          createdAt: '2024-01-01T00:00:00Z',
        },
        {
          subscriptionId: 'sub_1234567891',
          status: 'CANCELLED',
          product: {
            productId: '64f5c8e5a1b2c3d4e5f67890',
            productName: 'Premium Plan',
            displayName: '高級方案',
          },
          plan: {
            planId: '64f5c8e5a1b2c3d4e5f67891',
            planName: 'Monthly Premium',
            pricing: {
              amount: 999,
              currency: 'TWD',
            },
          },
          currentPeriod: {
            nextBillingDate: null,
          },
          createdAt: '2023-12-01T00:00:00Z',
        },
      ];

      // 狀態篩選
      let filteredSubscriptions = mockSubscriptions;
      if (status) {
        filteredSubscriptions = mockSubscriptions.filter((sub) => sub.status === status.toUpperCase());
      }

      // 排序處理
      const [sortField, sortOrder] = sort.startsWith('-') ? [sort.substring(1), 'desc'] : [sort, 'asc'];
      filteredSubscriptions.sort((a, b) => {
        let aValue: any, bValue: any;
        if (sortField === 'createdAt') {
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
        } else {
          aValue = a[sortField as keyof typeof a] || '';
          bValue = b[sortField as keyof typeof b] || '';
        }

        if (sortOrder === 'desc') {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      });

      // 分頁處理
      const totalItems = filteredSubscriptions.length;
      const totalPages = Math.ceil(totalItems / limitNumber);
      const startIndex = (pageNumber - 1) * limitNumber;
      const endIndex = startIndex + limitNumber;
      const paginatedSubscriptions = filteredSubscriptions.slice(startIndex, endIndex);

      return this.cmmService.newResultInstance().withResult({
        subscriptions: paginatedSubscriptions,
        pagination: {
          currentPage: pageNumber,
          totalPages,
          totalItems,
          itemsPerPage: limitNumber,
          hasNextPage: pageNumber < totalPages,
          hasPreviousPage: pageNumber > 1,
        },
      });
    } catch (error) {
      this._Logger.error(`Failed to get subscriptions: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to get subscriptions', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 獲取訂閱詳情
   * GET /api/v1/subscriptions/:id
   */
  @Get(':id')
  public async getSubscription(@Param('id') id: string): Promise<CustomResult> {
    this._Logger.log(`Getting subscription: ${id}`);

    try {
      const subscription = await this.subscriptionService.getSubscriptionById(id);
      if (!subscription) {
        throw new HttpException('Subscription not found', HttpStatus.NOT_FOUND);
      }

      return this.cmmService.newResultInstance().withResult({
        subscriptionId: subscription.id,
        customerId: subscription.customerId,
        paymentMethodId: subscription.paymentMethodId,
        planName: subscription.planName,
        status: subscription.status,
        billingCycle: subscription.billingCycle,
        amount: subscription.amount,
        currency: subscription.currency,
        trialEndDate: subscription.trialEndDate,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        nextBillingDate: subscription.nextBillingDate,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        canceledDate: subscription.canceledDate,
        cancelReason: subscription.cancelReason,
        description: subscription.description,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt,
      });
    } catch (error) {
      this._Logger.error(`Failed to get subscription: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to get subscription', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 更新訂閱信息 (暫不支持)
   * PUT /api/v1/subscriptions/:id
   */
  @Put(':id')
  public async updateSubscription(@Param('id') id: string): Promise<CustomResult> {
    this._Logger.log(`Updating subscription: ${id}`);

    // 當前版本暫不支持訂閱更新
    throw new HttpException('Subscription update not supported in current version', HttpStatus.NOT_IMPLEMENTED);
  }

  /**
   * 啟用訂閱
   * POST /api/v1/subscriptions/:id/activate
   */
  @Post(':id/activate')
  public async activateSubscription(@Param('id') id: string): Promise<CustomResult> {
    this._Logger.log(`Activating subscription: ${id}`);

    try {
      const subscription = await this.subscriptionService.activateSubscription(id);
      if (!subscription) {
        throw new HttpException('Subscription not found', HttpStatus.NOT_FOUND);
      }

      return this.cmmService.newResultInstance().withResult({
        subscriptionId: subscription.id,
        status: subscription.status,
        updatedAt: subscription.updatedAt,
      });
    } catch (error) {
      this._Logger.error(`Failed to activate subscription: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to activate subscription', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 取消訂閱
   * POST /api/v1/subscriptions/:id/cancel
   */
  @Post(':id/cancel')
  public async cancelSubscription(@Param('id') id: string, @Body() body: CancelSubscriptionRequest): Promise<CustomResult> {
    this._Logger.log(`Canceling subscription: ${id}, reason: ${body.reason || 'N/A'}`);

    try {
      const subscription = await this.subscriptionService.cancelSubscription(id, body.reason);
      if (!subscription) {
        throw new HttpException('Subscription not found', HttpStatus.NOT_FOUND);
      }

      return this.cmmService.newResultInstance().withResult({
        subscriptionId: subscription.id,
        status: subscription.status,
        canceledDate: subscription.canceledDate,
        cancelReason: subscription.cancelReason,
        endDate: subscription.endDate,
        updatedAt: subscription.updatedAt,
      });
    } catch (error) {
      this._Logger.error(`Failed to cancel subscription: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to cancel subscription', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 獲取客戶的訂閱列表
   * GET /api/v1/subscriptions/customer/:customerId
   */
  @Get('customer/:customerId')
  public async getCustomerSubscriptions(@Param('customerId') customerId: string): Promise<CustomResult> {
    this._Logger.log(`Getting subscriptions for customer: ${customerId}`);

    try {
      // 驗證客戶是否存在
      const customer = await this.customerService.getCustomerById(customerId);
      if (!customer) {
        throw ErrException.newFromCodeName(errConstants.ERR_CLIENT_NOT_FOUND);
      }

      const subscriptions = await this.subscriptionService.getSubscriptionsByCustomerId(customerId);

      return this.cmmService.newResultInstance().withResult({
        customerId,
        subscriptions: subscriptions.map((subscription) => ({
          subscriptionId: subscription.id,
          planName: subscription.planName,
          status: subscription.status,
          amount: subscription.amount,
          currency: subscription.currency,
          billingCycle: subscription.billingCycle,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          nextBillingDate: subscription.nextBillingDate,
          createdAt: subscription.createdAt,
        })),
      });
    } catch (error) {
      this._Logger.error(`Failed to get customer subscriptions: ${error.message}`, error.stack);
      if (error instanceof ErrException) {
        throw error;
      }
      throw new HttpException('Failed to get customer subscriptions', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 方案變更
   * POST /api/v1/subscriptions/:id/plan-change
   */
  @Post(':id/plan-change')
  public async changePlan(@Param('id') id: string, @Body() body: PlanChangeRequest): Promise<CustomResult> {
    this._Logger.log(`Changing plan for subscription: ${id} to plan: ${body.targetPlanId}`);

    try {
      // 檢查訂閱是否存在
      const subscription = await this.subscriptionService.getSubscriptionById(id);
      if (!subscription) {
        throw new HttpException('Subscription not found', HttpStatus.NOT_FOUND);
      }

      // 檢查訂閱狀態是否允許方案變更
      if (subscription.status !== 'ACTIVE') {
        throw new HttpException('Only active subscriptions can change plans', HttpStatus.BAD_REQUEST);
      }

      // TODO: 實作方案變更邏輯，目前返回模擬數據
      const planChangeResult = {
        planChangeId: 'pc_' + Date.now(),
        subscriptionId: id,
        fromPlan: {
          planId: subscription.planName, // 簡化處理
          planName: subscription.planName,
        },
        toPlan: {
          planId: body.targetPlanId,
          planName: 'Target Plan Name', // 應該從產品服務獲取
        },
        changeType: body.changeType,
        status: 'COMPLETED',
        proration: {
          creditAmount: 300,
          chargeAmount: 500,
          netAmount: 200,
        },
        effectiveAt: body.changeType === 'IMMEDIATE' ? new Date().toISOString() : subscription.currentPeriodEnd,
        createdAt: new Date().toISOString(),
      };

      return this.cmmService.newResultInstance().withResult(planChangeResult);
    } catch (error) {
      this._Logger.error(`Failed to change plan: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to change plan', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 查詢方案變更選項
   * GET /api/v1/subscriptions/:id/plan-change-options
   */
  @Get(':id/plan-change-options')
  public async getPlanChangeOptions(@Param('id') id: string): Promise<CustomResult> {
    this._Logger.log(`Getting plan change options for subscription: ${id}`);

    try {
      // 檢查訂閱是否存在
      const subscription = await this.subscriptionService.getSubscriptionById(id);
      if (!subscription) {
        throw new HttpException('Subscription not found', HttpStatus.NOT_FOUND);
      }

      // TODO: 實作方案變更選項查詢邏輯，目前返回模擬數據
      const planChangeOptions = {
        currentPlan: {
          planId: subscription.planName,
          planName: subscription.planName,
        },
        availableChanges: [
          {
            targetPlan: {
              planId: '64f5c8e5a1b2c3d4e5f67894',
              planName: 'Monthly Professional',
              pricing: {
                amount: 1499,
                currency: 'TWD',
              },
            },
            changeType: ['IMMEDIATE', 'NEXT_CYCLE'],
            proration: {
              creditAmount: 300,
              chargeAmount: 500,
              netAmount: 200,
            },
          },
          {
            targetPlan: {
              planId: '64f5c8e5a1b2c3d4e5f67896',
              planName: 'Monthly Basic',
              pricing: {
                amount: 499,
                currency: 'TWD',
              },
            },
            changeType: ['NEXT_CYCLE'],
            proration: {
              creditAmount: 500,
              chargeAmount: 0,
              netAmount: -500,
            },
          },
        ],
      };

      return this.cmmService.newResultInstance().withResult(planChangeOptions);
    } catch (error) {
      this._Logger.error(`Failed to get plan change options: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to get plan change options', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 暫停訂閱
   * POST /api/v1/subscriptions/:id/pause
   */
  @Post(':id/pause')
  public async pauseSubscription(@Param('id') id: string, @Body() body: PauseSubscriptionRequest): Promise<CustomResult> {
    this._Logger.log(`Pausing subscription: ${id}, resume date: ${body.resumeDate || 'undefined'}`);

    try {
      // 檢查訂閱是否存在
      const subscription = await this.subscriptionService.getSubscriptionById(id);
      if (!subscription) {
        throw new HttpException('Subscription not found', HttpStatus.NOT_FOUND);
      }

      // 檢查訂閱狀態是否允許暫停
      if (subscription.status !== 'ACTIVE') {
        throw new HttpException('Only active subscriptions can be paused', HttpStatus.BAD_REQUEST);
      }

      // TODO: 實作訂閱暫停邏輯，目前返回模擬數據
      const pauseResult = {
        subscriptionId: id,
        status: 'PAUSED',
        pausedAt: new Date().toISOString(),
        resumeDate: body.resumeDate || null,
        reason: body.reason || 'User requested pause',
        updatedAt: new Date().toISOString(),
      };

      return this.cmmService.newResultInstance().withResult(pauseResult);
    } catch (error) {
      this._Logger.error(`Failed to pause subscription: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to pause subscription', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 恢復訂閱
   * POST /api/v1/subscriptions/:id/resume
   */
  @Post(':id/resume')
  public async resumeSubscription(@Param('id') id: string): Promise<CustomResult> {
    this._Logger.log(`Resuming subscription: ${id}`);

    try {
      // 檢查訂閱是否存在
      const subscription = await this.subscriptionService.getSubscriptionById(id);
      if (!subscription) {
        throw new HttpException('Subscription not found', HttpStatus.NOT_FOUND);
      }

      // 檢查訂閱狀態是否允許恢復
      if (subscription.status !== 'PAUSED') {
        throw new HttpException('Only paused subscriptions can be resumed', HttpStatus.BAD_REQUEST);
      }

      // TODO: 實作訂閱恢復邏輯，目前返回模擬數據
      const resumeResult = {
        subscriptionId: id,
        status: 'ACTIVE',
        resumedAt: new Date().toISOString(),
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30天後
        updatedAt: new Date().toISOString(),
      };

      return this.cmmService.newResultInstance().withResult(resumeResult);
    } catch (error) {
      this._Logger.error(`Failed to resume subscription: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to resume subscription', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 申請退款
   * POST /api/v1/subscriptions/:id/refund
   */
  @Post(':id/refund')
  public async refundSubscription(@Param('id') id: string, @Body() body: RefundSubscriptionRequest): Promise<CustomResult> {
    this._Logger.log(`Requesting refund for subscription: ${id}, payment: ${body.paymentId}`);

    try {
      // 檢查訂閱是否存在
      const subscription = await this.subscriptionService.getSubscriptionById(id);
      if (!subscription) {
        throw new HttpException('Subscription not found', HttpStatus.NOT_FOUND);
      }

      // TODO: 檢查支付記錄是否存在和有效性
      // const payment = await this.paymentService.getPaymentById(body.paymentId);

      // TODO: 實作退款邏輯，目前返回模擬數據
      const refundResult = {
        refundId: 'ref_' + Date.now(),
        subscriptionId: id,
        paymentId: body.paymentId,
        refundAmount: {
          amount: body.refundAmount || 899,
          currency: 'TWD',
        },
        refundType: body.refundType,
        status: 'REQUESTED',
        reason: body.reason || 'Customer requested refund',
        estimatedProcessingTime: '3-5 business days',
        createdAt: new Date().toISOString(),
      };

      return this.cmmService.newResultInstance().withResult(refundResult);
    } catch (error) {
      this._Logger.error(`Failed to process refund: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to process refund', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
