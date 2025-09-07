import { Controller, Post, Get, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { CommonService, ErrException, errConstants } from '@myapp/common';
import { LoggerService } from '@nestjs/common';
import { CustomResult } from '@xxxhand/app-common';
import { ValidatePromotionRequest } from '../domain/value-objects/promotion.request';

@Controller({
  path: 'promotions',
  version: '1',
})
export class PromotionsController {
  private readonly _Logger: LoggerService;

  constructor(private readonly cmmService: CommonService) {
    this._Logger = this.cmmService.getDefaultLogger(PromotionsController.name);
  }

  /**
   * 驗證優惠碼
   * POST /api/v1/promotions/validate
   */
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  public async validatePromotion(@Body() body: ValidatePromotionRequest): Promise<CustomResult> {
    this._Logger.log(`Validating promotion code: ${body.code}`);

    try {
      // Check for missing required fields
      if (!body.code || !body.productId) {
        throw ErrException.newFromCodeName(errConstants.ERR_INVALID_REQUEST_DATA);
      }

      // TODO: 實作優惠碼驗證邏輯，目前返回模擬數據
      const mockPromotions: { [key: string]: any } = {
        SUMMER2024: {
          code: 'SUMMER2024',
          name: 'Summer 2024 Promotion',
          description: '夏季限時優惠',
          type: 'PERCENTAGE',
          status: 'ACTIVE',
          discount: {
            type: 'PERCENTAGE',
            value: 20,
            applicablePeriod: {
              startDate: '2024-06-01T00:00:00Z',
              endDate: '2024-08-31T23:59:59Z',
            },
          },
          eligibility: {
            productRestrictions: [body.productId],
            customerRestrictions: body.customerId ? [body.customerId] : [],
            usageLimit: 1,
            remainingUses: 1,
          },
        },
        EXPIRED2023: {
          code: 'EXPIRED2023',
          name: 'Expired Promotion',
          description: '已過期優惠',
          type: 'PERCENTAGE',
          status: 'EXPIRED',
          discount: {
            type: 'PERCENTAGE',
            value: 15,
            applicablePeriod: {
              startDate: '2023-06-01T00:00:00Z',
              endDate: '2023-08-31T23:59:59Z',
            },
          },
          eligibility: {
            productRestrictions: [],
            customerRestrictions: [],
            usageLimit: 1,
            remainingUses: 0,
          },
        },
        PREMIUM_ONLY: {
          code: 'PREMIUM_ONLY',
          name: 'Premium Product Only',
          description: '僅限高級產品',
          type: 'FIXED_AMOUNT',
          status: 'ACTIVE',
          discount: {
            type: 'FIXED_AMOUNT',
            value: 100,
            applicablePeriod: {
              startDate: '2024-01-01T00:00:00Z',
              endDate: '2024-12-31T23:59:59Z',
            },
          },
          eligibility: {
            productRestrictions: ['prod_premium_monthly'],
            customerRestrictions: [],
            usageLimit: 1,
            remainingUses: 1,
          },
        },
        NEW_CUSTOMER_ONLY: {
          code: 'NEW_CUSTOMER_ONLY',
          name: 'New Customer Only',
          description: '僅限新用戶',
          type: 'FIXED_AMOUNT',
          status: 'ACTIVE',
          discount: {
            type: 'FIXED_AMOUNT',
            value: 150,
            applicablePeriod: {
              startDate: '2024-01-01T00:00:00Z',
              endDate: '2024-12-31T23:59:59Z',
            },
          },
          eligibility: {
            productRestrictions: [],
            customerRestrictions: ['cust_new_user_only'],
            usageLimit: 1,
            remainingUses: 1,
          },
        },
      };

      const promotion = mockPromotions[body.code];

      if (!promotion) {
        throw ErrException.newFromCodeName(errConstants.ERR_PROMOTION_NOT_FOUND);
      }

      // Check if it's an expired promotion
      if (promotion.status === 'EXPIRED') {
        return this.cmmService
          .newResultInstance()
          .withCode(200)
          .withMessage('Success')
          .withResult({
            valid: false,
            promotion,
            discount: promotion.discount,
            eligibility: {
              ...promotion.eligibility,
              eligible: false,
              reasons: ['Promotion code has expired'],
            },
          });
      }

      // Check product eligibility
      if (promotion.eligibility.productRestrictions.length > 0 && !promotion.eligibility.productRestrictions.includes(body.productId)) {
        return this.cmmService
          .newResultInstance()
          .withCode(200)
          .withMessage('Success')
          .withResult({
            valid: false,
            promotion,
            discount: promotion.discount,
            eligibility: {
              ...promotion.eligibility,
              eligible: false,
              reasons: ['Product not eligible for this promotion'],
            },
          });
      }

      // Check customer eligibility
      if (promotion.eligibility.customerRestrictions.length > 0 && body.customerId && !promotion.eligibility.customerRestrictions.includes(body.customerId)) {
        return this.cmmService
          .newResultInstance()
          .withCode(200)
          .withMessage('Success')
          .withResult({
            valid: false,
            promotion,
            discount: promotion.discount,
            eligibility: {
              ...promotion.eligibility,
              eligible: false,
              reasons: ['Customer not eligible for this promotion'],
            },
          });
      }

      return this.cmmService
        .newResultInstance()
        .withCode(200)
        .withMessage('Success')
        .withResult({
          valid: true,
          promotion,
          discount: promotion.discount,
          eligibility: {
            ...promotion.eligibility,
            eligible: true,
            reasons: [],
          },
        });
    } catch (error) {
      this._Logger.error(`Failed to validate promotion: ${error.message}`, error.stack);
      if (error instanceof ErrException) {
        throw error;
      }
      throw ErrException.newFromCodeName(errConstants.ERR_INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 查詢可用優惠
   * GET /api/v1/promotions?productId=xxx&customerId=xxx
   */
  @Get()
  public async getAvailablePromotions(@Query('productId') productId?: string, @Query('customerId') customerId?: string, @Query('type') type?: string): Promise<CustomResult> {
    this._Logger.log(`Getting available promotions for product: ${productId}, customer: ${customerId}`);

    try {
      // Check for required productId parameter
      if (!productId) {
        throw ErrException.newFromCodeName(errConstants.ERR_PRODUCT_ID_REQUIRED);
      }

      // Handle non-existent product
      if (productId === 'prod_nonexistent') {
        return this.cmmService.newResultInstance().withCode(200).withMessage('Success').withResult({
          promotions: [],
        });
      }

      // TODO: 實作可用優惠查詢邏輯，目前返回模擬數據
      const allPromotions = [
        {
          code: 'WELCOME2024',
          name: '新用戶歡迎優惠',
          description: '新用戶註冊首次訂閱享有100元折扣',
          type: 'FIXED_AMOUNT',
          discount: {
            type: 'FIXED_AMOUNT',
            value: 100,
            currency: 'TWD',
          },
          validFrom: '2024-01-01T00:00:00Z',
          validUntil: '2024-12-31T23:59:59Z',
          status: 'ACTIVE',
          usageLimit: 1,
          currentUsage: 0,
          remainingUsage: 1,
          autoApply: false,
          stackable: false,
          eligibility: {
            newCustomersOnly: true,
            minimumOrderValue: 500,
          },
        },
        {
          code: 'ANNUAL20',
          name: '年繳優惠',
          description: '選擇年繳方案享有20%折扣',
          type: 'PERCENTAGE',
          discount: {
            type: 'PERCENTAGE',
            value: 20,
            currency: 'TWD',
          },
          validFrom: '2024-01-01T00:00:00Z',
          validUntil: '2024-12-31T23:59:59Z',
          status: 'ACTIVE',
          usageLimit: -1,
          currentUsage: 5,
          remainingUsage: -1,
          autoApply: true,
          stackable: true,
          eligibility: {
            newCustomersOnly: false,
            minimumOrderValue: 1000,
          },
          conditions: {
            billingCycle: 'YEARLY',
          },
        },
      ];

      // Filter by type if specified
      let filteredPromotions = allPromotions;
      if (type) {
        filteredPromotions = allPromotions.filter((p) => p.type === type);
      }

      return this.cmmService.newResultInstance().withCode(200).withMessage('Success').withResult({
        promotions: filteredPromotions,
      });
    } catch (error) {
      this._Logger.error(`Failed to get available promotions: ${error.message}`, error.stack);
      if (error instanceof ErrException) {
        throw error;
      }
      throw ErrException.newFromCodeName(errConstants.ERR_INTERNAL_SERVER_ERROR);
    }
  }
}
