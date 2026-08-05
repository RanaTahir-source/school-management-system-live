import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

class GradeBandDto {
  @IsString()
  grade: string;

  @IsNumber()
  minPercent: number;

  @IsNumber()
  maxPercent: number;
}

export class UpsertSettingsDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GradeBandDto)
  gradingScale?: GradeBandDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  weekendDays?: number[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  lateFeePercent?: number;

  @IsOptional()
  @IsString()
  attendanceLateAfter?: string; // "HH:mm"

  @IsOptional()
  @IsBoolean()
  smsNotificationsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  emailNotificationsEnabled?: boolean;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  bankAccountTitle?: string;

  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @IsOptional()
  @IsString()
  jazzCashNumber?: string;

  @IsOptional()
  @IsString()
  easyPaisaNumber?: string;

  @IsOptional()
  @IsString()
  paymentQrData?: string;
}
