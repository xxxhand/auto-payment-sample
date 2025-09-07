import { Injectable } from '@nestjs/common';
import { CustomerEntity, CustomerStatus } from '../entities';
import { CustomerRepository } from '../../infra/repositories/customer.repository';
import { CustomDefinition } from '@xxxhand/app-common';

/**
 * 客戶管理服務
 * 負責客戶生命週期管理和業務邏輯
 */
@Injectable()
export class CustomerService {
  constructor(private readonly customerRepository: CustomerRepository) {}

  /**
   * 創建新客戶
   */
  public async createCustomer(name: string, email: string, phone?: string, locale: string = 'zh-TW', timezone: string = 'Asia/Taipei'): Promise<CustomerEntity> {
    // 檢查 Email 是否已存在
    const existingCustomer = await this.customerRepository.findByEmail(email);
    if (existingCustomer) {
      throw new Error(`Customer with email ${email} already exists`);
    }

    const customer = new CustomerEntity(name, email);
    if (phone) {
      customer.phone = phone;
    }
    customer.locale = locale;
    customer.timezone = timezone;
    customer.status = CustomerStatus.ACTIVE;

    return await this.customerRepository.save(customer);
  }

  /**
   * 根據 ID 獲取客戶
   */
  public async getCustomerById(id: string): Promise<CustomDefinition.TNullable<CustomerEntity>> {
    return await this.customerRepository.findById(id);
  }

  /**
   * 根據 Email 獲取客戶
   */
  public async getCustomerByEmail(email: string): Promise<CustomDefinition.TNullable<CustomerEntity>> {
    return await this.customerRepository.findByEmail(email);
  }

  /**
   * 更新客戶資訊
   */
  public async updateCustomer(
    customerId: string,
    updates: {
      name?: string;
      phone?: string;
      locale?: string;
      timezone?: string;
    },
  ): Promise<CustomDefinition.TNullable<CustomerEntity>> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new Error(`Customer with ID ${customerId} not found`);
    }

    customer.updateInfo({
      name: updates.name,
      phone: updates.phone,
    });
    if (updates.locale) {
      customer.locale = updates.locale;
    }
    if (updates.timezone) {
      customer.timezone = updates.timezone;
    }

    return await this.customerRepository.save(customer);
  }

  /**
   * 激活客戶
   */
  public async activateCustomer(customerId: string): Promise<CustomDefinition.TNullable<CustomerEntity>> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new Error(`Customer with ID ${customerId} not found`);
    }

    customer.activate();
    return await this.customerRepository.save(customer);
  }

  /**
   * 停用客戶
   */
  public async deactivateCustomer(customerId: string): Promise<CustomDefinition.TNullable<CustomerEntity>> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new Error(`Customer with ID ${customerId} not found`);
    }

    customer.deactivate();
    return await this.customerRepository.save(customer);
  }

  /**
   * 軟刪除客戶
   */
  public async deleteCustomer(customerId: string): Promise<void> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new Error(`Customer with ID ${customerId} not found`);
    }

    await this.customerRepository.softDelete(customerId);
  }

  /**
   * 為客戶添加標籤
   */
  public async addCustomerTag(customerId: string, tag: string): Promise<CustomDefinition.TNullable<CustomerEntity>> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new Error(`Customer with ID ${customerId} not found`);
    }

    customer.addTag(tag);
    return await this.customerRepository.save(customer);
  }

  /**
   * 移除客戶標籤
   */
  public async removeCustomerTag(customerId: string, tag: string): Promise<CustomDefinition.TNullable<CustomerEntity>> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new Error(`Customer with ID ${customerId} not found`);
    }

    customer.removeTag(tag);
    return await this.customerRepository.save(customer);
  }

  /**
   * 設定預設支付方式
   */
  public async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<CustomDefinition.TNullable<CustomerEntity>> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new Error(`Customer with ID ${customerId} not found`);
    }

    customer.setDefaultPaymentMethod(paymentMethodId);
    return await this.customerRepository.save(customer);
  }

  /**
   * 取得活躍客戶列表
   */
  public async getActiveCustomers(limit: number = 100): Promise<CustomerEntity[]> {
    return await this.customerRepository.findActiveCustomers(limit);
  }

  /**
   * 根據標籤查找客戶
   */
  public async getCustomersByTag(tag: string): Promise<CustomerEntity[]> {
    return await this.customerRepository.findByTags([tag]);
  }

  /**
   * 統計客戶數量
   */
  public async getCustomerCounts(): Promise<{
    total: number;
    active: number;
    inactive: number;
  }> {
    const [total, active, inactive] = await Promise.all([
      this.customerRepository.countCustomers(),
      this.customerRepository.countCustomers(CustomerStatus.ACTIVE),
      this.customerRepository.countCustomers(CustomerStatus.INACTIVE),
    ]);

    return { total, active, inactive };
  }
}
