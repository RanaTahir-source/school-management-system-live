import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateHouseDto {
  @IsString()
  schoolId: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  colorHex?: string;

  @IsString()
  @IsOptional()
  inChargeId?: string;
}

export class UpdateHouseDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  colorHex?: string;

  // Sent as an empty string to clear the in-charge - the service treats
  // '' the same as null, since class-validator's @IsOptional lets undefined
  // through but a plain nullable @IsString field can't express "clear this".
  @IsString()
  @IsOptional()
  inChargeId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
