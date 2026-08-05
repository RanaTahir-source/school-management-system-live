import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { Gender } from '@prisma/client';

// Creates the User account (role=STUDENT) and the StudentProfile in one call,
// so Admin/Principal doesn't have to hit /auth/signup separately.
export class CreateStudentDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  // Optional - most students get only a numeric Login ID (auto-generated).
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;

  @IsUUID()
  schoolId: string;

  @IsUUID()
  branchId: string;

  @IsString()
  @IsNotEmpty()
  admissionNo: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsString()
  guardianName?: string;

  @IsOptional()
  @IsString()
  guardianPhone?: string;

  @IsOptional()
  @IsString()
  guardianCnic?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsUUID()
  sectionId?: string;
}
