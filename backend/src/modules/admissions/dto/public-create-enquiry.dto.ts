import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { AdmissionSource } from '@prisma/client';

// Submitted from the school's public website - no auth, no schoolId (the
// school is identified by its short `code` in the URL, see
// AdmissionsController#publicCreate). Deliberately minimal: a family filling
// this in shouldn't need to know their desired branch/class in detail - staff
// fill in the rest once they follow up.
export class PublicCreateEnquiryDto {
  @IsString()
  @IsNotEmpty()
  childName: string;

  @IsOptional()
  @IsString()
  desiredClassName?: string;

  @IsString()
  @IsNotEmpty()
  parentName: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsEnum(AdmissionSource)
  source?: AdmissionSource;
}
