import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class SignupDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  // Optional - most staff accounts get only a numeric Login ID (auto-generated).
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;

  // Which role to assign - Milestone 1 keeps this simple; later this gets
  // restricted so only Director/Admin can create certain roles.
  @IsString()
  @IsNotEmpty()
  roleName: string;

  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}
