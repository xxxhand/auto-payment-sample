import { IsString, IsOptional } from 'class-validator';

export class ValidatePromotionRequest {
  @IsString()
  @IsOptional()
  // Deprecated: use promotionCode
  code?: string;

  @IsString()
  @IsOptional()
  promotionCode?: string;

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
