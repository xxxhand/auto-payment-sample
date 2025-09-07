import { IsString, IsOptional, IsNumber, Min, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * 訂閱計費請求 DTO
 */
export class ProcessBillingRequest {
  @IsString()
  subscriptionId: string;
}

/**
 * 批量計費查詢請求 DTO
 */
export class BillingQueryRequest {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number = 100;
}

/**
 * 計費狀態查詢請求 DTO
 */
export class BillingStatusRequest {
  @IsString()
  subscriptionId: string;
}

/**
 * 計費報告查詢請求 DTO
 */
export class BillingReportRequest {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number = 100;
}
