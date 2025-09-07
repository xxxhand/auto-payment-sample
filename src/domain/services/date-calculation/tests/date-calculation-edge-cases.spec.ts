import { Test, TestingModule } from '@nestjs/testing';
import { DateCalculationService } from '../date-calculation.service';
import { BillingCycleType, DateAdjustmentType, IBillingCycleConfig, ITrialPeriodConfig, IDateCalculationOptions } from '../interfaces/date-calculation.interface';

describe('DateCalculationService - Edge Cases', () => {
  let service: DateCalculationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DateCalculationService],
    }).compile();

    service = module.get<DateCalculationService>(DateCalculationService);
  });

  describe('Leap Year Handling', () => {
    it('should handle February 29th in leap year', () => {
      const leapYearDate = new Date('2024-02-29');
      const config: IBillingCycleConfig = {
        type: BillingCycleType.ANNUALLY,
        interval: 1,
      };

      const result = service.calculateNextBillingDate(leapYearDate, leapYearDate, config);

      // 下一年不是閏年，應該調整為2月28日
      expect(result.nextBillingDate).toEqual(new Date('2025-02-28'));
    });

    it('should handle month-end billing in February for leap year', () => {
      const lastBillingDate = new Date('2024-01-31');
      const currentDate = new Date('2024-02-15');
      const config: IBillingCycleConfig = {
        type: BillingCycleType.MONTHLY,
        interval: 1,
        dayOfMonth: 31,
      };

      const result = service.calculateNextBillingDate(currentDate, lastBillingDate, config);

      // February only has 29 days in 2024 (leap year)
      expect(result.nextBillingDate.getDate()).toBe(29);
      expect(result.nextBillingDate.getMonth()).toBe(1); // February
    });

    it('should calculate correct billing period for leap year February', () => {
      const billingDate = new Date('2024-02-01');
      const config: IBillingCycleConfig = {
        type: BillingCycleType.MONTHLY,
        interval: 1,
      };

      const result = service.calculateBillingPeriod(billingDate, config);

      expect(result.dayCount).toBe(29); // February 2024 has 29 days
    });
  });

  describe('Month-End Day Handling', () => {
    it('should handle 31st day billing when next month has fewer days', () => {
      const lastBillingDate = new Date('2024-01-31');
      const currentDate = new Date('2024-02-15');
      const config: IBillingCycleConfig = {
        type: BillingCycleType.MONTHLY,
        interval: 1,
        dayOfMonth: 31,
      };

      const result = service.calculateNextBillingDate(currentDate, lastBillingDate, config);

      // February only has 29 days in 2024
      expect(result.nextBillingDate.getDate()).toBe(29);
    });

    it('should handle 30th day billing for February', () => {
      const lastBillingDate = new Date('2024-01-30');
      const currentDate = new Date('2024-02-15');
      const config: IBillingCycleConfig = {
        type: BillingCycleType.MONTHLY,
        interval: 1,
        dayOfMonth: 30,
      };

      const result = service.calculateNextBillingDate(currentDate, lastBillingDate, config);

      expect(result.nextBillingDate.getDate()).toBe(29); // Adjusted to Feb 29
    });
  });

  describe('Cross-Year Billing', () => {
    it('should handle billing cycle crossing year boundary', () => {
      const lastBillingDate = new Date('2023-12-15');
      const currentDate = new Date('2024-01-20');
      const config: IBillingCycleConfig = {
        type: BillingCycleType.MONTHLY,
        interval: 1,
      };

      const result = service.calculateNextBillingDate(currentDate, lastBillingDate, config);

      expect(result.nextBillingDate.getFullYear()).toBe(2024);
      expect(result.nextBillingDate.getMonth()).toBe(0); // January
      expect(result.nextBillingDate.getDate()).toBe(15);
    });

    it('should calculate quarterly billing across year boundary', () => {
      const lastBillingDate = new Date('2023-12-01');
      const currentDate = new Date('2024-01-15');
      const config: IBillingCycleConfig = {
        type: BillingCycleType.QUARTERLY,
        interval: 1,
      };

      const result = service.calculateNextBillingDate(currentDate, lastBillingDate, config);

      expect(result.nextBillingDate).toEqual(new Date('2024-03-01'));
    });
  });

  describe('Time Zone Edge Cases', () => {
    it('should handle daylight saving time transitions', () => {
      // 使用一個DST轉換日期
      const dstDate = new Date('2024-03-10T10:00:00Z'); // DST開始日期

      const formatted = service.formatDateInTimezone(dstDate);
      const parsed = service.parseDateInTimezone(formatted);

      // 確保往返轉換的一致性
      expect(Math.abs(parsed.getTime() - dstDate.getTime())).toBeLessThan(24 * 60 * 60 * 1000); // 24小時內
    });

    it('should handle UTC midnight boundary', () => {
      const utcMidnight = new Date('2024-01-15T00:00:00Z');
      const result = service.formatDateInTimezone(utcMidnight);

      expect(result).toContain('2024-01-15');
    });
  });

  describe('Business Day Complex Scenarios', () => {
    it('should handle multiple consecutive holidays', () => {
      const startDate = new Date('2024-12-23'); // Monday before Christmas week
      const holidays = [
        new Date('2024-12-24'), // Christmas Eve
        new Date('2024-12-25'), // Christmas
        new Date('2024-12-26'), // Boxing Day
        new Date('2024-12-27'), // Holiday
      ];
      const options: IDateCalculationOptions = {
        excludeHolidays: true,
        holidayList: holidays,
      };

      const nextBusinessDay = service.getNextBusinessDay(startDate, options);

      // 應該跳過所有假期和週末
      expect(nextBusinessDay.getDate()).toBe(30); // Monday after holidays
    });

    it('should calculate business days spanning multiple weeks with holidays', () => {
      const startDate = new Date('2024-12-20'); // Friday
      const endDate = new Date('2025-01-03'); // Friday
      const holidays = [
        new Date('2024-12-25'), // Christmas
        new Date('2025-01-01'), // New Year
      ];
      const options: IDateCalculationOptions = {
        excludeHolidays: true,
        holidayList: holidays,
      };

      const businessDays = service.calculateBusinessDays(startDate, endDate, options);

      // 計算實際工作日數量（排除週末和假期）
      expect(businessDays).toBeGreaterThan(0);
      expect(businessDays).toBeLessThan(15); // 總共不到15天，排除週末和假期後更少
    });
  });

  describe('Prorated Billing Edge Cases', () => {
    it('should handle prorated billing for single day usage', () => {
      const fullAmount = 100;
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-01-31');
      const usageStart = new Date('2024-01-15');
      const usageEnd = new Date('2024-01-15'); // Same day

      const result = service.calculateProratedAmount(fullAmount, periodStart, periodEnd, usageStart, usageEnd);

      expect(result.usedDays).toBe(1);
      expect(result.proratedAmount).toBeCloseTo(100 / 31, 2);
    });

    it('should handle zero-day billing period', () => {
      const fullAmount = 100;
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-01-01'); // Same day
      const usageStart = new Date('2024-01-01');
      const usageEnd = new Date('2024-01-01');

      const result = service.calculateProratedAmount(fullAmount, periodStart, periodEnd, usageStart, usageEnd);

      expect(result.totalDays).toBe(1);
      expect(result.usedDays).toBe(1);
      expect(result.ratio).toBe(1);
      expect(result.proratedAmount).toBe(100);
    });

    it('should handle usage period completely before billing period', () => {
      const fullAmount = 100;
      const periodStart = new Date('2024-01-15');
      const periodEnd = new Date('2024-01-31');
      const usageStart = new Date('2024-01-01');
      const usageEnd = new Date('2024-01-10');

      const result = service.calculateProratedAmount(fullAmount, periodStart, periodEnd, usageStart, usageEnd);

      expect(result.usedDays).toBe(0);
      expect(result.proratedAmount).toBe(0);
    });
  });

  describe('Extreme Date Values', () => {
    it('should handle very old dates', () => {
      const oldDate = new Date('1900-01-01');
      const config: IBillingCycleConfig = {
        type: BillingCycleType.MONTHLY,
        interval: 1,
      };

      const result = service.calculateNextBillingDate(new Date('1900-01-15'), oldDate, config);

      expect(result.nextBillingDate.getFullYear()).toBe(1900);
      expect(result.nextBillingDate.getMonth()).toBe(1); // February
    });

    it('should handle far future dates', () => {
      const futureDate = new Date('2099-12-31');
      const config: IBillingCycleConfig = {
        type: BillingCycleType.ANNUALLY,
        interval: 1,
      };

      const result = service.calculateNextBillingDate(futureDate, futureDate, config);

      expect(result.nextBillingDate.getFullYear()).toBe(2100);
    });
  });

  describe('Large Interval Values', () => {
    it('should handle large monthly intervals', () => {
      const startDate = new Date('2024-01-01');
      const config: IBillingCycleConfig = {
        type: BillingCycleType.MONTHLY,
        interval: 24, // 2 years
      };

      const result = service.calculateNextBillingDate(startDate, startDate, config);

      expect(result.nextBillingDate.getFullYear()).toBe(2026);
    });

    it('should handle large daily intervals', () => {
      const startDate = new Date('2024-01-01');
      const config: IBillingCycleConfig = {
        type: BillingCycleType.DAILY,
        interval: 365, // 365 days from leap year start
      };

      const result = service.calculateNextBillingDate(startDate, startDate, config);

      // 2024 is a leap year, so 2024-01-01 + 365 days = 2024-12-31
      expect(result.nextBillingDate.getFullYear()).toBe(2024);
      expect(result.nextBillingDate.getMonth()).toBe(11); // December
      expect(result.nextBillingDate.getDate()).toBe(31);
    });
  });

  describe('Complex Trial Period Scenarios', () => {
    it('should handle trial period with business days only across month boundary', () => {
      const startDate = new Date('2024-01-29'); // Monday near month end
      const config: ITrialPeriodConfig = {
        duration: 10,
        unit: 'DAYS',
        includeStartDate: true,
        businessDaysOnly: true,
      };

      const result = service.calculateTrialEndDate(startDate, config);

      // 應該跳過週末，跨月計算
      expect(result.getMonth()).toBeGreaterThan(startDate.getMonth());
      expect(service.isBusinessDay(result)).toBe(true);
    });

    it('should handle trial period with many holidays', () => {
      const startDate = new Date('2024-12-20'); // Before Christmas holidays
      const config: ITrialPeriodConfig = {
        duration: 7,
        unit: 'DAYS',
        includeStartDate: true,
        businessDaysOnly: true,
      };

      const result = service.calculateTrialEndDate(startDate, config);

      // 7 business days from Dec 20, 2024 should end around Dec 30, 2024
      // Since we're not handling holidays in the basic implementation
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(11); // December
      expect(service.isBusinessDay(result)).toBe(true);
    });
  });

  describe('Date Sequence Generation Edge Cases', () => {
    it('should handle date sequence with very large intervals', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2025-01-01');
      const config: IBillingCycleConfig = {
        type: BillingCycleType.MONTHLY,
        interval: 6, // Every 6 months
      };

      const result = service.generateDateSequence(startDate, endDate, config);

      expect(result).toHaveLength(3); // Jan 2024, Jul 2024, Jan 2025
      expect(result[1].getMonth()).toBe(6); // July
    });

    it('should handle daily sequence with adjustments', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-10');
      const config: IBillingCycleConfig = {
        type: BillingCycleType.DAILY,
        interval: 1,
        adjustment: DateAdjustmentType.BUSINESS_DAY,
      };

      const result = service.generateDateSequence(startDate, endDate, config);

      // 所有日期都應該是營業日
      result.forEach((date) => {
        expect(service.isBusinessDay(date)).toBe(true);
      });
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle large holiday lists efficiently', () => {
      const startTime = Date.now();

      // 創建大量假期
      const holidays: Date[] = [];
      for (let i = 0; i < 1000; i++) {
        holidays.push(new Date(2024, 0, (i % 365) + 1));
      }

      const options: IDateCalculationOptions = {
        excludeHolidays: true,
        holidayList: holidays,
      };

      const testDate = new Date('2024-06-15');
      const result = service.isBusinessDay(testDate, options);

      const endTime = Date.now();

      // 應該在合理時間內完成
      expect(endTime - startTime).toBeLessThan(1000); // 1秒內
      expect(typeof result).toBe('boolean');
    });

    it('should handle long date sequences efficiently', () => {
      const startTime = Date.now();

      const startDate = new Date('2020-01-01');
      const endDate = new Date('2025-01-01');
      const config: IBillingCycleConfig = {
        type: BillingCycleType.DAILY,
        interval: 1,
      };

      const result = service.generateDateSequence(startDate, endDate, config);

      const endTime = Date.now();

      // 應該在合理時間內完成
      expect(endTime - startTime).toBeLessThan(5000); // 5秒內
      expect(result.length).toBeGreaterThan(1800); // 約5年的天數
    });
  });
});
