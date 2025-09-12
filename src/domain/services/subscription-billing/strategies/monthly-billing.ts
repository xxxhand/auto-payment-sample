import { Injectable } from '@angular/core';
import { IDateCalculationOptions, IBillingCycleConfig } from './billing.interfaces';
import { DateCalculationService } from './date-calculation.service';

@Injectable({
  providedIn: 'root',
})
export class MonthlyBillingService {
  constructor(private dateCalculationService: DateCalculationService) {}

  /**
   * 計算月費下次帳單日期
   */
  calculateNextBillingDate(
    currentDate: Date,
    config: IBillingCycleConfig,
    dateCalculationOptions?: IDateCalculationOptions,
  ): Date {
    try {
      let nextBillingDate = new Date(currentDate);
      nextBillingDate.setMonth(nextBillingDate.getMonth() + config.interval);

      // 調整日期到指定的日期
      if (config.dayOfMonth && config.dayOfMonth > 0) {
        const daysInMonth = new Date(
          nextBillingDate.getFullYear(),
          nextBillingDate.getMonth() + 1,
          0,
        ).getDate();
        const targetDay = Math.min(config.dayOfMonth, daysInMonth);
        nextBillingDate.setDate(targetDay);
      }

      // 應用日期調整
      if (config.adjustmentType) {
        nextBillingDate = this.dateCalculationService.adjustDate(
          nextBillingDate,
          config.adjustmentType,
          dateCalculationOptions,
        );
      }

      return nextBillingDate;
    } catch (error) {
      throw new Error(`Failed to calculate next billing date: ${error.message}`);
    }
  }
}