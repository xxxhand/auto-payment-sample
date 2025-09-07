/**
 * 日期計算服務介面
 * 處理訂閱系統中的複雜日期計算邏輯
 */

/**
 * 計費週期類型
 */
export enum BillingCycleType {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  SEMI_ANNUALLY = 'SEMI_ANNUALLY',
  ANNUALLY = 'ANNUALLY',
  CUSTOM = 'CUSTOM',
}

/**
 * 日期調整選項
 */
export enum DateAdjustmentType {
  NONE = 'NONE',
  BUSINESS_DAY = 'BUSINESS_DAY', // 調整到營業日
  MONTH_END = 'MONTH_END', // 調整到月末
  MONTH_START = 'MONTH_START', // 調整到月初
  WEEKEND_SKIP = 'WEEKEND_SKIP', // 跳過週末
}

/**
 * 計費週期配置
 */
export interface IBillingCycleConfig {
  type: BillingCycleType;
  interval: number; // 間隔數量 (如每2個月)
  dayOfMonth?: number; // 月份中的第幾天 (1-31)
  dayOfWeek?: number; // 週幾 (0=Sunday, 1=Monday, etc.)
  adjustment?: DateAdjustmentType; // 日期調整類型
  timezone?: string; // 時區
}

/**
 * 免費試用期配置
 */
export interface ITrialPeriodConfig {
  duration: number; // 試用期長度
  unit: 'DAYS' | 'WEEKS' | 'MONTHS'; // 試用期單位
  includeStartDate: boolean; // 是否包含開始日期
  businessDaysOnly?: boolean; // 是否只計算營業日
}

/**
 * 日期範圍
 */
export interface IDateRange {
  startDate: Date;
  endDate: Date;
}

/**
 * 計費週期結果
 */
export interface IBillingPeriodResult {
  periodStart: Date;
  periodEnd: Date;
  billingDate: Date;
  dayCount: number;
  isPartialPeriod: boolean; // 是否為部分週期
  proratedRatio?: number; // 按比例計費比率
}

/**
 * 按比例計費金額結果
 */
export interface IProratedAmountResult {
  proratedAmount: number; // 按比例計費金額
  totalDays: number; // 總天數
  usedDays: number; // 使用天數
  ratio: number; // 使用比例 (0-1)
}

/**
 * 下個帳單日期結果
 */
export interface INextBillingDateResult {
  nextBillingDate: Date;
  daysUntilBilling: number;
  cycleNumber: number;
  isOverdue: boolean; // 是否已逾期
  isProrated: boolean; // 是否按比例計費
  proratedDays: number; // 按比例計費天數
}

/**
 * 帳單週期資訊
 */
export interface IBillingPeriodInfo {
  periodStart: Date;
  periodEnd: Date;
  billingDate: Date;
  dayCount: number;
  isPartialPeriod: boolean; // 是否為部分週期
  proratedRatio?: number; // 按比例計費比率
}

/**
 * 日期計算選項
 */
export interface IDateCalculationOptions {
  timezone?: string;
  businessDaysOnly?: boolean;
  excludeHolidays?: boolean;
  holidayList?: Date[];
  adjustToBusinessDay?: boolean;
}

/**
 * 日期計算服務介面
 */
export interface IDateCalculationService {
  /**
   * 計算下個帳單日期
   */
  calculateNextBillingDate(currentDate: Date, lastBillingDate: Date, config: IBillingCycleConfig, options?: IDateCalculationOptions): INextBillingDateResult;

  /**
   * 計算免費試用期結束日期
   */
  calculateTrialEndDate(startDate: Date, config: ITrialPeriodConfig, options?: IDateCalculationOptions): Date;

  /**
   * 計算帳單週期資訊
   */
  calculateBillingPeriod(billingDate: Date, config: IBillingCycleConfig): IBillingPeriodResult;

  /**
   * 計算按比例計費金額
   */
  calculateProratedAmount(
    fullAmount: number,
    periodStart: Date,
    periodEnd: Date,
    usageStart: Date,
    usageEnd: Date,
  ): {
    proratedAmount: number;
    usedDays: number;
    totalDays: number;
    ratio: number;
  };

  /**
   * 計算兩個日期之間的營業日數
   */
  calculateBusinessDays(startDate: Date, endDate: Date, options?: IDateCalculationOptions): number;

  /**
   * 調整日期到指定類型
   */
  adjustDate(date: Date, adjustmentType: DateAdjustmentType, options?: IDateCalculationOptions): Date;

  /**
   * 檢查日期是否為營業日
   */
  isBusinessDay(date: Date, options?: IDateCalculationOptions): boolean;

  /**
   * 檢查日期是否為假日
   */
  isHoliday(date: Date, options?: IDateCalculationOptions): boolean;

  /**
   * 計算日期序列 (如連續的帳單日期)
   */
  generateDateSequence(startDate: Date, endDate: Date, config: IBillingCycleConfig, options?: IDateCalculationOptions): Date[];

  /**
   * 計算下個營業日
   */
  getNextBusinessDay(date: Date, options?: IDateCalculationOptions): Date;

  /**
   * 計算上個營業日
   */
  getPreviousBusinessDay(date: Date, options?: IDateCalculationOptions): Date;

  /**
   * 格式化日期為指定時區
   */
  formatDateInTimezone(date: Date): string;

  /**
   * 解析不同時區的日期
   */
  parseDateInTimezone(dateString: string): Date;
}
