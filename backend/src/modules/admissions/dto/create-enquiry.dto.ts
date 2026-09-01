import { IsDateString, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { AdmissionSource } from '@prisma/client';

// Staff manually logging a lead - a walk-in visitor, a phone enquiry, someone
// referred by an existing parent, etc. (The public online-enquiry form uses
// PublicCreateEnquiryDto instead, which has no schoolId/auth requirement.)
export class CreateEnquiryDto {
  @IsUUID()
  schoolId: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

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

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @IsOptional()
  @IsDateString()
  nextFollowUpDate?: string;
}
