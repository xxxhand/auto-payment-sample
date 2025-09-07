import { Controller, Get, Param, Query, HttpException, HttpStatus } from '@nestjs/common';
import { CommonService } from '@myapp/common';
import { LoggerService } from '@nestjs/common';
import { CustomResult } from '@xxxhand/app-common';

@Controller({
  path: 'products',
  version: '1',
})
export class ProductsController {
  private readonly _Logger: LoggerService;

  constructor(private readonly cmmService: CommonService) {
    this._Logger = this.cmmService.getDefaultLogger(ProductsController.name);
  }

  /**
   * 查詢產品列表
   * GET /api/v1/products?includeInactive=false
   */
  @Get()
  public async getProducts(@Query('includeInactive') includeInactive: string = 'false'): Promise<CustomResult> {
    this._Logger.log(`Getting products list, includeInactive: ${includeInactive}`);

    try {
      // TODO: 實作產品查詢邏輯，目前返回模擬數據
      const products = [
        {
          productId: '64f5c8e5a1b2c3d4e5f67890',
          productName: 'Premium Plan',
          displayName: '高級方案',
          description: '完整功能的高級訂閱方案',
          billingPlans: [
            {
              planId: '64f5c8e5a1b2c3d4e5f67891',
              planName: 'Monthly Premium',
              displayName: '月繳高級方案',
              pricing: {
                amount: 999,
                currency: 'TWD',
              },
              billingCycle: {
                type: 'MONTHLY',
              },
              features: ['unlimited_storage', 'priority_support', 'advanced_analytics'],
            },
            {
              planId: '64f5c8e5a1b2c3d4e5f67892',
              planName: 'Yearly Premium',
              displayName: '年繳高級方案',
              pricing: {
                amount: 9990,
                currency: 'TWD',
              },
              billingCycle: {
                type: 'YEARLY',
              },
              features: ['unlimited_storage', 'priority_support', 'advanced_analytics', 'yearly_discount'],
            },
          ],
          isActive: true,
        },
        {
          productId: '64f5c8e5a1b2c3d4e5f67893',
          productName: 'Professional Plan',
          displayName: '專業方案',
          description: '適合專業用戶的完整方案',
          billingPlans: [
            {
              planId: '64f5c8e5a1b2c3d4e5f67894',
              planName: 'Monthly Professional',
              displayName: '月繳專業方案',
              pricing: {
                amount: 1499,
                currency: 'TWD',
              },
              billingCycle: {
                type: 'MONTHLY',
              },
              features: ['unlimited_storage', '24_7_support', 'advanced_analytics', 'api_access', 'custom_integrations'],
            },
          ],
          isActive: true,
        },
        {
          productId: '64f5c8e5a1b2c3d4e5f67895',
          productName: 'Basic Plan',
          displayName: '基本方案',
          description: '入門級用戶的基本方案',
          billingPlans: [
            {
              planId: '64f5c8e5a1b2c3d4e5f67896',
              planName: 'Monthly Basic',
              displayName: '月繳基本方案',
              pricing: {
                amount: 499,
                currency: 'TWD',
              },
              billingCycle: {
                type: 'MONTHLY',
              },
              features: ['basic_storage', 'email_support'],
            },
          ],
          isActive: includeInactive === 'true' ? false : true,
        },
      ];

      // 根據 includeInactive 參數篩選
      const filteredProducts = includeInactive === 'true' ? products : products.filter((product) => product.isActive);

      return this.cmmService.newResultInstance().withResult({
        products: filteredProducts,
      });
    } catch (error) {
      this._Logger.error(`Failed to get products: ${error.message}`, error.stack);
      throw new HttpException('Failed to get products', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 查詢單一產品詳情
   * GET /api/v1/products/:productId
   */
  @Get(':productId')
  public async getProduct(@Param('productId') productId: string): Promise<CustomResult> {
    this._Logger.log(`Getting product: ${productId}`);

    try {
      // TODO: 實作單一產品查詢邏輯，目前返回模擬數據
      const product = {
        productId: '64f5c8e5a1b2c3d4e5f67890',
        productName: 'Premium Plan',
        displayName: '高級方案',
        description: '完整功能的高級訂閱方案',
        billingPlans: [
          {
            planId: '64f5c8e5a1b2c3d4e5f67891',
            planName: 'Monthly Premium',
            displayName: '月繳高級方案',
            pricing: {
              amount: 999,
              currency: 'TWD',
            },
            billingCycle: {
              type: 'MONTHLY',
              intervalDays: 30,
            },
            features: ['unlimited_storage', 'priority_support', 'advanced_analytics'],
            trialPeriodDays: 14,
          },
        ],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (productId !== product.productId) {
        throw new HttpException('Product not found', HttpStatus.NOT_FOUND);
      }

      return this.cmmService.newResultInstance().withResult(product);
    } catch (error) {
      this._Logger.error(`Failed to get product: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to get product', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 查詢產品的方案列表
   * GET /api/v1/products/:productId/plans
   */
  @Get(':productId/plans')
  public async getProductPlans(@Param('productId') productId: string): Promise<CustomResult> {
    this._Logger.log(`Getting plans for product: ${productId}`);

    try {
      // TODO: 實作產品方案查詢邏輯，目前返回模擬數據
      const plans = [
        {
          planId: '64f5c8e5a1b2c3d4e5f67891',
          planName: 'Monthly Premium',
          displayName: '月繳高級方案',
          pricing: {
            amount: 999,
            currency: 'TWD',
          },
          billingCycle: {
            type: 'MONTHLY',
            intervalDays: 30,
          },
          features: ['unlimited_storage', 'priority_support', 'advanced_analytics'],
          trialPeriodDays: 14,
          isActive: true,
        },
        {
          planId: '64f5c8e5a1b2c3d4e5f67892',
          planName: 'Yearly Premium',
          displayName: '年繳高級方案',
          pricing: {
            amount: 9990,
            currency: 'TWD',
          },
          billingCycle: {
            type: 'YEARLY',
            intervalDays: 365,
          },
          features: ['unlimited_storage', 'priority_support', 'advanced_analytics', 'yearly_discount'],
          trialPeriodDays: 14,
          isActive: true,
        },
      ];

      return this.cmmService.newResultInstance().withResult({
        productId,
        plans: plans,
      });
    } catch (error) {
      this._Logger.error(`Failed to get product plans: ${error.message}`, error.stack);
      throw new HttpException('Failed to get product plans', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
