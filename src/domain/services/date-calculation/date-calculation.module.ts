import { Module } from '@nestjs/common';
import { DateCalculationService } from './date-calculation.service';

/**
 * 日期計算模組
 * 提供複雜日期計算邏輯的服務
 */
@Module({
  providers: [DateCalculationService],
  exports: [DateCalculationService],
})
export class DateCalculationModule {}
