import { Controller, Post, Get, Body, Query, HttpException, HttpStatus } from '@nestjs/common';
import { CommonService } from '@myapp/common';
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
  public async validatePromotion(@Body() body: ValidatePromotionRequest): Promise<CustomResult> {
    this._Logger.log(`Validating promotion code: ${body.promotionCode}`);

    try {
      // TODO: 實作優惠碼驗證邏輯，目前返回模擬數據
      const mockPromotions: { [key: string]: any } = {
        WELCOME2024: {
          promotionId: '64f5c8e5a1b2c3d4e5f67893',
          promotionCode: 'WELCOME2024',
          promotionName: '新用戶歡迎優惠',
          isValid: true,
          discount: {
            discountType: 'FIXED_AMOUNT',
            discountValue: 100,
            currency: 'TWD',
          },
          validPeriod: {
            startDate: '2024-01-01T00:00:00Z',
            endDate: '2024-12-31T23:59:59Z',
          },
          usageInfo: {
            remainingUses: 1,
            canUse: true,
          },
          applicableProducts: [body.productId],
          applicablePlans: [body.planId],
        },
        SUMMER50: {
          promotionId: '64f5c8e5a1b2c3d4e5f67894',
          promotionCode: 'SUMMER50',
          promotionName: '夏季折扣',
          isValid: true,
          discount: {
            discountType: 'PERCENTAGE',
            discountValue: 50,
            currency: 'TWD',
          },
          validPeriod: {
            startDate: '2024-06-01T00:00:00Z',
            endDate: '2024-08-31T23:59:59Z',
          },
          usageInfo: {
            remainingUses: 0,
            canUse: false,
          },
          applicableProducts: [body.productId],
        },
      };

      const promotion = mockPromotions[body.promotionCode];

      if (!promotion) {
        return this.cmmService.newResultInstance().withResult({
          promotionCode: body.promotionCode,
          isValid: false,
          reason: 'Promotion code not found',
        });
      }

      // 檢查產品和方案適用性
      if (body.productId && promotion.applicableProducts && !promotion.applicableProducts.includes(body.productId)) {
        return this.cmmService.newResultInstance().withResult({
          promotionCode: body.promotionCode,
          isValid: false,
          reason: 'Promotion code not applicable to this product',
        });
      }

      if (body.planId && promotion.applicablePlans && !promotion.applicablePlans.includes(body.planId)) {
        return this.cmmService.newResultInstance().withResult({
          promotionCode: body.promotionCode,
          isValid: false,
          reason: 'Promotion code not applicable to this plan',
        });
      }

      // 檢查有效期
      const now = new Date();
      const startDate = new Date(promotion.validPeriod.startDate);
      const endDate = new Date(promotion.validPeriod.endDate);

      if (now < startDate || now > endDate) {
        return this.cmmService.newResultInstance().withResult({
          promotionCode: body.promotionCode,
          isValid: false,
          reason: 'Promotion code has expired or not yet active',
        });
      }

      // 檢查使用次數
      if (promotion.usageInfo.remainingUses <= 0) {
        return this.cmmService.newResultInstance().withResult({
          promotionCode: body.promotionCode,
          isValid: false,
          reason: 'Promotion code has been fully used',
        });
      }

      return this.cmmService.newResultInstance().withResult(promotion);
    } catch (error) {
      this._Logger.error(`Failed to validate promotion: ${error.message}`, error.stack);
      throw new HttpException('Failed to validate promotion code', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 查詢可用優惠
   * GET /api/v1/promotions/available?productId=xxx&planId=xxx
   */
  @Get('available')
  public async getAvailablePromotions(@Query('productId') productId?: string, @Query('planId') planId?: string): Promise<CustomResult> {
    this._Logger.log(`Getting available promotions for product: ${productId}, plan: ${planId}`);

    try {
      // TODO: 實作可用優惠查詢邏輯，目前返回模擬數據
      const availablePromotions = [
        {
          promotionId: '64f5c8e5a1b2c3d4e5f67893',
          promotionCode: 'WELCOME2024',
          promotionName: '新用戶歡迎優惠',
          description: '新用戶註冊首次訂閱享有100元折扣',
          discount: {
            discountType: 'FIXED_AMOUNT',
            discountValue: 100,
            currency: 'TWD',
          },
          validPeriod: {
            startDate: '2024-01-01T00:00:00Z',
            endDate: '2024-12-31T23:59:59Z',
          },
          usageInfo: {
            remainingUses: 1,
            maxUses: 1,
          },
          isAutoApply: false,
          priority: 1,
        },
        {
          promotionId: '64f5c8e5a1b2c3d4e5f67895',
          promotionCode: 'ANNUAL20',
          promotionName: '年繳優惠',
          description: '選擇年繳方案享有20%折扣',
          discount: {
            discountType: 'PERCENTAGE',
            discountValue: 20,
            currency: 'TWD',
          },
          validPeriod: {
            startDate: '2024-01-01T00:00:00Z',
            endDate: '2024-12-31T23:59:59Z',
          },
          usageInfo: {
            remainingUses: 1,
            maxUses: 1,
          },
          isAutoApply: true,
          priority: 2,
          conditions: {
            billingCycle: 'YEARLY',
          },
        },
      ];

      // 根據產品和方案篩選可用優惠（這裡是簡化邏輯）
      const filteredPromotions = availablePromotions.filter((promo) => {
        // 簡化的篩選邏輯
        if (planId && promo.conditions?.billingCycle) {
          // 如果是年繳優惠，只在年繳方案顯示
          return planId.includes('Yearly') === (promo.conditions.billingCycle === 'YEARLY');
        }
        return true;
      });

      return this.cmmService.newResultInstance().withResult({
        productId,
        planId,
        promotions: filteredPromotions,
        totalCount: filteredPromotions.length,
      });
    } catch (error) {
      this._Logger.error(`Failed to get available promotions: ${error.message}`, error.stack);
      throw new HttpException('Failed to get available promotions', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
