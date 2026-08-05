import { IsBoolean, IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

// Attaches HR/payroll details to an EXISTING user account (created via the
// Staff & Users or Teachers page) - this endpoint never creates a new login,
// it only adds the StaffProfile record that Payroll needs to exist.
export class CreateStaffProfileDto {
  @IsUUID()
  userId: string;

  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @IsOptional()
  @IsString()
  category?: string; // free text e.g. "TEACHER", "ACCOUNTANT", "PEON"

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsString()
  education?: string;

  @IsOptional()
  @IsString()
  cnic?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsDateString()
  joiningDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  basicPay?: number;
}

export class UpdateStaffProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  employeeId?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsString()
  education?: string;

  @IsOptional()
  @IsString()
  cnic?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsDateString()
  joiningDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  basicPay?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
