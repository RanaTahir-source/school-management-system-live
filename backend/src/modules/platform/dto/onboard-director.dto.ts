import { IsEmail, IsOptional, IsString, MinLength, IsNotEmpty } from 'class-validator';

// Chairman-only: creates just the Director's login (no school yet - the
// Director creates their own school afterwards, see SchoolsController.createMine).
// They get a numeric Login ID + a tenantCode immediately; everything the
// Director later creates (school, branches, staff/parents/students) builds
// its own Login ID from that tenantCode.
export class OnboardDirectorDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @MinLength(8)
  password: string;
}
