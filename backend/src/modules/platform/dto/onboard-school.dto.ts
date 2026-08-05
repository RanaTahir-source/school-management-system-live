import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

// Chairman-only: creates a brand new tenant in one shot - the School plus
// its first Director account, already linked via School.directorId.
export class OnboardSchoolDto {
  @IsString()
  @IsNotEmpty()
  schoolName: string;

  @IsString()
  @IsNotEmpty()
  schoolCode: string; // short unique code, e.g. "XYZ"

  @IsOptional()
  @IsString()
  schoolAddress?: string;

  @IsOptional()
  @IsString()
  schoolPhone?: string;

  @IsString()
  @IsNotEmpty()
  directorFullName: string;

  @IsEmail()
  directorEmail: string;

  @IsOptional()
  @IsString()
  directorPhone?: string;

  @IsString()
  @MinLength(8)
  directorPassword: string;
}
