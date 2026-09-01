import { IsOptional, IsString } from 'class-validator';

export class ReviewOnlinePaymentDto {
  @IsOptional()
  @IsString()
  reviewNote?: string;
}
