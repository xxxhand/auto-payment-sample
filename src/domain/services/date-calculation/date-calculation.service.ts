import { Injectable } from '@nestjs/common';
import {
  BillingCycleType,
  DateAdjustmentType,
  IBillingCycleConfig,
  ITrialPeriodConfig,
  INextBillingDateResult,
  IBillingPeriodResult,
  IProratedAmountResult,
  IDateCalculationOptions,
  IDateCalculationService,
} from './interfaces/date-calculation.interface';

@Injectable()
export class DateCalculationService implements IDateCalculationService {
  /**
   * 計算下個帳單日期
   */
  calculateNextBillingDate(currentDate: Date, lastBillingDate: Date, config: IBillingCycleConfig, options?: IDateCalculationOptions): INextBillingDateResult {
    try {
      const current = new Date(currentDate);
      const lastBilling = new Date(lastBillingDate);

      let nextBillingDate: Date;
      let cycleNumber = 1;

      switch (config.type) {
        case BillingCycleType.DAILY:
          nextBillingDate = this.addDays(lastBilling, config.interval);
          cycleNumber = Math.floor((current.getTime() - lastBilling.getTime()) / (1000 * 60 * 60 * 24 * config.interval)) + 1;
          break;

        case BillingCycleType.WEEKLY:
          nextBillingDate = this.addDays(lastBilling, config.interval * 7);
          cycleNumber = Math.floor((current.getTime() - lastBilling.getTime()) / (1000 * 60 * 60 * 24 * 7 * config.interval)) + 1;
          break;

        case BillingCycleType.MONTHLY:
          if (config.dayOfMonth) {
            // If specific day of month is configured, calculate next occurrence of that day
            let targetYear = current.getFullYear();
            let targetMonth = current.getMonth();

            // Create candidate date in current month
            let candidateDate = new Date(targetYear, targetMonth, Math.min(config.dayOfMonth, new Date(targetYear, targetMonth + 1, 0).getDate()));

            // If candidate date has passed or is today, move to next month
            if (candidateDate <= current) {
              targetMonth += config.interval;
              while (targetMonth >= 12) {
                targetYear++;
                targetMonth -= 12;
              }
              candidateDate = new Date(targetYear, targetMonth, Math.min(config.dayOfMonth, new Date(targetYear, targetMonth + 1, 0).getDate()));
            }

            nextBillingDate = candidateDate;
          } else {
            // Standard monthly increment from last billing date
            nextBillingDate = this.addMonths(lastBilling, config.interval);
          }
          cycleNumber = this.calculateMonthlyBillingCycle(lastBilling, current, config.interval);
          break;

        case BillingCycleType.QUARTERLY:
          nextBillingDate = this.addMonths(lastBilling, config.interval * 3);
          cycleNumber = Math.floor((current.getFullYear() - lastBilling.getFullYear()) * 4 + (current.getMonth() - lastBilling.getMonth()) / 3) + 1;
          break;

        case BillingCycleType.ANNUALLY:
          nextBillingDate = this.addYears(lastBilling, config.interval);
          // Ensure we advance to next billing cycle if current date is past last billing
          while (nextBillingDate <= current) {
            nextBillingDate = this.addYears(nextBillingDate, config.interval);
          }
          cycleNumber = Math.floor((current.getFullYear() - lastBilling.getFullYear()) / config.interval) + 1;
          break;

        default:
          throw new Error(`Unsupported billing cycle type: ${config.type}`);
      }

      // 應用日期調整
      if (config.adjustment) {
        nextBillingDate = this.adjustDate(nextBillingDate, config.adjustment, options);
      }

      // 計算天數差異
      const daysUntilBilling = Math.ceil((nextBillingDate.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));

      // 檢查是否需要按比例計費
      const isProrated = this.shouldProrateByConfig(config, lastBilling, nextBillingDate, current);
      const proratedDays = isProrated ? this.calculateProratedDays(lastBilling, nextBillingDate, current, config) : 0;

      return {
        nextBillingDate,
        daysUntilBilling,
        cycleNumber,
        isOverdue: daysUntilBilling < 0,
        isProrated,
        proratedDays,
      };
    } catch (error) {
      throw new Error(`Failed to calculate next billing date: ${error.message}`);
    }
  }

  /**
   * 計算免費試用期結束日期
   */
  calculateTrialEndDate(startDate: Date, config: ITrialPeriodConfig): Date {
    try {
      const start = new Date(startDate);
      let endDate: Date;

      switch (config.unit) {
        case 'DAYS':
          endDate = this.addDays(start, config.duration);
          break;
        case 'WEEKS':
          endDate = this.addDays(start, config.duration * 7);
          break;
        case 'MONTHS':
          endDate = this.addMonths(start, config.duration);
          break;
        default:
          throw new Error(`Unsupported trial period unit: ${config.unit}`);
      }

      if (!config.includeStartDate) {
        endDate = this.addDays(endDate, -1);
      }

      if (config.businessDaysOnly) {
        endDate = this.adjustToBusinessDays(start, config.duration);
      }

      return endDate;
    } catch (error) {
      throw new Error(`Failed to calculate trial end date: ${error.message}`);
    }
  }

  /**
   * 計算帳單週期
   */
  calculateBillingPeriod(billingDate: Date, config: IBillingCycleConfig): IBillingPeriodResult {
    try {
      const billing = new Date(billingDate);
      let periodStart: Date;
      let periodEnd: Date;

      switch (config.type) {
        case BillingCycleType.DAILY:
          periodStart = new Date(billing);
          periodEnd = new Date(billing); // For daily billing, period is the same day
          break;

        case BillingCycleType.WEEKLY:
          periodStart = new Date(billing);
          periodEnd = this.addDays(billing, 7 * config.interval - 1);
          break;

        case BillingCycleType.MONTHLY:
          periodStart = new Date(billing);
          periodEnd = this.addMonths(billing, config.interval);
          periodEnd = this.addDays(periodEnd, -1);
          break;

        case BillingCycleType.QUARTERLY:
          periodStart = new Date(billing);
          periodEnd = this.addMonths(billing, 3 * config.interval);
          periodEnd = this.addDays(periodEnd, -1);
          break;

        case BillingCycleType.ANNUALLY:
          periodStart = new Date(billing);
          periodEnd = this.addYears(billing, config.interval);
          periodEnd = this.addDays(periodEnd, -1);
          break;

        default:
          throw new Error(`Unsupported billing cycle type: ${config.type}`);
      }

      const dayCount = this.calculateDaysBetween(periodStart, periodEnd);
      const isPartialPeriod = config.type !== BillingCycleType.DAILY && this.isPartialBillingPeriod(periodStart, periodEnd, config);

      return {
        periodStart,
        periodEnd,
        billingDate: billing,
        dayCount,
        isPartialPeriod,
        proratedRatio: isPartialPeriod ? this.calculateProratedRatio(periodStart, periodEnd, billing) : undefined,
      };
    } catch (error) {
      throw new Error(`Failed to calculate billing period: ${error.message}`);
    }
  }

  /**
   * 計算按比例計費金額
   */
  calculateProratedAmount(fullAmount: number, periodStart: Date, periodEnd: Date, usageStart: Date, usageEnd: Date): IProratedAmountResult {
    try {
      const actualStart = new Date(Math.max(periodStart.getTime(), usageStart.getTime()));
      const actualEnd = new Date(Math.min(periodEnd.getTime(), usageEnd.getTime()));

      if (actualStart > actualEnd) {
        return {
          proratedAmount: 0,
          totalDays: this.calculateDaysBetween(periodStart, periodEnd),
          usedDays: 0,
          ratio: 0,
        };
      }

      const totalDays = this.calculateDaysBetween(periodStart, periodEnd);
      const usedDays = this.calculateDaysBetween(actualStart, actualEnd);
      const ratio = totalDays > 0 ? usedDays / totalDays : 0;
      const proratedAmount = fullAmount * ratio;

      return {
        proratedAmount: Math.round(proratedAmount * 100) / 100,
        totalDays,
        usedDays,
        ratio,
      };
    } catch (error) {
      throw new Error(`Failed to calculate prorated amount: ${error.message}`);
    }
  }

  /**
   * 計算營業日數量
   */
  calculateBusinessDays(startDate: Date, endDate: Date, options?: IDateCalculationOptions): number {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      let businessDays = 0;

      const current = new Date(start);
      while (current <= end) {
        if (this.isBusinessDay(current, options)) {
          businessDays++;
        }
        current.setDate(current.getDate() + 1);
      }

      return businessDays;
    } catch (error) {
      throw new Error(`Failed to calculate business days: ${error.message}`);
    }
  }

  /**
   * 調整日期
   */
  adjustDate(date: Date, adjustmentType: DateAdjustmentType, options?: IDateCalculationOptions): Date {
    try {
      const adjustedDate = new Date(date);

      switch (adjustmentType) {
        case DateAdjustmentType.NONE:
          return adjustedDate;

        case DateAdjustmentType.BUSINESS_DAY:
          return this.getNextBusinessDay(adjustedDate, options);

        case DateAdjustmentType.MONTH_END:
          return this.getMonthEnd(adjustedDate);

        case DateAdjustmentType.MONTH_START:
          return this.getMonthStart(adjustedDate);

        case DateAdjustmentType.WEEKEND_SKIP:
          return this.skipWeekend(adjustedDate);

        default:
          throw new Error(`Unsupported date adjustment type: ${adjustmentType}`);
      }
    } catch (error) {
      throw new Error(`Failed to adjust date: ${error.message}`);
    }
  }

  /**
   * 檢查是否為營業日
   */
  isBusinessDay(date: Date, options?: IDateCalculationOptions): boolean {
    const day = date.getDay();

    if (day === 0) {
      // Sunday
      return false;
    }
    if (day === 6) {
      // Saturday
      return false;
    }

    if (options?.excludeHolidays && this.isHoliday(date, options)) {
      return false;
    }

    return true;
  }

  /**
   * 檢查是否為假期
   */
  isHoliday(date: Date, options?: IDateCalculationOptions): boolean {
    if (!options?.holidayList || options.holidayList.length === 0) {
      return false;
    }

    return options.holidayList.some((holiday) => holiday.getFullYear() === date.getFullYear() && holiday.getMonth() === date.getMonth() && holiday.getDate() === date.getDate());
  }

  /**
   * 生成日期序列
   */
  generateDateSequence(startDate: Date, endDate: Date, config: IBillingCycleConfig, options?: IDateCalculationOptions): Date[] {
    try {
      const dates: Date[] = [];
      let current = new Date(startDate);
      const end = new Date(endDate);

      while (current <= end) {
        let nextDate = new Date(current);

        if (config.adjustment) {
          nextDate = this.adjustDate(nextDate, config.adjustment, options);
        }

        dates.push(nextDate);

        switch (config.type) {
          case BillingCycleType.DAILY:
            current = this.addDays(current, config.interval);
            break;
          case BillingCycleType.WEEKLY:
            current = this.addDays(current, config.interval * 7);
            break;
          case BillingCycleType.MONTHLY:
            current = this.addMonths(current, config.interval);
            break;
          case BillingCycleType.QUARTERLY:
            current = this.addMonths(current, config.interval * 3);
            break;
          case BillingCycleType.ANNUALLY:
            current = this.addYears(current, config.interval);
            break;
          default:
            throw new Error(`Unsupported billing cycle type: ${config.type}`);
        }
      }

      return dates;
    } catch (error) {
      throw new Error(`Failed to generate date sequence: ${error.message}`);
    }
  }

  /**
   * 獲取下一個營業日
   */
  getNextBusinessDay(date: Date, options?: IDateCalculationOptions): Date {
    let nextDay = this.addDays(date, 1);

    while (!this.isBusinessDay(nextDay, options)) {
      nextDay = this.addDays(nextDay, 1);
    }

    return nextDay;
  }

  /**
   * 獲取上一個營業日
   */
  getPreviousBusinessDay(date: Date, options?: IDateCalculationOptions): Date {
    let previousDay = this.addDays(date, -1);

    while (!this.isBusinessDay(previousDay, options)) {
      previousDay = this.addDays(previousDay, -1);
    }

    return previousDay;
  }

  /**
   * 格式化日期到指定時區
   */
  formatDateInTimezone(date: Date): string {
    // TODO: Implement timezone formatting
    return date.toISOString().split('T')[0];
  }

  /**
   * 解析時區日期字符串
   */
  parseDateInTimezone(dateString: string): Date {
    return new Date(dateString);
  }

  // 私有輔助方法

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    const originalDay = date.getDate();
    const targetMonth = result.getMonth() + months;
    const targetYear = result.getFullYear() + Math.floor(targetMonth / 12);
    const finalMonth = targetMonth >= 0 ? targetMonth % 12 : 12 + (targetMonth % 12);

    result.setFullYear(targetYear);
    result.setMonth(finalMonth);

    // Get the last day of the target month
    const lastDayOfMonth = new Date(targetYear, finalMonth + 1, 0).getDate();

    // Set the day, adjusting for months with fewer days
    const targetDay = Math.min(originalDay, lastDayOfMonth);
    result.setDate(targetDay);

    return result;
  }

  private addYears(date: Date, years: number): Date {
    const originalMonth = date.getMonth();
    const originalDay = date.getDate();
    const originalHours = date.getHours();
    const originalMinutes = date.getMinutes();
    const originalSeconds = date.getSeconds();
    const originalMs = date.getMilliseconds();
    const targetYear = date.getFullYear() + years;

    // Handle leap year edge case first
    if (originalMonth === 1 && originalDay === 29) {
      // This is Feb 29, check if target year is leap year
      const isTargetLeapYear = (targetYear % 4 === 0 && targetYear % 100 !== 0) || targetYear % 400 === 0;
      if (!isTargetLeapYear) {
        // Target year is not leap year, use Feb 28
        const result = new Date(targetYear, 1, 28, originalHours, originalMinutes, originalSeconds, originalMs);
        return result;
      }
    }

    // For normal dates, just set the year
    const result = new Date(targetYear, originalMonth, originalDay, originalHours, originalMinutes, originalSeconds, originalMs);
    return result;
  }

  private setDayOfMonth(date: Date, dayOfMonth: number): Date {
    const result = new Date(date);
    const lastDayOfMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();

    const targetDay = Math.min(dayOfMonth, lastDayOfMonth);
    result.setDate(targetDay);

    return result;
  }

  private calculateMonthlyBillingCycle(lastBilling: Date, current: Date, interval: number): number {
    const monthsDiff = (current.getFullYear() - lastBilling.getFullYear()) * 12 + (current.getMonth() - lastBilling.getMonth());
    return Math.floor(monthsDiff / interval) + 1;
  }

  private shouldProrateByConfig(config: IBillingCycleConfig, lastBilling: Date, nextBilling: Date, current: Date): boolean {
    if (config.type === BillingCycleType.MONTHLY && config.dayOfMonth) {
      return current.getDate() !== config.dayOfMonth;
    }
    return false;
  }

  private calculateProratedDays(lastBillingDate: Date, nextBillingDate: Date, currentDate: Date, config: IBillingCycleConfig): number {
    const billingPeriod = this.calculateBillingPeriod(lastBillingDate, config);
    const usagePeriod = this.calculateBillingPeriod(currentDate, config);

    const start = new Date(Math.max(billingPeriod.periodStart.getTime(), usagePeriod.periodStart.getTime()));
    const end = new Date(Math.min(billingPeriod.periodEnd.getTime(), usagePeriod.periodEnd.getTime()));

    return this.calculateDaysBetween(start, end);
  }

  private adjustToBusinessDays(date: Date, days: number): Date {
    const result = new Date(date);

    for (let i = 0; i < days; i++) {
      result.setDate(result.getDate() + 1);

      // 如果這一天不是營業日，繼續添加天數直到找到營業日
      while (!this.isBusinessDay(result)) {
        result.setDate(result.getDate() + 1);
      }
    }

    return result;
  }

  private isPartialBillingPeriod(start: Date, end: Date, config: IBillingCycleConfig): boolean {
    const expectedDays = this.getExpectedPeriodDays(config);
    const actualDays = this.calculateDaysBetween(start, end);

    return actualDays !== expectedDays;
  }

  private calculateProratedRatio(periodStart: Date, periodEnd: Date, billingDate: Date): number {
    const totalDays = this.calculateDaysBetween(periodStart, periodEnd);
    const usedDays = this.calculateDaysBetween(periodStart, billingDate);

    return totalDays > 0 ? usedDays / totalDays : 0;
  }

  private getExpectedPeriodDays(config: IBillingCycleConfig): number {
    switch (config.type) {
      case BillingCycleType.DAILY:
        return 1;
      case BillingCycleType.WEEKLY:
        return 7 * config.interval;
      case BillingCycleType.MONTHLY:
        return 30 * config.interval;
      case BillingCycleType.QUARTERLY:
        return 90 * config.interval;
      case BillingCycleType.ANNUALLY:
        return 365 * config.interval;
      default:
        return 30;
    }
  }

  private calculateDaysBetween(startDate: Date, endDate: Date): number {
    const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

    if (start.getTime() === end.getTime()) {
      return 1; // Same day should count as 1 day
    }

    if (start > end) {
      return 0; // Invalid range
    }

    const diffTime = end.getTime() - start.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; // Include both start and end dates
  }

  private getMonthEnd(date: Date): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + 1, 0);
    return result;
  }

  private getMonthStart(date: Date): Date {
    const result = new Date(date);
    result.setDate(1);
    return result;
  }

  private skipWeekend(date: Date): Date {
    const day = date.getDay();
    if (day === 0) {
      // Sunday
      return this.addDays(date, 1);
    }
    if (day === 6) {
      // Saturday
      return this.addDays(date, 2);
    }
    return new Date(date);
  }
}
