import { Controller, Get, Post, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { CommonService, ErrException, errConstants } from '@myapp/common';
import { LoggerService } from '@nestjs/common';
import { CustomResult } from '@xxxhand/app-common';
import { ProductApplicationService, CreateProductRequest } from '../application/product.application.service';

@Controller({
  path: 'products',
  version: '1',
})
export class ProductsController {
  private readonly _Logger: LoggerService;

  constructor(
    private readonly cmmService: CommonService,
    private readonly productAppService: ProductApplicationService,
  ) {
    this._Logger = this.cmmService.getDefaultLogger(ProductsController.name);
  }

  /**
   * 創建產品
   * POST /api/v1/products
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  public async createProduct(@Body() body: CreateProductRequest): Promise<CustomResult> {
    this._Logger.log(`Creating product: ${body.name}`);

    try {
      // 基本驗證
      if (!body.name || !body.description) {
        throw ErrException.newFromCodeName(errConstants.ERR_INVALID_REQUEST_DATA);
      }

      const product = await this.productAppService.createProduct(body);
      const result = this.productAppService.toApiResponse(product);

      return this.cmmService.newResultInstance().withCode(201).withMessage('Product created successfully').withResult(result);
    } catch (error) {
      this._Logger.error('Failed to create product', error);
      if (error instanceof ErrException) throw error;
      throw ErrException.newFromCodeName(errConstants.ERR_INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 查詢產品列表
   * GET /api/v1/products
   */
  @Get()
  public async getProducts(
    @Query('status') status?: string,
    @Query('billing_interval') billingInterval?: string,
    @Query('includeInactive') includeInactive: string = 'false',
  ): Promise<CustomResult> {
    this._Logger.log(`Getting products list, status: ${status}, billingInterval: ${billingInterval}, includeInactive: ${includeInactive}`);

    try {
      const options: any = {};
      if (status) {
        options.status = status;
      }
      if (billingInterval) {
        options.billingInterval = billingInterval;
      }
      if (includeInactive === 'false') {
        options.activeOnly = true;
      }

      const products = await this.productAppService.getProducts(options);
      const results = products.map((product) => this.productAppService.toApiResponse(product));

      return this.cmmService.newResultInstance().withCode(200).withMessage('Success').withResult({ products: results });
    } catch (error) {
      this._Logger.error('Failed to get products', error);
      if (error instanceof ErrException) throw error;
      throw ErrException.newFromCodeName(errConstants.ERR_INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 根據 ID 查詢產品
   * GET /api/v1/products/:productId
   */
  @Get(':productId')
  public async getProductById(@Param('productId') productId: string): Promise<CustomResult> {
    this._Logger.log(`Getting product by ID: ${productId}`);

    try {
      const product = await this.productAppService.getProductById(productId);
      if (!product) {
        throw ErrException.newFromCodeName(errConstants.ERR_PRODUCT_NOT_FOUND);
      }

      const result = this.productAppService.toApiResponse(product);
      return this.cmmService.newResultInstance().withCode(200).withMessage('Success').withResult(result);
    } catch (error) {
      this._Logger.error('Failed to get product', error);
      if (error instanceof ErrException) throw error;
      throw ErrException.newFromCodeName(errConstants.ERR_INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 發佈產品
   * POST /api/v1/products/:productId/publish
   */
  @Post(':productId/publish')
  @HttpCode(HttpStatus.OK)
  public async publishProduct(@Param('productId') productId: string): Promise<CustomResult> {
    this._Logger.log(`Publishing product: ${productId}`);

    try {
      const product = await this.productAppService.publishProduct(productId);
      const result = this.productAppService.toApiResponse(product);

      return this.cmmService.newResultInstance().withCode(200).withMessage('Product published successfully').withResult(result);
    } catch (error) {
      this._Logger.error('Failed to publish product', error);
      if (error instanceof ErrException) throw error;
      throw ErrException.newFromCodeName(errConstants.ERR_INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 暫停產品
   * POST /api/v1/products/:productId/suspend
   */
  @Post(':productId/suspend')
  @HttpCode(HttpStatus.OK)
  public async suspendProduct(@Param('productId') productId: string): Promise<CustomResult> {
    this._Logger.log(`Suspending product: ${productId}`);

    try {
      const product = await this.productAppService.suspendProduct(productId);
      const result = this.productAppService.toApiResponse(product);

      return this.cmmService.newResultInstance().withCode(200).withMessage('Product suspended successfully').withResult(result);
    } catch (error) {
      this._Logger.error('Failed to suspend product', error);
      if (error instanceof ErrException) throw error;
      throw ErrException.newFromCodeName(errConstants.ERR_INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 查詢產品的計費計劃
   * GET /api/v1/products/:productId/plans
   */
  @Get(':productId/plans')
  public async getProductPlans(@Param('productId') productId: string): Promise<CustomResult> {
    this._Logger.log(`Getting plans for product: ${productId}`);

    try {
      const plans = await this.productAppService.getProductPlans(productId);
      return this.cmmService.newResultInstance().withCode(200).withMessage('Success').withResult(plans);
    } catch (error) {
      this._Logger.error('Failed to get product plans', error);
      if (error instanceof ErrException) throw error;
      throw ErrException.newFromCodeName(errConstants.ERR_INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 查詢產品的升級選項
   * GET /api/v1/products/:productId/upgrade-options
   */
  @Get(':productId/upgrade-options')
  public async getUpgradeOptions(@Param('productId') productId: string): Promise<CustomResult> {
    this._Logger.log(`Getting upgrade options for product: ${productId}`);

    try {
      const result = await this.productAppService.getUpgradeOptions(productId);
      return this.cmmService.newResultInstance().withCode(200).withMessage('Success').withResult(result);
    } catch (error) {
      this._Logger.error('Failed to get upgrade options', error);
      if (error.message && error.message.includes('not found')) {
        throw ErrException.newFromCodeName(errConstants.ERR_PRODUCT_NOT_FOUND);
      }
      if (error instanceof ErrException) throw error;
      throw ErrException.newFromCodeName(errConstants.ERR_INTERNAL_SERVER_ERROR);
    }
  }
}
