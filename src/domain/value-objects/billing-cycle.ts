import { BillingCycle } from '../enums/codes.const';

/**
 * 計費週期值物件
 * 封裝計費週期的計算邏輯
 */
export class BillingCycleVO {
  private readonly _type: BillingCycle;
  private readonly _intervalDays?: number;
  private readonly _billingDay?: number; // 計費日 (1-31)

  constructor(type: BillingCycle, intervalDays?: number, billingDay?: number) {
    this._type = type;
    this._intervalDays = intervalDays;
    this._billingDay = billingDay;

    this.validate();
  }

  get type(): BillingCycle {
    return this._type;
  }

  get intervalDays(): number | undefined {
    return this._intervalDays;
  }

  get billingDay(): number | undefined {
    return this._billingDay;
  }

  /**
   * 取得顯示名稱（向後兼容）
   */
  get displayName(): string {
    return this.getDescription();
  }

  /**
   * 計算下一個計費日期
   */
  calculateNextBillingDate(fromDate: Date = new Date()): Date {
    const nextDate = new Date(fromDate);

    switch (this._type) {
      case BillingCycle.DAILY:
        nextDate.setDate(nextDate.getDate() + 1);
        break;

      case BillingCycle.WEEKLY:
        nextDate.setDate(nextDate.getDate() + 7);
        break;

      case BillingCycle.MONTHLY:
        if (this._billingDay) {
          nextDate.setMonth(nextDate.getMonth() + 1);
          nextDate.setDate(Math.min(this._billingDay, this.getLastDayOfMonth(nextDate)));
        } else {
          nextDate.setMonth(nextDate.getMonth() + 1);
        }
        break;

      case BillingCycle.QUARTERLY:
        if (this._billingDay) {
          nextDate.setMonth(nextDate.getMonth() + 3);
          nextDate.setDate(Math.min(this._billingDay, this.getLastDayOfMonth(nextDate)));
        } else {
          nextDate.setMonth(nextDate.getMonth() + 3);
        }
        break;

      case BillingCycle.YEARLY:
        if (this._billingDay) {
          nextDate.setFullYear(nextDate.getFullYear() + 1);
          nextDate.setDate(Math.min(this._billingDay, this.getLastDayOfMonth(nextDate)));
        } else {
          nextDate.setFullYear(nextDate.getFullYear() + 1);
        }
        break;

      default:
        if (this._intervalDays) {
          nextDate.setDate(nextDate.getDate() + this._intervalDays);
        } else {
          throw new Error(`Unsupported billing cycle: ${this._type}`);
        }
    }

    return nextDate;
  }

  /**
   * 計算計費期間
   */
  calculateBillingPeriod(startDate: Date): { startDate: Date; endDate: Date } {
    const endDate = new Date(this.calculateNextBillingDate(startDate));
    endDate.setDate(endDate.getDate() - 1); // 結束日期是下次計費日的前一天

    return {
      startDate: new Date(startDate),
      endDate,
    };
  }

  /**
   * 計算按比例費用（升級/降級）
   */
  calculateProration(fromDate: Date, toDate: Date, fullCycleAmount: number): number {
    const totalDays = this.getTotalCycleDays();
    const usedDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));

    return Math.round((fullCycleAmount * usedDays) / totalDays);
  }

  /**
   * 取得週期總天數
   */
  getTotalCycleDays(): number {
    switch (this._type) {
      case BillingCycle.DAILY:
        return 1;
      case BillingCycle.WEEKLY:
        return 7;
      case BillingCycle.MONTHLY:
        return 30; // 平均天數
      case BillingCycle.QUARTERLY:
        return 90; // 平均天數
      case BillingCycle.YEARLY:
        return 365; // 平均天數
      default:
        return this._intervalDays || 30;
    }
  }

  /**
   * 取得週期描述
   */
  getDescription(): string {
    switch (this._type) {
      case BillingCycle.DAILY:
        return '每日';
      case BillingCycle.WEEKLY:
        return '每週';
      case BillingCycle.MONTHLY:
        return this._billingDay ? `每月 ${this._billingDay} 日` : '每月';
      case BillingCycle.QUARTERLY:
        return this._billingDay ? `每季 ${this._billingDay} 日` : '每季';
      case BillingCycle.YEARLY:
        return this._billingDay ? `每年 ${this._billingDay} 日` : '每年';
      default:
        return `每 ${this._intervalDays} 天`;
    }
  }

  /**
   * 檢查是否相等
   */
  equals(other: BillingCycleVO): boolean {
    return this._type === other._type && this._intervalDays === other._intervalDays && this._billingDay === other._billingDay;
  }

  /**
   * 轉換為JSON
   */
  toJSON() {
    return {
      type: this._type,
      intervalDays: this._intervalDays,
      billingDay: this._billingDay,
      description: this.getDescription(),
    };
  }

  /**
   * 從JSON創建
   */
  static fromJSON(data: any): BillingCycleVO {
    return new BillingCycleVO(data.type, data.intervalDays, data.billingDay);
  }

  /**
   * 從字串創建計費週期 (向後兼容)
   */
  static fromString(billingCycle: string): BillingCycleVO {
    switch (billingCycle.toLowerCase()) {
      case 'daily':
        return new BillingCycleVO(BillingCycle.DAILY);
      case 'weekly':
        return new BillingCycleVO(BillingCycle.WEEKLY);
      case 'monthly':
        return new BillingCycleVO(BillingCycle.MONTHLY);
      case 'yearly':
        return new BillingCycleVO(BillingCycle.YEARLY);
      default:
        return new BillingCycleVO(BillingCycle.MONTHLY);
    }
  }

  /**
   * 創建月度計費週期
   */
  static monthly(billingDay?: number): BillingCycleVO {
    return new BillingCycleVO(BillingCycle.MONTHLY, undefined, billingDay);
  }

  /**
   * 創建年度計費週期
   */
  static yearly(billingDay?: number): BillingCycleVO {
    return new BillingCycleVO(BillingCycle.YEARLY, undefined, billingDay);
  }

  /**
   * 創建自定義週期
   */
  static custom(intervalDays: number): BillingCycleVO {
    return new BillingCycleVO(BillingCycle.DAILY, intervalDays);
  }

  /**
   * 驗證參數有效性
   */
  private validate(): void {
    if (this._billingDay && (this._billingDay < 1 || this._billingDay > 31)) {
      throw new Error('Billing day must be between 1 and 31');
    }

    if (this._intervalDays && this._intervalDays < 1) {
      throw new Error('Interval days must be positive');
    }
  }

  /**
   * 取得月份最後一天
   */
  private getLastDayOfMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }
}

/**
 * 計費期間值物件
 */
export class BillingPeriod {
  private readonly _startDate: Date;
  private readonly _endDate: Date;
  private readonly _cycleNumber: number;

  constructor(startDate: Date, endDate: Date, cycleNumber: number = 1) {
    if (startDate >= endDate) {
      throw new Error('Start date must be before end date');
    }
    this._startDate = new Date(startDate);
    this._endDate = new Date(endDate);
    this._cycleNumber = cycleNumber;
  }

  get startDate(): Date {
    return new Date(this._startDate);
  }

  get endDate(): Date {
    return new Date(this._endDate);
  }

  get cycleNumber(): number {
    return this._cycleNumber;
  }

  /**
   * 檢查日期是否在期間內
   */
  contains(date: Date): boolean {
    return date >= this._startDate && date <= this._endDate;
  }

  /**
   * 取得期間長度（天數）
   */
  getDurationInDays(): number {
    const diffTime = this._endDate.getTime() - this._startDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * 取得剩餘天數
   */
  getRemainingDays(fromDate: Date = new Date()): number {
    if (fromDate > this._endDate) return 0;
    if (fromDate < this._startDate) return this.getDurationInDays();

    const diffTime = this._endDate.getTime() - fromDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * 檢查是否已過期
   */
  isExpired(checkDate: Date = new Date()): boolean {
    return checkDate > this._endDate;
  }

  /**
   * 檢查是否即將到期
   */
  isExpiringSoon(daysThreshold: number = 3, checkDate: Date = new Date()): boolean {
    const remainingDays = this.getRemainingDays(checkDate);
    return remainingDays <= daysThreshold && remainingDays > 0;
  }

  /**
   * 轉換為JSON
   */
  toJSON() {
    return {
      startDate: this._startDate.toISOString(),
      endDate: this._endDate.toISOString(),
      cycleNumber: this._cycleNumber,
      durationInDays: this.getDurationInDays(),
    };
  }

  /**
   * 從JSON創建
   */
  static fromJSON(data: any): BillingPeriod {
    return new BillingPeriod(new Date(data.startDate), new Date(data.endDate), data.cycleNumber);
  }
}
