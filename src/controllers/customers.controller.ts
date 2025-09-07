import { Controller, Post, Get, Put, Delete, Body, Param, HttpStatus, HttpException } from '@nestjs/common';
import { CommonService, ErrException, errConstants } from '@myapp/common';
import { LoggerService } from '@nestjs/common';
import { CustomResult } from '@xxxhand/app-common';
import { CustomerService } from '../domain/services/customer.service';
import { CreateCustomerRequest, UpdateCustomerRequest, AddCustomerTagRequest, AssignPaymentMethodRequest } from '../domain/value-objects/customer.request';

@Controller({
  path: 'customers',
  version: '1',
})
export class CustomersController {
  private readonly _Logger: LoggerService;

  constructor(
    private readonly cmmService: CommonService,
    private readonly customerService: CustomerService,
  ) {
    this._Logger = this.cmmService.getDefaultLogger(CustomersController.name);
  }

  /**
   * 創建客戶
   * POST /api/v1/customers
   */
  @Post()
  public async createCustomer(@Body() body: CreateCustomerRequest): Promise<CustomResult> {
    this._Logger.log(`Creating customer: ${body.name} (${body.email})`);

    try {
      // 檢查郵箱是否已存在
      const existingCustomer = await this.customerService.getCustomerByEmail(body.email);
      if (existingCustomer) {
        throw ErrException.newFromCodeName(errConstants.ERR_CLIENT_DUPLICATED);
      }

      const customer = await this.customerService.createCustomer(body.name, body.email, body.phone);

      return this.cmmService.newResultInstance().withResult({
        customerId: customer.id,
        name: customer.name,
        email: customer.email,
        status: customer.status,
        createdAt: customer.createdAt,
      });
    } catch (error) {
      this._Logger.error(`Failed to create customer: ${error.message}`, error.stack);
      if (error instanceof ErrException) {
        throw error;
      }
      throw new HttpException('Failed to create customer', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 獲取客戶詳情
   * GET /api/v1/customers/:id
   */
  @Get(':id')
  public async getCustomer(@Param('id') id: string): Promise<CustomResult> {
    this._Logger.log(`Getting customer: ${id}`);

    try {
      const customer = await this.customerService.getCustomerById(id);
      if (!customer) {
        throw ErrException.newFromCodeName(errConstants.ERR_CLIENT_NOT_FOUND);
      }

      return this.cmmService.newResultInstance().withResult({
        customerId: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        status: customer.status,
        tags: customer.tags,
        locale: customer.locale,
        timezone: customer.timezone,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
      });
    } catch (error) {
      this._Logger.error(`Failed to get customer: ${error.message}`, error.stack);
      if (error instanceof ErrException) {
        throw error;
      }
      throw new HttpException('Failed to get customer', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 更新客戶信息
   * PUT /api/v1/customers/:id
   */
  @Put(':id')
  public async updateCustomer(@Param('id') id: string, @Body() body: UpdateCustomerRequest): Promise<CustomResult> {
    this._Logger.log(`Updating customer: ${id}`);

    try {
      const customer = await this.customerService.updateCustomer(id, {
        name: body.name,
        phone: body.phone,
      });
      if (!customer) {
        throw ErrException.newFromCodeName(errConstants.ERR_CLIENT_NOT_FOUND);
      }

      return this.cmmService.newResultInstance().withResult({
        customerId: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        status: customer.status,
        updatedAt: customer.updatedAt,
      });
    } catch (error) {
      this._Logger.error(`Failed to update customer: ${error.message}`, error.stack);
      if (error instanceof ErrException) {
        throw error;
      }
      throw new HttpException('Failed to update customer', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 刪除客戶 (軟刪除)
   * DELETE /api/v1/customers/:id
   */
  @Delete(':id')
  public async deleteCustomer(@Param('id') id: string): Promise<CustomResult> {
    this._Logger.log(`Deleting customer: ${id}`);

    try {
      const customer = await this.customerService.deactivateCustomer(id);
      if (!customer) {
        throw ErrException.newFromCodeName(errConstants.ERR_CLIENT_NOT_FOUND);
      }

      return this.cmmService.newResultInstance().withResult({
        customerId: customer.id,
        status: customer.status,
        updatedAt: customer.updatedAt,
      });
    } catch (error) {
      this._Logger.error(`Failed to delete customer: ${error.message}`, error.stack);
      if (error instanceof ErrException) {
        throw error;
      }
      throw new HttpException('Failed to delete customer', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 添加客戶標籤
   * POST /api/v1/customers/:id/tags
   */
  @Post(':id/tags')
  public async addCustomerTag(@Param('id') id: string, @Body() body: AddCustomerTagRequest): Promise<CustomResult> {
    this._Logger.log(`Adding tag "${body.tag}" to customer: ${id}`);

    try {
      const customer = await this.customerService.addCustomerTag(id, body.tag);
      if (!customer) {
        throw ErrException.newFromCodeName(errConstants.ERR_CLIENT_NOT_FOUND);
      }

      return this.cmmService.newResultInstance().withResult({
        customerId: customer.id,
        tags: customer.tags,
        updatedAt: customer.updatedAt,
      });
    } catch (error) {
      this._Logger.error(`Failed to add customer tag: ${error.message}`, error.stack);
      if (error instanceof ErrException) {
        throw error;
      }
      throw new HttpException('Failed to add customer tag', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 移除客戶標籤
   * DELETE /api/v1/customers/:id/tags/:tag
   */
  @Delete(':id/tags/:tag')
  public async removeCustomerTag(@Param('id') id: string, @Param('tag') tag: string): Promise<CustomResult> {
    this._Logger.log(`Removing tag "${tag}" from customer: ${id}`);

    try {
      const customer = await this.customerService.removeCustomerTag(id, tag);
      if (!customer) {
        throw ErrException.newFromCodeName(errConstants.ERR_CLIENT_NOT_FOUND);
      }

      return this.cmmService.newResultInstance().withResult({
        customerId: customer.id,
        tags: customer.tags,
        updatedAt: customer.updatedAt,
      });
    } catch (error) {
      this._Logger.error(`Failed to remove customer tag: ${error.message}`, error.stack);
      if (error instanceof ErrException) {
        throw error;
      }
      throw new HttpException('Failed to remove customer tag', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 設定預設支付方式
   * POST /api/v1/customers/:id/payment-methods
   */
  @Post(':id/payment-methods')
  public async setDefaultPaymentMethod(@Param('id') id: string, @Body() body: AssignPaymentMethodRequest): Promise<CustomResult> {
    this._Logger.log(`Setting default payment method ${body.paymentMethodId} for customer: ${id}`);

    try {
      const customer = await this.customerService.setDefaultPaymentMethod(id, body.paymentMethodId);
      if (!customer) {
        throw ErrException.newFromCodeName(errConstants.ERR_CLIENT_NOT_FOUND);
      }

      return this.cmmService.newResultInstance().withResult({
        customerId: customer.id,
        defaultPaymentMethodId: customer.defaultPaymentMethodId,
        updatedAt: customer.updatedAt,
      });
    } catch (error) {
      this._Logger.error(`Failed to set default payment method: ${error.message}`, error.stack);
      if (error instanceof ErrException) {
        throw error;
      }
      throw new HttpException('Failed to set default payment method', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
