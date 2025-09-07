import { Injectable } from '@nestjs/common';
import { SubscriptionEntity, SubscriptionStatus, BillingCycle } from '../entities';
import { SubscriptionRepository } from '../../infra/repositories/subscription.repository';
import { CustomerRepository } from '../../infra/repositories/customer.repository';
import { CustomDefinition } from '@xxxhand/app-common';

/**
 * 訂閱管理服務
 * 負責訂閱生命週期管理、計費邏輯和狀態機控制
 */
@Injectable()
export class SubscriptionService {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly customerRepository: CustomerRepository,
  ) {}

  /**
   * 創建新訂閱
   */
  public async createSubscription(
    customerId: string,
    paymentMethodId: string,
    planName: string,
    amount: number,
    billingCycle: BillingCycle = BillingCycle.MONTHLY,
    trialDays?: number,
  ): Promise<SubscriptionEntity> {
    // 驗證客戶存在且活躍
    const customer = await this.customerRepository.findById(customerId);
    if (!customer || !customer.isActive()) {
      throw new Error(`Active customer with ID ${customerId} not found`);
    }

    const subscription = new SubscriptionEntity(customerId, paymentMethodId, planName, amount, billingCycle);

    // 設定試用期
    if (trialDays && trialDays > 0) {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + trialDays);
      subscription.trialEndDate = trialEnd;
      subscription.status = SubscriptionStatus.TRIALING;
    } else {
      subscription.status = SubscriptionStatus.ACTIVE;
    }

    // 計算首次計費週期
    const now = new Date();
    const periodStart = new Date(now);
    const periodEnd = this.calculateNextBillingDate(now, billingCycle);
    subscription.updateBillingPeriod(periodStart, periodEnd, periodEnd);

    return await this.subscriptionRepository.save(subscription);
  }

  /**
   * 根據 ID 獲取訂閱
   */
  public async getSubscriptionById(id: string): Promise<CustomDefinition.TNullable<SubscriptionEntity>> {
    return await this.subscriptionRepository.findById(id);
  }

  /**
   * 根據客戶 ID 獲取訂閱列表
   */
  public async getSubscriptionsByCustomerId(customerId: string): Promise<SubscriptionEntity[]> {
    return await this.subscriptionRepository.findByCustomerId(customerId);
  }

  /**
   * 激活訂閱（從試用期轉為正式）
   */
  public async activateSubscription(subscriptionId: string): Promise<CustomDefinition.TNullable<SubscriptionEntity>> {
    const subscription = await this.subscriptionRepository.findById(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription with ID ${subscriptionId} not found`);
    }

    subscription.activate();
    return await this.subscriptionRepository.save(subscription);
  }

  /**
   * 取消訂閱
   */
  public async cancelSubscription(subscriptionId: string, reason?: string): Promise<CustomDefinition.TNullable<SubscriptionEntity>> {
    const subscription = await this.subscriptionRepository.findById(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription with ID ${subscriptionId} not found`);
    }

    subscription.cancel(reason);
    return await this.subscriptionRepository.save(subscription);
  }

  /**
   * 記錄成功計費
   */
  public async recordSuccessfulBilling(subscriptionId: string): Promise<CustomDefinition.TNullable<SubscriptionEntity>> {
    const subscription = await this.subscriptionRepository.findById(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription with ID ${subscriptionId} not found`);
    }

    subscription.recordSuccessfulBilling();
    return await this.subscriptionRepository.save(subscription);
  }

  /**
   * 記錄失敗計費
   */
  public async recordFailedBilling(subscriptionId: string): Promise<CustomDefinition.TNullable<SubscriptionEntity>> {
    const subscription = await this.subscriptionRepository.findById(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription with ID ${subscriptionId} not found`);
    }

    subscription.recordFailedBilling();
    return await this.subscriptionRepository.save(subscription);
  }

  /**
   * 獲取需要計費的訂閱
   */
  public async getSubscriptionsDueForBilling(): Promise<SubscriptionEntity[]> {
    const today = new Date();
    return await this.subscriptionRepository.findDueForBilling(today, today);
  }

  /**
   * 計算下次計費日期
   */
  private calculateNextBillingDate(currentDate: Date, billingCycle: BillingCycle): Date {
    const nextDate = new Date(currentDate);

    switch (billingCycle) {
      case BillingCycle.MONTHLY:
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case BillingCycle.YEARLY:
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
      case BillingCycle.QUARTERLY:
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      case BillingCycle.WEEKLY:
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      default:
        throw new Error(`Unsupported billing cycle: ${billingCycle}`);
    }

    return nextDate;
  }

  /**
   * 獲取訂閱統計資料
   */
  public async getSubscriptionStatistics(): Promise<{
    total: number;
    active: number;
    trialing: number;
    canceled: number;
  }> {
    const [total, active, trialing, canceled] = await Promise.all([
      this.subscriptionRepository.countSubscriptions(),
      this.subscriptionRepository.countSubscriptions(SubscriptionStatus.ACTIVE),
      this.subscriptionRepository.countSubscriptions(SubscriptionStatus.TRIALING),
      this.subscriptionRepository.countSubscriptions(SubscriptionStatus.CANCELED),
    ]);

    return {
      total,
      active,
      trialing,
      canceled,
    };
  }
}
