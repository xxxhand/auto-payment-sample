import { BaseEntity } from './base-entity.abstract';
import { SubscriptionStatus, BillingCycle } from '../enums/codes.const';

/**
 * 訂閱實體
 * 代表客戶的訂閱服務
 */
export class SubscriptionEntity extends BaseEntity {
  /** 所屬客戶 ID */
  public customerId: string = '';

  /** 支付方式 ID */
  public paymentMethodId: string = '';

  /** 訂閱方案名稱 */
  public planName: string = '';

  /** 訂閱狀態 */
  public status: SubscriptionStatus = SubscriptionStatus.ACTIVE;

  /** 計費週期 */
  public billingCycle: BillingCycle = BillingCycle.MONTHLY;

  /** 訂閱金額（以分為單位） */
  public amount: number = 0;

  /** 貨幣代碼 */
  public currency: string = 'TWD';

  /** 試用期結束日期 */
  public trialEndDate?: Date;

  /** 當前計費週期開始日期 */
  public currentPeriodStart: Date = new Date();

  /** 當前計費週期結束日期 */
  public currentPeriodEnd: Date = new Date();

  /** 下次計費日期 */
  public nextBillingDate: Date = new Date();

  /** 訂閱開始日期 */
  public startDate: Date = new Date();

  /** 訂閱結束日期（可選） */
  public endDate?: Date;

  /** 取消日期 */
  public canceledDate?: Date;

  /** 取消原因 */
  public cancelReason?: string;

  /** 連續失敗次數 */
  public consecutiveFailures: number = 0;

  /** 最後成功扣款日期 */
  public lastSuccessfulBillingDate?: Date;

  /** 最後失敗扣款日期 */
  public lastFailedBillingDate?: Date;

  /** 寬限期結束日期 */
  public gracePeriodEndDate?: Date;

  /** 訂閱描述 */
  public description?: string;

  /** 訂閱元資料 */
  public metadata: Record<string, any> = {};

  constructor(customerId: string, paymentMethodId: string, planName: string, amount: number, billingCycle: BillingCycle) {
    super();
    this.customerId = customerId;
    this.paymentMethodId = paymentMethodId;
    this.planName = planName;
    this.amount = amount;
    this.billingCycle = billingCycle;
  }

  /**
   * 檢查訂閱是否為活躍狀態
   */
  public isActive(): boolean {
    return this.status === SubscriptionStatus.ACTIVE;
  }

  /**
   * 檢查是否在試用期內
   */
  public isInTrial(): boolean {
    if (!this.trialEndDate) return false;
    return new Date() < this.trialEndDate;
  }

  /**
   * 檢查是否在寬限期內
   */
  public isInGracePeriod(): boolean {
    if (!this.gracePeriodEndDate) return false;
    return new Date() < this.gracePeriodEndDate && this.status === SubscriptionStatus.PAST_DUE;
  }

  /**
   * 檢查是否過期
   */
  public isExpired(): boolean {
    return this.status === SubscriptionStatus.PAST_DUE && this.gracePeriodEndDate && new Date() > this.gracePeriodEndDate;
  }

  /**
   * 啟用訂閱
   */
  public activate(): void {
    this.status = SubscriptionStatus.ACTIVE;
    this.consecutiveFailures = 0;
    this.gracePeriodEndDate = undefined;
    this.touch();
  }

  /**
   * 暫停訂閱
   */
  public pause(): void {
    this.status = SubscriptionStatus.PAUSED;
    this.touch();
  }

  /**
   * 取消訂閱
   */
  public cancel(reason?: string): void {
    this.status = SubscriptionStatus.CANCELED;
    this.canceledDate = new Date();
    this.cancelReason = reason;
    this.endDate = new Date();
    this.touch();
  }

  /**
   * 標記為逾期
   */
  public markPastDue(gracePeriodEndDate?: Date): void {
    this.status = SubscriptionStatus.PAST_DUE;
    if (gracePeriodEndDate) {
      this.gracePeriodEndDate = gracePeriodEndDate;
    }
    this.touch();
  }

  /**
   * 記錄扣款成功
   */
  public recordSuccessfulBilling(): void {
    this.lastSuccessfulBillingDate = new Date();
    this.consecutiveFailures = 0;
    this.gracePeriodEndDate = undefined;
    if (this.status === SubscriptionStatus.PAST_DUE) {
      this.status = SubscriptionStatus.ACTIVE;
    }
    this.touch();
  }

  /**
   * 記錄扣款失敗
   */
  public recordFailedBilling(): void {
    this.lastFailedBillingDate = new Date();
    this.consecutiveFailures += 1;
    this.touch();
  }

  /**
   * 更新計費週期
   */
  public updateBillingPeriod(periodStart: Date, periodEnd: Date, nextBillingDate: Date): void {
    this.currentPeriodStart = periodStart;
    this.currentPeriodEnd = periodEnd;
    this.nextBillingDate = nextBillingDate;
    this.touch();
  }

  /**
   * 更新支付方式
   */
  public updatePaymentMethod(paymentMethodId: string): void {
    this.paymentMethodId = paymentMethodId;
    this.touch();
  }

  /**
   * 更新訂閱金額
   */
  public updateAmount(amount: number): void {
    this.amount = amount;
    this.touch();
  }

  /**
   * 設定試用期
   */
  public setTrialPeriod(trialEndDate: Date): void {
    this.trialEndDate = trialEndDate;
    this.touch();
  }

  /**
   * 結束試用期
   */
  public endTrial(): void {
    this.trialEndDate = new Date();
    this.touch();
  }

  /**
   * 更新元資料
   */
  public updateMetadata(metadata: Record<string, any>): void {
    this.metadata = { ...this.metadata, ...metadata };
    this.touch();
  }

  /**
   * 檢查是否需要計費
   */
  public needsBilling(): boolean {
    if (!this.isActive()) return false;
    if (this.isInTrial()) return false;
    return new Date() >= this.nextBillingDate;
  }

  /**
   * 計算下次計費日期
   */
  public calculateNextBillingDate(): Date {
    const currentDate = this.nextBillingDate || new Date();

    switch (this.billingCycle) {
      case BillingCycle.DAILY:
        return new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);

      case BillingCycle.WEEKLY:
        return new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000);

      case BillingCycle.MONTHLY:
        const nextMonth = new Date(currentDate);
        nextMonth.setMonth(currentDate.getMonth() + 1);
        return nextMonth;

      case BillingCycle.QUARTERLY:
        const nextQuarter = new Date(currentDate);
        nextQuarter.setMonth(currentDate.getMonth() + 3);
        return nextQuarter;

      case BillingCycle.YEARLY:
        const nextYear = new Date(currentDate);
        nextYear.setFullYear(currentDate.getFullYear() + 1);
        return nextYear;

      default:
        return new Date(currentDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 預設 30 天
    }
  }
}
