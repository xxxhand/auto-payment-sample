import { IsString, IsNotEmpty, IsOptional, IsNumber, IsDateString, IsEnum } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { BillingCycle } from '../enums/codes.const';

/**
 * 創建訂閱請求 DTO
 */
export class CreateSubscriptionRequest {
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @IsString()
  @IsNotEmpty()
  paymentMethodId: string;

  @IsString()
  @IsNotEmpty()
  planName: string;

  @IsNumber()
  @Type(() => Number)
  amount: number;

  @IsEnum(BillingCycle)
  billingCycle: BillingCycle;

  @IsString()
  @IsOptional()
  currency?: string = 'TWD';

  @IsDateString()
  @IsOptional()
  trialEndDate?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

/**
 * 更新訂閱請求 DTO
 */
export class UpdateSubscriptionRequest {
  @IsString()
  @IsOptional()
  paymentMethodId?: string;

  @IsString()
  @IsOptional()
  planName?: string;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  amount?: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

/**
 * 取消訂閱請求 DTO
 */
export class CancelSubscriptionRequest {
  @IsString()
  @IsOptional()
  reason?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  immediate?: boolean = false;
}

/**
 * 方案變更請求 DTO
 */
export class PlanChangeRequest {
  @IsString()
  @IsNotEmpty()
  targetPlanId: string;

  @IsString()
  @IsOptional()
  @IsEnum(['IMMEDIATE', 'NEXT_CYCLE'])
  changeType?: string = 'NEXT_CYCLE';

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  @IsEnum(['CREATE_PRORATION', 'NONE'])
  prorationMode?: string = 'CREATE_PRORATION';
}

/**
 * 暫停訂閱請求 DTO
 */
export class PauseSubscriptionRequest {
  @IsString()
  @IsOptional()
  reason?: string;

  @IsDateString()
  @IsOptional()
  resumeDate?: string;
}

/**
 * 退款請求 DTO
 */
export class RefundSubscriptionRequest {
  @IsString()
  @IsNotEmpty()
  paymentId: string;

  @IsString()
  @IsOptional()
  @IsEnum(['FULL', 'PARTIAL', 'PRORATED'])
  refundType?: string = 'FULL';

  @IsNumber()
  @IsOptional()
  refundAmount?: number;

  @IsString()
  @IsOptional()
  reason?: string;
}
