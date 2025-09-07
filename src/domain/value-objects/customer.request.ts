import { IsString, IsNotEmpty, IsEmail, IsOptional, IsArray, ArrayMaxSize } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * 創建客戶請求 DTO
 */
export class CreateCustomerRequest {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : []))
  tags?: string[];

  @IsString()
  @IsOptional()
  description?: string;
}

/**
 * 更新客戶請求 DTO
 */
export class UpdateCustomerRequest {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

/**
 * 添加客戶標籤請求 DTO
 */
export class AddCustomerTagRequest {
  @IsString()
  @IsNotEmpty()
  tag: string;
}

/**
 * 客戶查詢請求 DTO
 */
export class QueryCustomersRequest {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',');
    }
    return value;
  })
  tags?: string[];

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => Math.min(parseInt(value, 10), 100))
  limit?: number = 20;

  @IsOptional()
  @IsString()
  sort?: string = '-createdAt';
}

/**
 * 綁定支付方式請求 DTO
 */
export class AssignPaymentMethodRequest {
  @IsString()
  @IsNotEmpty()
  paymentMethodId: string;
}
