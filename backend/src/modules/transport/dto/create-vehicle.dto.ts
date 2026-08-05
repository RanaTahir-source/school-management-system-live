import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

export class CreateVehicleDto {
  @IsUUID()
  schoolId: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsString()
  @IsNotEmpty()
  registrationNo: string;

  @IsOptional()
  @IsString()
  vehicleType?: string;

  @IsOptional()
  @IsString()
  make?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  capacity?: number;

  @IsOptional()
  @IsUUID()
  driverId?: string;
}

export class UpdateVehicleDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  registrationNo?: string;

  @IsOptional()
  @IsString()
  vehicleType?: string;

  @IsOptional()
  @IsString()
  make?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  capacity?: number;

  @IsOptional()
  @IsUUID()
  driverId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
