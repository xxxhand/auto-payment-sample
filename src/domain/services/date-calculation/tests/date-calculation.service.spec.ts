import { Test, TestingModule } from '@nestjs/testing';
import { DateCalculationService } from '../date-calculation.service';
import { BillingCycleType, DateAdjustmentType, IBillingCycleConfig, ITrialPeriodConfig, IDateCalculationOptions } from '../interfaces/date-calculation.interface';

describe('DateCalculationService', () => {
  let service: DateCalculationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DateCalculationService],
    }).compile();

    service = module.get<DateCalculationService>(DateCalculationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateNextBillingDate', () => {
    it('should calculate next daily billing date', () => {
      const currentDate = new Date('2024-01-15');
      const lastBillingDate = new Date('2024-01-10');
      const config: IBillingCycleConfig = {
        type: BillingCycleType.DAILY,
        interval: 1,
      };

      const result = service.calculateNextBillingDate(currentDate, lastBillingDate, config);

      expect(result.nextBillingDate).toEqual(new Date('2024-01-11'));
      expect(result.cycleNumber).toBe(6); // 15 - 10 + 1
      expect(result.daysUntilBilling).toBeLessThan(0); // 已過期
    });

    it('should calculate next weekly billing date', () => {
      const currentDate = new Date('2024-01-15');
      const lastBillingDate = new Date('2024-01-08');
      const config: IBillingCycleConfig = {
        type: BillingCycleType.WEEKLY,
        interval: 1,
      };

      const result = service.calculateNextBillingDate(currentDate, lastBillingDate, config);

      expect(result.nextBillingDate).toEqual(new Date('2024-01-15'));
      expect(result.daysUntilBilling).toBe(0);
    });

    it('should calculate next monthly billing date', () => {
      const currentDate = new Date('2024-01-15');
      const lastBillingDate = new Date('2024-01-01');
      const config: IBillingCycleConfig = {
        type: BillingCycleType.MONTHLY,
        interval: 1,
      };

      const result = service.calculateNextBillingDate(currentDate, lastBillingDate, config);

      expect(result.nextBillingDate).toEqual(new Date('2024-02-01'));
      expect(result.cycleNumber).toBe(1);
    });

    it('should calculate next monthly billing date with specific day', () => {
      const currentDate = new Date('2024-01-15');
      const lastBillingDate = new Date('2024-01-05');
      const config: IBillingCycleConfig = {
        type: BillingCycleType.MONTHLY,
        interval: 1,
        dayOfMonth: 5,
      };

      const result = service.calculateNextBillingDate(currentDate, lastBillingDate, config);

      expect(result.nextBillingDate.getDate()).toBe(5);
      expect(result.nextBillingDate.getMonth()).toBe(1); // February
    });

    it('should calculate next quarterly billing date', () => {
      const currentDate = new Date('2024-01-15');
      const lastBillingDate = new Date('2024-01-01');
      const config: IBillingCycleConfig = {
        type: BillingCycleType.QUARTERLY,
        interval: 1,
      };

      const result = service.calculateNextBillingDate(currentDate, lastBillingDate, config);

      expect(result.nextBillingDate).toEqual(new Date('2024-04-01'));
    });

    it('should calculate next annual billing date', () => {
      const currentDate = new Date('2024-01-15');
      const lastBillingDate = new Date('2024-01-01');
      const config: IBillingCycleConfig = {
        type: BillingCycleType.ANNUALLY,
        interval: 1,
      };

      const result = service.calculateNextBillingDate(currentDate, lastBillingDate, config);

      expect(result.nextBillingDate).toEqual(new Date('2025-01-01'));
    });

    it('should apply business day adjustment', () => {
      const currentDate = new Date('2024-01-15');
      const lastBillingDate = new Date('2024-01-01');
      const config: IBillingCycleConfig = {
        type: BillingCycleType.MONTHLY,
        interval: 1,
        adjustment: DateAdjustmentType.BUSINESS_DAY,
      };

      const result = service.calculateNextBillingDate(currentDate, lastBillingDate, config);

      // 確保結果是營業日
      expect(service.isBusinessDay(result.nextBillingDate)).toBe(true);
    });

    it('should handle prorated billing', () => {
      const currentDate = new Date('2024-01-15');
      const lastBillingDate = new Date('2024-01-01');
      const config: IBillingCycleConfig = {
        type: BillingCycleType.MONTHLY,
        interval: 1,
        dayOfMonth: 1, // 觸發按比例計費邏輯
      };

      const result = service.calculateNextBillingDate(currentDate, lastBillingDate, config);

      expect(result.isProrated).toBe(true);
      expect(result.proratedDays).toBeGreaterThan(0);
    });
  });

  describe('calculateTrialEndDate', () => {
    it('should calculate trial end date in days', () => {
      const startDate = new Date('2024-01-01');
      const config: ITrialPeriodConfig = {
        duration: 7,
        unit: 'DAYS',
        includeStartDate: true,
      };

      const result = service.calculateTrialEndDate(startDate, config);

      expect(result).toEqual(new Date('2024-01-08'));
    });

    it('should calculate trial end date in weeks', () => {
      const startDate = new Date('2024-01-01');
      const config: ITrialPeriodConfig = {
        duration: 2,
        unit: 'WEEKS',
        includeStartDate: true,
      };

      const result = service.calculateTrialEndDate(startDate, config);

      expect(result).toEqual(new Date('2024-01-15'));
    });

    it('should calculate trial end date in months', () => {
      const startDate = new Date('2024-01-01');
      const config: ITrialPeriodConfig = {
        duration: 1,
        unit: 'MONTHS',
        includeStartDate: true,
      };

      const result = service.calculateTrialEndDate(startDate, config);

      expect(result).toEqual(new Date('2024-02-01'));
    });

    it('should exclude start date when configured', () => {
      const startDate = new Date('2024-01-01');
      const config: ITrialPeriodConfig = {
        duration: 7,
        unit: 'DAYS',
        includeStartDate: false,
      };

      const result = service.calculateTrialEndDate(startDate, config);

      expect(result).toEqual(new Date('2024-01-07'));
    });

    it('should calculate business days only trial', () => {
      const startDate = new Date('2024-01-01'); // Monday
      const config: ITrialPeriodConfig = {
        duration: 5,
        unit: 'DAYS',
        includeStartDate: true,
        businessDaysOnly: true,
      };

      const result = service.calculateTrialEndDate(startDate, config);

      // 5個營業日應該跳過週末
      expect(service.isBusinessDay(result)).toBe(true);
      expect(result.getDay()).not.toBe(0); // Not Sunday
      expect(result.getDay()).not.toBe(6); // Not Saturday
    });
  });

  describe('calculateBillingPeriod', () => {
    it('should calculate daily billing period', () => {
      const billingDate = new Date('2024-01-15');
      const config: IBillingCycleConfig = {
        type: BillingCycleType.DAILY,
        interval: 1,
      };

      const result = service.calculateBillingPeriod(billingDate, config);

      expect(result.periodStart).toEqual(billingDate);
      expect(result.periodEnd).toEqual(billingDate);
      expect(result.dayCount).toBe(1);
      expect(result.isPartialPeriod).toBe(false);
    });

    it('should calculate monthly billing period', () => {
      const billingDate = new Date('2024-01-01');
      const config: IBillingCycleConfig = {
        type: BillingCycleType.MONTHLY,
        interval: 1,
      };

      const result = service.calculateBillingPeriod(billingDate, config);

      expect(result.periodStart).toEqual(new Date('2024-01-01'));
      expect(result.periodEnd).toEqual(new Date('2024-01-31'));
      expect(result.dayCount).toBe(31);
    });

    it('should calculate quarterly billing period', () => {
      const billingDate = new Date('2024-01-01');
      const config: IBillingCycleConfig = {
        type: BillingCycleType.QUARTERLY,
        interval: 1,
      };

      const result = service.calculateBillingPeriod(billingDate, config);

      expect(result.periodStart).toEqual(new Date('2024-01-01'));
      expect(result.periodEnd).toEqual(new Date('2024-03-31'));
      expect(result.dayCount).toBe(91); // Jan(31) + Feb(29) + Mar(31)
    });
  });

  describe('calculateProratedAmount', () => {
    it('should calculate prorated amount for partial usage', () => {
      const fullAmount = 100;
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-01-31'); // 31 days
      const usageStart = new Date('2024-01-15');
      const usageEnd = new Date('2024-01-31'); // 17 days

      const result = service.calculateProratedAmount(fullAmount, periodStart, periodEnd, usageStart, usageEnd);

      expect(result.totalDays).toBe(31);
      expect(result.usedDays).toBe(17);
      expect(result.ratio).toBeCloseTo(17 / 31);
      expect(result.proratedAmount).toBeCloseTo(54.84, 2);
    });

    it('should handle usage period outside billing period', () => {
      const fullAmount = 100;
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-01-31');
      const usageStart = new Date('2023-12-15'); // Before period
      const usageEnd = new Date('2024-02-15'); // After period

      const result = service.calculateProratedAmount(fullAmount, periodStart, periodEnd, usageStart, usageEnd);

      // 使用期間應該被限制在計費週期內
      expect(result.totalDays).toBe(31);
      expect(result.usedDays).toBe(31);
      expect(result.ratio).toBe(1);
      expect(result.proratedAmount).toBe(100);
    });

    it('should handle zero usage days', () => {
      const fullAmount = 100;
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-01-31');
      const usageStart = new Date('2024-02-01'); // After period
      const usageEnd = new Date('2024-02-05');

      const result = service.calculateProratedAmount(fullAmount, periodStart, periodEnd, usageStart, usageEnd);

      expect(result.usedDays).toBe(0);
      expect(result.ratio).toBe(0);
      expect(result.proratedAmount).toBe(0);
    });
  });

  describe('calculateBusinessDays', () => {
    it('should calculate business days excluding weekends', () => {
      const startDate = new Date('2024-01-01'); // Monday
      const endDate = new Date('2024-01-05'); // Friday

      const result = service.calculateBusinessDays(startDate, endDate);

      expect(result).toBe(5); // Mon, Tue, Wed, Thu, Fri
    });

    it('should exclude weekends from business days', () => {
      const startDate = new Date('2024-01-01'); // Monday
      const endDate = new Date('2024-01-07'); // Sunday

      const result = service.calculateBusinessDays(startDate, endDate);

      expect(result).toBe(5); // Excludes Saturday and Sunday
    });

    it('should exclude holidays when configured', () => {
      const startDate = new Date('2024-01-01'); // Monday
      const endDate = new Date('2024-01-05'); // Friday
      const options: IDateCalculationOptions = {
        excludeHolidays: true,
        holidayList: [new Date('2024-01-03')], // Wednesday holiday
      };

      const result = service.calculateBusinessDays(startDate, endDate, options);

      expect(result).toBe(4); // Excludes Wednesday holiday
    });
  });

  describe('adjustDate', () => {
    it('should not adjust date when type is NONE', () => {
      const date = new Date('2024-01-06'); // Saturday
      const result = service.adjustDate(date, DateAdjustmentType.NONE);

      expect(result).toEqual(date);
    });

    it('should adjust to next business day', () => {
      const date = new Date('2024-01-06'); // Saturday
      const result = service.adjustDate(date, DateAdjustmentType.BUSINESS_DAY);

      expect(result.getDay()).toBe(1); // Monday
      expect(result).toEqual(new Date('2024-01-08'));
    });

    it('should adjust to month end', () => {
      const date = new Date('2024-01-15');
      const result = service.adjustDate(date, DateAdjustmentType.MONTH_END);

      expect(result).toEqual(new Date('2024-01-31'));
    });

    it('should adjust to month start', () => {
      const date = new Date('2024-01-15');
      const result = service.adjustDate(date, DateAdjustmentType.MONTH_START);

      expect(result).toEqual(new Date('2024-01-01'));
    });

    it('should skip weekend', () => {
      const saturdayDate = new Date('2024-01-06'); // Saturday
      const sundayDate = new Date('2024-01-07'); // Sunday

      const saturdayResult = service.adjustDate(saturdayDate, DateAdjustmentType.WEEKEND_SKIP);
      const sundayResult = service.adjustDate(sundayDate, DateAdjustmentType.WEEKEND_SKIP);

      expect(saturdayResult).toEqual(new Date('2024-01-08')); // Monday
      expect(sundayResult).toEqual(new Date('2024-01-08')); // Monday
    });
  });

  describe('isBusinessDay', () => {
    it('should return true for weekdays', () => {
      const monday = new Date('2024-01-01');
      const tuesday = new Date('2024-01-02');
      const wednesday = new Date('2024-01-03');
      const thursday = new Date('2024-01-04');
      const friday = new Date('2024-01-05');

      expect(service.isBusinessDay(monday)).toBe(true);
      expect(service.isBusinessDay(tuesday)).toBe(true);
      expect(service.isBusinessDay(wednesday)).toBe(true);
      expect(service.isBusinessDay(thursday)).toBe(true);
      expect(service.isBusinessDay(friday)).toBe(true);
    });

    it('should return false for weekends', () => {
      const saturday = new Date('2024-01-06');
      const sunday = new Date('2024-01-07');

      expect(service.isBusinessDay(saturday)).toBe(false);
      expect(service.isBusinessDay(sunday)).toBe(false);
    });

    it('should return false for holidays when configured', () => {
      const holiday = new Date('2024-01-03'); // Wednesday
      const options: IDateCalculationOptions = {
        excludeHolidays: true,
        holidayList: [holiday],
      };

      expect(service.isBusinessDay(holiday, options)).toBe(false);
    });
  });

  describe('isHoliday', () => {
    it('should return true for dates in holiday list', () => {
      const holiday = new Date('2024-01-01');
      const options: IDateCalculationOptions = {
        holidayList: [holiday],
      };

      expect(service.isHoliday(holiday, options)).toBe(true);
    });

    it('should return false for dates not in holiday list', () => {
      const nonHoliday = new Date('2024-01-02');
      const options: IDateCalculationOptions = {
        holidayList: [new Date('2024-01-01')],
      };

      expect(service.isHoliday(nonHoliday, options)).toBe(false);
    });

    it('should return false when no holiday list provided', () => {
      const date = new Date('2024-01-01');

      expect(service.isHoliday(date)).toBe(false);
    });
  });

  describe('generateDateSequence', () => {
    it('should generate monthly date sequence', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-04-01');
      const config: IBillingCycleConfig = {
        type: BillingCycleType.MONTHLY,
        interval: 1,
      };

      const result = service.generateDateSequence(startDate, endDate, config);

      expect(result).toHaveLength(4);
      expect(result[0]).toEqual(new Date('2024-01-01'));
      expect(result[1]).toEqual(new Date('2024-02-01'));
      expect(result[2]).toEqual(new Date('2024-03-01'));
      expect(result[3]).toEqual(new Date('2024-04-01'));
    });

    it('should generate daily date sequence', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-05');
      const config: IBillingCycleConfig = {
        type: BillingCycleType.DAILY,
        interval: 1,
      };

      const result = service.generateDateSequence(startDate, endDate, config);

      expect(result).toHaveLength(5);
      expect(result[0]).toEqual(new Date('2024-01-01'));
      expect(result[4]).toEqual(new Date('2024-01-05'));
    });
  });

  describe('getNextBusinessDay', () => {
    it('should return next weekday for weekday input', () => {
      const wednesday = new Date('2024-01-03');
      const result = service.getNextBusinessDay(wednesday);

      expect(result).toEqual(new Date('2024-01-04')); // Thursday
    });

    it('should skip weekend and return Monday for Friday input', () => {
      const friday = new Date('2024-01-05');
      const result = service.getNextBusinessDay(friday);

      expect(result).toEqual(new Date('2024-01-08')); // Monday
    });

    it('should skip holidays when configured', () => {
      const thursday = new Date('2024-01-04');
      const options: IDateCalculationOptions = {
        excludeHolidays: true,
        holidayList: [new Date('2024-01-05')], // Friday holiday
      };

      const result = service.getNextBusinessDay(thursday, options);

      expect(result).toEqual(new Date('2024-01-08')); // Monday (skips Friday holiday + weekend)
    });
  });

  describe('getPreviousBusinessDay', () => {
    it('should return previous weekday for weekday input', () => {
      const wednesday = new Date('2024-01-03');
      const result = service.getPreviousBusinessDay(wednesday);

      expect(result).toEqual(new Date('2024-01-02')); // Tuesday
    });

    it('should skip weekend and return Friday for Monday input', () => {
      const monday = new Date('2024-01-08');
      const result = service.getPreviousBusinessDay(monday);

      expect(result).toEqual(new Date('2024-01-05')); // Friday
    });
  });

  describe('formatDateInTimezone', () => {
    it('should format date in specified timezone', () => {
      const date = new Date('2024-01-15T10:00:00Z');
      const result = service.formatDateInTimezone(date);

      expect(result).toMatch(/2024-01-15/);
    });

    it('should format date as ISO when requested', () => {
      const date = new Date('2024-01-15T10:00:00Z');
      const result = service.formatDateInTimezone(date);

      expect(result).toBe('2024-01-15');
    });
  });

  describe('parseDateInTimezone', () => {
    it('should parse ISO date string', () => {
      const dateString = '2024-01-15T10:00:00.000Z';
      const result = service.parseDateInTimezone(dateString);

      expect(result).toEqual(new Date('2024-01-15T10:00:00.000Z'));
    });

    it('should parse simple date string', () => {
      const dateString = '2024-01-15';
      const result = service.parseDateInTimezone(dateString);

      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(0); // January
      expect(result.getDate()).toBe(15);
    });
  });

  describe('error handling', () => {
    it('should handle invalid billing cycle type', () => {
      const currentDate = new Date('2024-01-15');
      const lastBillingDate = new Date('2024-01-01');
      const config = {
        type: 'INVALID_TYPE' as BillingCycleType,
        interval: 1,
      };

      expect(() => {
        service.calculateNextBillingDate(currentDate, lastBillingDate, config);
      }).toThrow('Unsupported billing cycle type');
    });

    it('should handle invalid trial period unit', () => {
      const startDate = new Date('2024-01-01');
      const config = {
        duration: 7,
        unit: 'INVALID_UNIT' as any,
        includeStartDate: true,
      };

      expect(() => {
        service.calculateTrialEndDate(startDate, config);
      }).toThrow('Unsupported trial period unit');
    });

    it('should handle invalid date adjustment type', () => {
      const date = new Date('2024-01-15');

      expect(() => {
        service.adjustDate(date, 'INVALID_TYPE' as DateAdjustmentType);
      }).toThrow('Unsupported date adjustment type');
    });
  });
});
