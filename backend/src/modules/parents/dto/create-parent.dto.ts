import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

// Creates the User account (role=PARENT) - no employee ID or HR fields,
// parents just need a login to view their children's records.
export class CreateParentDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  // Optional - most parents get only a numeric Login ID (auto-generated).
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsUUID()
  schoolId: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}
