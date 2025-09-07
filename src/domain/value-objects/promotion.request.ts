import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ValidatePromotionRequest {
  @IsString()
  @IsNotEmpty()
  promotionCode: string;

  @IsString()
  @IsOptional()
  productId?: string;

  @IsString()
  @IsOptional()
  planId?: string;
}
