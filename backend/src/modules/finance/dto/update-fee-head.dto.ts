import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateFeeHeadDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isMonthly?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
