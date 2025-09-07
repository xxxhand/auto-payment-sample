import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ValidatePromotionRequest {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsOptional()
  productId?: string;

  @IsString()
  @IsOptional()
  planId?: string;

  @IsString()
  @IsOptional()
  customerId?: string;
}
