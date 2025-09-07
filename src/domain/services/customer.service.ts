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

  /**
   * 進階客戶搜尋和篩選
   */
  public async searchCustomers(criteria: {
    name?: string;
    email?: string;
    phone?: string;
    status?: CustomerStatus;
    tags?: string[];
    createdAfter?: Date;
    createdBefore?: Date;
    locale?: string;
    timezone?: string;
    hasDefaultPaymentMethod?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{
    customers: CustomerEntity[];
    total: number;
    hasMore: boolean;
  }> {
    const limit = criteria.limit || 50;
    const offset = criteria.offset || 0;

    // 使用 repository 的進階搜尋功能
    const [customers, total] = await Promise.all([this.customerRepository.searchCustomers(criteria, limit, offset), this.customerRepository.countSearchResults(criteria)]);

    return {
      customers,
      total,
      hasMore: offset + customers.length < total,
    };
  }

  /**
   * 客戶生命週期值分析（CLV - Customer Lifetime Value）
   */
  public async calculateCustomerLifetimeValue(customerId: string): Promise<{
    totalRevenue: number;
    subscriptionCount: number;
    averageMonthlyRevenue: number;
    customerAgeDays: number;
    projectedLTV: number;
    riskScore: number;
  }> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new Error(`Customer with ID ${customerId} not found`);
    }

    // 這裡需要與 PaymentService 和 SubscriptionService 整合來取得實際數據
    // 目前先實作基礎計算邏輯
    const customerAgeDays = Math.floor((Date.now() - customer.createdAt.getTime()) / (1000 * 60 * 60 * 24));

    // 模擬數據（實際實作中需要查詢實際訂閱和支付記錄）
    const mockRevenue = Math.random() * 10000;
    const mockSubscriptions = Math.floor(Math.random() * 5) + 1;
    const averageMonthlyRevenue = customerAgeDays > 30 ? mockRevenue / (customerAgeDays / 30) : mockRevenue;

    // 簡單的 LTV 預測模型
    const projectedLTV = averageMonthlyRevenue * 12; // 預測一年的價值

    // 風險評分（0-100，越高越有風險）
    const riskScore = Math.min(100, Math.max(0, 50 - customerAgeDays / 10 + (mockSubscriptions > 3 ? -10 : 10)));

    return {
      totalRevenue: mockRevenue,
      subscriptionCount: mockSubscriptions,
      averageMonthlyRevenue,
      customerAgeDays,
      projectedLTV,
      riskScore,
    };
  }

  /**
   * 客戶分群分析
   */
  public async segmentCustomers(): Promise<{
    highValue: CustomerEntity[];
    mediumValue: CustomerEntity[];
    lowValue: CustomerEntity[];
    atRisk: CustomerEntity[];
    newCustomers: CustomerEntity[];
    inactive: CustomerEntity[];
  }> {
    const allActiveCustomers = await this.customerRepository.findActiveCustomers(1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const nineDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const segments = {
      highValue: [] as CustomerEntity[],
      mediumValue: [] as CustomerEntity[],
      lowValue: [] as CustomerEntity[],
      atRisk: [] as CustomerEntity[],
      newCustomers: [] as CustomerEntity[],
      inactive: [] as CustomerEntity[],
    };

    for (const customer of allActiveCustomers) {
      const customerAge = Date.now() - customer.createdAt.getTime();
      const ageInDays = customerAge / (1000 * 60 * 60 * 24);

      // 新客戶（註冊少於30天）
      if (customer.createdAt > thirtyDaysAgo) {
        segments.newCustomers.push(customer);
        continue;
      }

      // 模擬客戶價值評估
      const mockValue = Math.random() * 1000;
      const hasRecentActivity = customer.updatedAt > nineDaysAgo;

      if (!hasRecentActivity && ageInDays > 90) {
        segments.atRisk.push(customer);
      } else if (mockValue > 750) {
        segments.highValue.push(customer);
      } else if (mockValue > 250) {
        segments.mediumValue.push(customer);
      } else {
        segments.lowValue.push(customer);
      }
    }

    // 非活躍客戶
    const inactiveCustomers = await this.customerRepository.findByStatus(CustomerStatus.INACTIVE, 100);
    segments.inactive = inactiveCustomers;

    return segments;
  }

  /**
   * 客戶合規性檢查
   */
  public async performComplianceCheck(customerId: string): Promise<{
    isCompliant: boolean;
    issues: string[];
    recommendations: string[];
    gdprCompliant: boolean;
    dataRetentionCompliant: boolean;
  }> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new Error(`Customer with ID ${customerId} not found`);
    }

    const issues: string[] = [];
    const recommendations: string[] = [];

    // 檢查必要資料完整性
    if (!customer.email) {
      issues.push('Missing email address');
      recommendations.push('Request customer to provide email address');
    }

    if (!customer.name) {
      issues.push('Missing customer name');
      recommendations.push('Request customer to provide full name');
    }

    // GDPR 合規檢查
    const gdprCompliant = customer.locale && customer.locale.startsWith('eu-') ? customer.metadata && 'gdpr_consent' in customer.metadata : true;

    if (!gdprCompliant) {
      issues.push('GDPR consent not recorded');
      recommendations.push('Obtain and record GDPR consent');
    }

    // 資料保留期限檢查（假設為7年）
    const sevenYearsAgo = new Date(Date.now() - 7 * 365 * 24 * 60 * 60 * 1000);
    const dataRetentionCompliant = customer.createdAt > sevenYearsAgo || customer.status === CustomerStatus.ACTIVE;

    if (!dataRetentionCompliant) {
      issues.push('Customer data exceeds retention period');
      recommendations.push('Consider data archival or customer re-engagement');
    }

    return {
      isCompliant: issues.length === 0,
      issues,
      recommendations,
      gdprCompliant,
      dataRetentionCompliant,
    };
  }

  /**
   * 批量更新客戶資訊
   */
  public async batchUpdateCustomers(updates: {
    customerIds: string[];
    data: {
      locale?: string;
      timezone?: string;
      tags?: { add?: string[]; remove?: string[] };
      status?: CustomerStatus;
    };
  }): Promise<{
    updated: number;
    failed: number;
    errors: { customerId: string; error: string }[];
  }> {
    const results = {
      updated: 0,
      failed: 0,
      errors: [] as { customerId: string; error: string }[],
    };

    for (const customerId of updates.customerIds) {
      try {
        const customer = await this.customerRepository.findById(customerId);
        if (!customer) {
          throw new Error(`Customer not found: ${customerId}`);
        }

        // 更新基本資訊
        if (updates.data.locale) {
          customer.locale = updates.data.locale;
        }
        if (updates.data.timezone) {
          customer.timezone = updates.data.timezone;
        }
        if (updates.data.status) {
          customer.status = updates.data.status;
        }

        // 更新標籤
        if (updates.data.tags?.add) {
          updates.data.tags.add.forEach((tag) => customer.addTag(tag));
        }
        if (updates.data.tags?.remove) {
          updates.data.tags.remove.forEach((tag) => customer.removeTag(tag));
        }

        await this.customerRepository.save(customer);
        results.updated++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          customerId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * 客戶重複檢測和合併建議
   */
  public async detectDuplicateCustomers(): Promise<{
    duplicateGroups: {
      mainCustomer: CustomerEntity;
      duplicates: CustomerEntity[];
      similarityScore: number;
      suggestedAction: 'merge' | 'review' | 'ignore';
    }[];
  }> {
    const allCustomers = await this.customerRepository.findActiveCustomers(1000);
    const duplicateGroups: any[] = [];

    // 簡化的重複檢測邏輯（實際實作中可能需要更複雜的演算法）
    for (let i = 0; i < allCustomers.length; i++) {
      const customer = allCustomers[i];
      const potentialDuplicates: CustomerEntity[] = [];

      for (let j = i + 1; j < allCustomers.length; j++) {
        const otherCustomer = allCustomers[j];

        // 檢查相似度
        let similarityScore = 0;

        if (customer.email === otherCustomer.email) {
          similarityScore += 50; // 相同 Email 高度相似
        }

        if (customer.name && otherCustomer.name) {
          const nameSimilarity = this.calculateStringSimilarity(customer.name, otherCustomer.name);
          similarityScore += nameSimilarity * 30;
        }

        if (customer.phone && otherCustomer.phone && customer.phone === otherCustomer.phone) {
          similarityScore += 30; // 相同電話號碼
        }

        if (similarityScore > 60) {
          potentialDuplicates.push(otherCustomer);
        }
      }

      if (potentialDuplicates.length > 0) {
        const avgSimilarity =
          potentialDuplicates.reduce((sum, dup) => {
            return sum + this.calculateCustomerSimilarity(customer, dup);
          }, 0) / potentialDuplicates.length;

        duplicateGroups.push({
          mainCustomer: customer,
          duplicates: potentialDuplicates,
          similarityScore: avgSimilarity,
          suggestedAction: avgSimilarity > 80 ? 'merge' : avgSimilarity > 60 ? 'review' : 'ignore',
        });
      }
    }

    return { duplicateGroups };
  }

  /**
   * 計算字串相似度（簡化版 Levenshtein 距離）
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 100;

    const distance = this.levenshteinDistance(longer, shorter);
    return ((longer.length - distance) / longer.length) * 100;
  }

  /**
   * Levenshtein 距離計算
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * 計算客戶相似度
   */
  private calculateCustomerSimilarity(customer1: CustomerEntity, customer2: CustomerEntity): number {
    let score = 0;
    let factors = 0;

    if (customer1.email === customer2.email) {
      score += 50;
      factors++;
    }

    if (customer1.name && customer2.name) {
      score += this.calculateStringSimilarity(customer1.name, customer2.name) * 0.3;
      factors++;
    }

    if (customer1.phone && customer2.phone && customer1.phone === customer2.phone) {
      score += 30;
      factors++;
    }

    return factors > 0 ? score / factors : 0;
  }
}
