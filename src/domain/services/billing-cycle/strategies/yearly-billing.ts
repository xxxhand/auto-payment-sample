import { Injectable } from '@nestjs/common';
import { BillingCycleStrategy } from '../interfaces/billing-cycle-strategy.interface';
import { DateCalculationService } from '../../date-calculation/date-calculation.service';
import { IBillingCycleConfig, DateAdjustmentType } from '../../date-calculation/interfaces/date-calculation.interface';

@Injectable()
export class YearlyBillingStrategy implements BillingCycleStrategy {
  constructor(private readonly dateCalculationService: DateCalculationService) {}

  calculateNextBillingDate(
    currentDate: Date,
    config: IBillingCycleConfig,
  ): Date {
    const nextYear = new Date(
      currentDate.getFullYear() + config.interval,
      config.monthOfYear ? config.monthOfYear - 1 : currentDate.getMonth(),
      config.dayOfMonth || currentDate.getDate(),
    );

    // Handle cases where the target day doesn't exist in the target month
    if (config.dayOfMonth && nextYear.getDate() !== config.dayOfMonth) {
      // The day was adjusted (e.g., Feb 31 -> Feb 28), set to last day of month
      nextYear.setDate(0); // Go to last day of previous month
      nextYear.setMonth(nextYear.getMonth() + 1); // Then to last day of target month
    }

    // Apply any date adjustments
    if (config.adjustment && config.adjustment !== DateAdjustmentType.NONE) {
      return this.dateCalculationService.adjustDate(nextYear, config.adjustment);
    }

    return nextYear;
  }

  validateConfig(config: IBillingCycleConfig): boolean {
    if (config.interval < 1) {
      return false;
    }

    if (config.dayOfMonth && (config.dayOfMonth < 1 || config.dayOfMonth > 31)) {
      return false;
    }

    if (config.monthOfYear && (config.monthOfYear < 1 || config.monthOfYear > 12)) {
      return false;
    }

    return true;
  }
}