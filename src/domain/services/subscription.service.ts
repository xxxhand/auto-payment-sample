import { Injectable } from '@nestjs/common';
import { SubscriptionEntity, SubscriptionStatus, BillingCycle } from '../entities';
import { SubscriptionRepository } from '../../infra/repositories/subscription.repository';
import { CustomDefinition } from '@xxxhand/app-common';

/**
 * 訂閱管理服務
 * 負責訂閱生命週期管理、計費邏輯和狀態機控制
 */
@Injectable()
export class SubscriptionService {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    // TODO: Phase 4.2 - Re-add CustomerRepository when implementing customer management
    // private readonly customerRepository: CustomerRepository,
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
    // TODO: Phase 4.2 - Re-implement customer validation with CustomerRepository
    // 驗證客戶存在且活躍
    // const customer = await this.customerRepository.findById(customerId);
    // if (!customer || !customer.isActive()) {
    //   throw new Error(`Active customer with ID ${customerId} not found`);
    // }

    // Temporary mock validation for Phase 4.1
    if (!customerId || customerId.length === 0) {
      throw new Error(`Customer ID is required`);
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

  /**
   * 變更訂閱方案
   */
  public async changePlan(
    subscriptionId: string,
    newProductId: string,
    newPlanName: string,
    newAmount: number,
    effectiveDate: 'immediate' | 'next_billing_cycle' = 'next_billing_cycle',
    prorationBehavior: 'create_prorations' | 'none' = 'create_prorations',
  ): Promise<{
    subscription: SubscriptionEntity;
    pricingAdjustment?: {
      oldAmount: number;
      newAmount: number;
      prorationAmount?: number;
      nextBillingAmount: number;
      effectiveDate: Date;
    };
  }> {
    const subscription = await this.subscriptionRepository.findById(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription with ID ${subscriptionId} not found`);
    }

    if (!subscription.isActive()) {
      throw new Error('Can only change plan for active subscriptions');
    }

    const oldAmount = subscription.amount;
    const pricingAdjustment: any = {
      oldAmount,
      newAmount: newAmount,
      nextBillingAmount: newAmount,
      effectiveDate: effectiveDate === 'immediate' ? new Date() : subscription.currentPeriodEnd,
    };

    // 計算按比例計費
    if (effectiveDate === 'immediate' && prorationBehavior === 'create_prorations') {
      const daysRemaining = Math.ceil((subscription.currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      const totalDays = Math.ceil((subscription.currentPeriodEnd.getTime() - subscription.currentPeriodStart.getTime()) / (1000 * 60 * 60 * 24));
      const prorationAmount = ((newAmount - oldAmount) * daysRemaining) / totalDays;
      pricingAdjustment.prorationAmount = Math.round(prorationAmount);
    }

    // 更新訂閱資訊
    subscription.planName = newPlanName;
    subscription.amount = newAmount;
    subscription.updatedAt = new Date();

    if (effectiveDate === 'immediate') {
      // 立即生效，更新當前計費週期
      subscription.updateBillingPeriod(subscription.currentPeriodStart, subscription.currentPeriodEnd, subscription.currentPeriodEnd);
    }

    const updatedSubscription = await this.subscriptionRepository.save(subscription);

    return {
      subscription: updatedSubscription,
      pricingAdjustment,
    };
  }

  /**
   * 暫停訂閱
   */
  public async pauseSubscription(
    subscriptionId: string,
    reason?: string,
    resumeDate?: Date,
  ): Promise<{
    subscription: SubscriptionEntity;
    pausedAt: Date;
    scheduledResumeDate?: Date;
  }> {
    const subscription = await this.subscriptionRepository.findById(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription with ID ${subscriptionId} not found`);
    }

    if (!subscription.isActive()) {
      throw new Error('Can only pause active subscriptions');
    }

    subscription.status = SubscriptionStatus.PAUSED; // 使用PAUSED作為暫停狀態
    subscription.updatedAt = new Date();

    const updatedSubscription = await this.subscriptionRepository.save(subscription);
    const pausedAt = new Date();

    return {
      subscription: updatedSubscription,
      pausedAt,
      scheduledResumeDate: resumeDate,
    };
  }

  /**
   * 恢復暫停的訂閱
   */
  public async resumeSubscription(subscriptionId: string): Promise<{
    subscription: SubscriptionEntity;
    resumedAt: Date;
    nextBillingDate: Date;
  }> {
    const subscription = await this.subscriptionRepository.findById(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription with ID ${subscriptionId} not found`);
    }

    if (subscription.isActive()) {
      throw new Error('Subscription is not paused');
    }

    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.updatedAt = new Date();

    // 重新計算下次計費日期
    const nextBillingDate = this.calculateNextBillingDate(new Date(), subscription.billingCycle);
    subscription.updateBillingPeriod(new Date(), nextBillingDate, nextBillingDate);

    const updatedSubscription = await this.subscriptionRepository.save(subscription);

    return {
      subscription: updatedSubscription,
      resumedAt: new Date(),
      nextBillingDate,
    };
  }

  /**
   * 獲取方案變更選項
   */
  public async getPlanChangeOptions(subscriptionId: string): Promise<{
    currentProduct: any;
    availableProducts: any[];
  }> {
    const subscription = await this.subscriptionRepository.findById(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription with ID ${subscriptionId} not found`);
    }

    // 模擬當前產品信息
    const currentProduct = {
      productId: `prod_${subscription.planName.toLowerCase().replace(' ', '_')}`,
      name: subscription.planName,
      amount: subscription.amount,
      currency: 'TWD',
      billingCycle: subscription.billingCycle,
    };

    // 模擬可用的升級選項
    const availableProducts = [
      {
        productId: 'prod_premium_monthly',
        name: 'Premium Monthly',
        pricing: { amount: 1999, currency: 'TWD' },
        priceDifference: { amount: 1999 - subscription.amount, currency: 'TWD' },
        estimatedChargeDate: subscription.currentPeriodEnd.toISOString(),
        features: ['Advanced Analytics', 'Priority Support', 'Custom Integrations'],
      },
      {
        productId: 'prod_enterprise_monthly',
        name: 'Enterprise Monthly',
        pricing: { amount: 4999, currency: 'TWD' },
        priceDifference: { amount: 4999 - subscription.amount, currency: 'TWD' },
        estimatedChargeDate: subscription.currentPeriodEnd.toISOString(),
        features: ['All Premium Features', 'Dedicated Account Manager', 'SLA Guarantee'],
      },
    ].filter((product) => product.pricing.amount > subscription.amount);

    return {
      currentProduct,
      availableProducts,
    };
  }

  /**
   * 處理訂閱退款申請
   */
  public async processRefund(
    subscriptionId: string,
    refundType: 'FULL' | 'PARTIAL' | 'PRORATED',
    refundAmount?: { amount: number; currency: string },
  ): Promise<{
    refundId: string;
    subscriptionId: string;
    refundType: string;
    refundAmount: { amount: number; currency: string };
    status: string;
    estimatedProcessingTime: string;
  }> {
    const subscription = await this.subscriptionRepository.findById(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription with ID ${subscriptionId} not found`);
    }

    let calculatedRefundAmount: { amount: number; currency: string };

    switch (refundType) {
      case 'FULL':
        calculatedRefundAmount = { amount: subscription.amount, currency: 'TWD' };
        break;
      case 'PARTIAL':
        if (!refundAmount) {
          throw new Error('Refund amount is required for partial refunds');
        }
        calculatedRefundAmount = refundAmount;
        break;
      case 'PRORATED':
        // 按剩餘天數計算
        const daysRemaining = Math.ceil((subscription.currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        const totalDays = Math.ceil((subscription.currentPeriodEnd.getTime() - subscription.currentPeriodStart.getTime()) / (1000 * 60 * 60 * 24));
        const prorationAmount = Math.round((subscription.amount * daysRemaining) / totalDays);
        calculatedRefundAmount = { amount: prorationAmount, currency: 'TWD' };
        break;
      default:
        throw new Error(`Unsupported refund type: ${refundType}`);
    }

    // 生成退款ID
    const refundId = `ref_${Date.now()}_${subscriptionId.slice(-6)}`;

    return {
      refundId,
      subscriptionId,
      refundType,
      refundAmount: calculatedRefundAmount,
      status: 'REQUESTED',
      estimatedProcessingTime: '3-5 business days',
    };
  }
}
