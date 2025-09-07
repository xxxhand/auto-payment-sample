import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class BillingAddressDto {
  @IsString()
  @IsNotEmpty()
  country: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  postalCode: string;

  @IsString()
  @IsOptional()
  address?: string;
}

class CardDto {
  @IsString()
  @IsOptional()
  number?: string;

  @IsNumber()
  @IsOptional()
  expMonth?: number;

  @IsNumber()
  @IsOptional()
  expYear?: number;

  @IsString()
  @IsOptional()
  cvc?: string;

  @IsString()
  @IsOptional()
  holderName?: string;

  @IsString()
  @IsOptional()
  brand?: string;
}

export class PaymentMethodRequest {
  @IsString()
  @IsNotEmpty()
  type: string; // CREDIT_CARD, DEBIT_CARD, PAYPAL, etc.

  @IsString()
  @IsOptional()
  displayName?: string;

  @IsString()
  @IsOptional()
  brand?: string; // VISA, MASTERCARD, etc.

  @IsNumber()
  @IsOptional()
  expiryMonth?: number;

  @IsNumber()
  @IsOptional()
  expiryYear?: number;

  @IsBoolean()
  @IsOptional()
  setAsDefault?: boolean;

  @ValidateNested()
  @Type(() => BillingAddressDto)
  @IsOptional()
  billingAddress?: BillingAddressDto;

  @ValidateNested()
  @Type(() => CardDto)
  @IsOptional()
  card?: CardDto;

  @IsOptional()
  metadata?: any;

  // 用於信用卡新增時的敏感資料（實際應用中需要加密處理）
  @IsString()
  @IsOptional()
  cardToken?: string; // 來自支付服務商的token

  @IsString()
  @IsOptional()
  externalPaymentMethodId?: string; // 外部支付方式ID
}
