import { IsString, IsNumber, IsOptional, Min, IsEnum, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaymentStatus } from '../entities';

/**
 * 創建支付請求 DTO
 */
export class CreatePaymentRequest {
  @IsString()
  subscriptionId: string;

  @IsString()
  customerId: string;

  @IsString()
  paymentMethodId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Transform(({ value }) => parseFloat(value))
  amount: number;

  @IsOptional()
  @IsString()
  currency?: string = 'TWD';

  @IsOptional()
  @IsString()
  description?: string;
}

/**
 * 支付查詢請求 DTO
 */
export class PaymentQueryRequest {
  @IsOptional()
  @IsString()
  subscriptionId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number = 50;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

/**
 * 支付操作請求 DTO
 */
export class PaymentOperationRequest {
  @IsOptional()
  @IsString()
  externalTransactionId?: string;

  @IsOptional()
  @IsString()
  failureReason?: string;

  @IsOptional()
  @IsString()
  failureCode?: string;
}

/**
 * 退款請求 DTO
 */
export class RefundRequest {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Transform(({ value }) => parseFloat(value))
  refundAmount: number;

  @IsOptional()
  @IsString()
  refundReason?: string;
}
