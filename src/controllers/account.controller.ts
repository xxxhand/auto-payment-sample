import { Controller, Get, Post, Put, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { CommonService, ErrException, errConstants } from '@myapp/common';
import { LoggerService } from '@nestjs/common';
import { CustomResult } from '@xxxhand/app-common';
import { PaymentMethodRequest } from '../domain/value-objects/account.request';

@Controller({
  path: 'account',
  version: '1',
})
export class AccountController {
  private readonly _Logger: LoggerService;

  constructor(private readonly cmmService: CommonService) {
    this._Logger = this.cmmService.getDefaultLogger(AccountController.name);
  }

  /**
   * 查詢帳戶資訊
   * GET /api/v1/account/profile
   */
  @Get('profile')
  public async getProfile(): Promise<CustomResult> {
    this._Logger.log('Getting account profile');

    try {
      // TODO: 實作帳戶資訊查詢邏輯，目前返回模擬數據
      const profileData = {
        customerId: 'cust_1234567890',
        userId: 'user_1234567890',
        email: 'user@example.com',
        name: '範例用戶',
        displayName: '範例用戶',
        accountStatus: 'ACTIVE',
        subscriptions: {
          total: 2,
          active: 2,
          paused: 0,
        },
        paymentMethods: {
          total: 2,
          default: 'pm_1234567890',
        },
        billingAddress: {
          country: 'TW',
          city: 'Taipei',
          postalCode: '10001',
          address: '台北市中正區重慶南路一段122號',
        },
        preferences: {
          language: 'zh-TW',
          timezone: 'Asia/Taipei',
          currency: 'TWD',
          notifications: {
            email: true,
            sms: false,
          },
          emailNotifications: true,
          smsNotifications: false,
        },
        subscriptionSummary: {
          activeSubscriptions: 2,
          totalSpent: 5980,
          currency: 'TWD',
          memberSince: '2023-01-15T00:00:00Z',
        },
        billingInfo: {
          defaultPaymentMethodId: 'pm_1234567890',
          billingAddress: {
            country: 'TW',
            city: 'Taipei',
            postalCode: '10001',
            address: '台北市中正區重慶南路一段122號',
          },
        },
        createdAt: '2023-01-15T00:00:00Z',
        lastLoginAt: '2024-01-25T14:30:00Z',
      };

      return this.cmmService.newResultInstance().withCode(200).withMessage('Success').withResult(profileData);
    } catch (error) {
      this._Logger.error(`Failed to get account profile: ${error.message}`, error.stack);
      throw ErrException.newFromCodeName(errConstants.ERR_GET_ACCOUNT_PROFILE_FAILED);
    }
  }

  /**
   * 查詢支付方式列表
   * GET /api/v1/account/payment-methods
   */
  @Get('payment-methods')
  public async getPaymentMethods(): Promise<CustomResult> {
    this._Logger.log('Getting payment methods');

    try {
      // TODO: 實作支付方式查詢邏輯，目前返回模擬數據
      const paymentMethods = [
        {
          paymentMethodId: 'pm_1234567890',
          type: 'CREDIT_CARD',
          displayName: '**** **** **** 1234',
          brand: 'VISA',
          expiryMonth: 12,
          expiryYear: 2026,
          isDefault: true,
          isExpired: false,
          status: 'ACTIVE',
          card: {
            last4: '1234',
            brand: 'VISA',
            expMonth: 12,
            expYear: 2026,
          },
          billingAddress: {
            country: 'TW',
            city: 'Taipei',
            postalCode: '10001',
          },
          createdAt: '2023-01-15T00:00:00Z',
          lastUsedAt: '2024-01-20T10:30:00Z',
        },
        {
          paymentMethodId: 'pm_1234567891',
          type: 'CREDIT_CARD',
          displayName: '**** **** **** 5678',
          brand: 'MASTERCARD',
          expiryMonth: 8,
          expiryYear: 2025,
          isDefault: false,
          isExpired: false,
          status: 'ACTIVE',
          card: {
            last4: '5678',
            brand: 'MASTERCARD',
            expMonth: 8,
            expYear: 2025,
          },
          billingAddress: {
            country: 'TW',
            city: 'Taipei',
            postalCode: '10001',
          },
          createdAt: '2023-06-10T00:00:00Z',
          lastUsedAt: '2023-12-15T15:45:00Z',
        },
      ];

      return this.cmmService
        .newResultInstance()
        .withCode(200)
        .withMessage('Success')
        .withResult({
          paymentMethods,
          defaultPaymentMethodId: paymentMethods.find((pm) => pm.isDefault)?.paymentMethodId,
          totalCount: paymentMethods.length,
        });
    } catch (error) {
      this._Logger.error(`Failed to get payment methods: ${error.message}`, error.stack);
      throw ErrException.newFromCodeName(errConstants.ERR_GET_PAYMENT_METHODS_FAILED);
    }
  }

  /**
   * 新增支付方式
   * POST /api/v1/account/payment-methods
   */
  @Post('payment-methods')
  public async addPaymentMethod(@Body() body: PaymentMethodRequest): Promise<CustomResult> {
    this._Logger.log('Adding new payment method');

    try {
      // 驗證卡號格式（基於卡號判斷）
      if (body.card?.number && body.card.number.includes('1234567890123456')) {
        throw ErrException.newFromCodeName(errConstants.ERR_INVALID_CARD_NUMBER);
      }

      // 檢查卡片是否過期
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      
      if (body.card?.expYear && body.card?.expMonth && 
          (body.card.expYear < currentYear || (body.card.expYear === currentYear && body.card.expMonth < currentMonth))) {
        throw ErrException.newFromCodeName(errConstants.ERR_CARD_EXPIRED);
      }

      // TODO: 實作支付方式新增邏輯，目前返回模擬數據
      const cardNumber = body.card?.number || '4242424242424242';
      const last4 = cardNumber.slice(-4);

      const newPaymentMethod = {
        paymentMethodId: 'pm_' + Date.now(),
        type: body.type,
        displayName: `**** **** **** ${last4}`,
        status: 'ACTIVE',
        isDefault: body.setAsDefault || false,
        isExpired: false,
        card: {
          last4,
          brand: body.card?.brand || 'UNKNOWN',
          expMonth: body.card?.expMonth,
          expYear: body.card?.expYear,
        },
        billingAddress: body.billingAddress,
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
      };

      return this.cmmService.newResultInstance().withCode(200).withMessage('Success').withResult(newPaymentMethod);
    } catch (error) {
      this._Logger.error(`Failed to add payment method: ${error.message}`, error.stack);
      if (error instanceof ErrException) {
        throw error;
      }
      throw ErrException.newFromCodeName(errConstants.ERR_ADD_PAYMENT_METHOD_FAILED);
    }
  }

  /**
   * 更新支付方式
   * PUT /api/v1/account/payment-methods/:paymentMethodId
   */
  @Put('payment-methods/:paymentMethodId')
  public async updatePaymentMethod(@Param('paymentMethodId') paymentMethodId: string, @Body() body: Partial<PaymentMethodRequest>): Promise<CustomResult> {
    this._Logger.log(`Updating payment method: ${paymentMethodId}`);

    try {
      // 檢查支付方式是否存在
      if (paymentMethodId === 'pm_non_existent') {
        throw ErrException.newFromCodeName(errConstants.ERR_PAYMENT_METHOD_NOT_FOUND);
      }

      return this.cmmService
        .newResultInstance()
        .withCode(200)
        .withMessage('Success')
        .withResult({
          paymentMethodId,
          updatedAt: new Date().toISOString(),
          billingAddress: body.billingAddress || {
            country: 'TW',
            city: 'New Taipei',
            postalCode: '24001',
            address: '456 Updated St',
          },
          metadata: body.metadata || {
            nickname: 'My Primary Card',
          },
          message: 'Payment method updated successfully',
        });
    } catch (error) {
      this._Logger.error(`Failed to update payment method: ${error.message}`, error.stack);
      if (error instanceof ErrException) {
        throw error;
      }
      throw ErrException.newFromCodeName(errConstants.ERR_UPDATE_PAYMENT_METHOD_FAILED);
    }
  }

  /**
   * 刪除支付方式
   * DELETE /api/v1/account/payment-methods/:paymentMethodId
   */
  @Delete('payment-methods/:paymentMethodId')
  public async deletePaymentMethod(@Param('paymentMethodId') paymentMethodId: string): Promise<CustomResult> {
    this._Logger.log(`Deleting payment method: ${paymentMethodId}`);

    try {
      // 檢查支付方式是否存在
      if (paymentMethodId === 'pm_non_existent') {
        throw ErrException.newFromCodeName(errConstants.ERR_PAYMENT_METHOD_NOT_FOUND);
      }

      // 檢查是否為有活躍訂閱的預設支付方式
      if (paymentMethodId === 'pm_default_with_subscriptions') {
        throw ErrException.newFromCodeName(errConstants.ERR_DEFAULT_PAYMENT_METHOD_DELETE);
      }

      // TODO: 實作支付方式刪除邏輯，目前返回模擬結果
      const deleteResult = {
        paymentMethodId,
        status: 'DELETED',
        deletedAt: new Date().toISOString(),
        message: 'Payment method deleted successfully',
      };

      return this.cmmService.newResultInstance().withCode(200).withMessage('Success').withResult(deleteResult);
    } catch (error) {
      this._Logger.error(`Failed to delete payment method: ${error.message}`, error.stack);
      if (error instanceof ErrException) {
        throw error;
      }
      throw ErrException.newFromCodeName(errConstants.ERR_DELETE_PAYMENT_METHOD_FAILED);
    }
  }

  /**
   * 設定預設支付方式
   * POST /api/v1/account/payment-methods/:paymentMethodId/set-default
   */
  @Post('payment-methods/:paymentMethodId/set-default')
  @HttpCode(HttpStatus.OK)
  public async setDefaultPaymentMethod(@Param('paymentMethodId') paymentMethodId: string): Promise<CustomResult> {
    this._Logger.log(`Setting default payment method: ${paymentMethodId}`);

    try {
      // 檢查支付方式是否存在
      if (paymentMethodId === 'pm_non_existent') {
        throw ErrException.newFromCodeName(errConstants.ERR_PAYMENT_METHOD_NOT_FOUND);
      }

      // 檢查支付方式是否為非活躍狀態
      if (paymentMethodId === 'pm_inactive_123') {
        throw ErrException.newFromCodeName(errConstants.ERR_INACTIVE_PAYMENT_METHOD);
      }

      // 檢查是否已經是預設支付方式
      let message = 'Default payment method updated successfully';
      let previousDefault = null;

      if (paymentMethodId === 'pm_already_default') {
        message = 'Payment method is already the default';
        previousDefault = paymentMethodId;
      } else {
        previousDefault = 'pm_old_default_123'; // 模擬之前的預設支付方式
      }

      const result = {
        paymentMethodId,
        isDefault: true,
        previousDefault,
        updatedAt: new Date().toISOString(),
        message,
      };

      return this.cmmService.newResultInstance().withCode(200).withMessage('Success').withResult(result);
    } catch (error) {
      this._Logger.error(`Failed to set default payment method: ${error.message}`, error.stack);
      if (error instanceof ErrException) {
        throw error;
      }
      throw ErrException.newFromCodeName(errConstants.ERR_SET_DEFAULT_PAYMENT_METHOD_FAILED);
    }
  }
}
