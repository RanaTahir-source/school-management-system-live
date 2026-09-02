import { IsBoolean, IsDateString, IsEmail, IsOptional, IsString } from 'class-validator';

// Editable after creation. schoolId/branchId/employeeId are intentionally
// excluded - re-assigning a teacher to a different school/branch or changing
// their employee ID isn't exposed as a plain edit anywhere else in this
// codebase (see StudentsService.update for the same convention), and
// password changes go through the dedicated reset-password flow, not here.
export class UpdateTeacherDto {
  // Lives on the User record, not TeacherProfile - see TeachersService.update().
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

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

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
