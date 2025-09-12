import { Injectable } from '@nestjs/common';
import { BillingCycleStrategy } from '../interfaces/billing-cycle-strategy.interface';
import { DateCalculationService } from '../../date-calculation/date-calculation.service';
import { IBillingCycleConfig, DateAdjustmentType } from '../../date-calculation/interfaces/date-calculation.interface';

@Injectable()
export class MonthlyBillingStrategy implements BillingCycleStrategy {
  constructor(private readonly dateCalculationService: DateCalculationService) {}

  calculateNextBillingDate(
    currentDate: Date,
    config: IBillingCycleConfig,
  ): Date {
    const nextMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + config.interval,
      config.dayOfMonth || currentDate.getDate(),
    );

    // Handle cases where the target day doesn't exist in the target month
    if (config.dayOfMonth && nextMonth.getDate() !== config.dayOfMonth) {
      // The day was adjusted (e.g., Feb 31 -> Feb 28), set to last day of month
      nextMonth.setDate(0); // Go to last day of previous month
      nextMonth.setMonth(nextMonth.getMonth() + 1); // Then to last day of target month
    }

    // Apply any date adjustments
    if (config.adjustment && config.adjustment !== DateAdjustmentType.NONE) {
      return this.dateCalculationService.adjustDate(nextMonth, config.adjustment);
    }

    return nextMonth;
  }

  validateConfig(config: IBillingCycleConfig): boolean {
    if (config.interval < 1) {
      return false;
    }

    if (config.dayOfMonth && (config.dayOfMonth < 1 || config.dayOfMonth > 31)) {
      return false;
    }

    return true;
  }
}