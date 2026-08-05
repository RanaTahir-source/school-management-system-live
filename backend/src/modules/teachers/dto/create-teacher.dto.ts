import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

// Creates the User account (role=TEACHER) and the TeacherProfile in one call.
export class CreateTeacherDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  // Optional - most teachers get only a numeric Login ID (auto-generated).
  // Set this only if the teacher genuinely has a real, checked email.
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
  employeeId: string;

  @IsOptional()
  @IsString()
  qualification?: string;

  @IsOptional()
  @IsString()
  subjectSpecialty?: string;

  @IsOptional()
  @IsDateString()
  joiningDate?: string;

  @IsOptional()
  @IsString()
  cnic?: string;

  @IsOptional()
  @IsString()
  address?: string;
}
