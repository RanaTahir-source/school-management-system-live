import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { CertificateType } from '@prisma/client';

export class CreateCertificateDto {
  @IsUUID()
  schoolId: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsUUID()
  staffId?: string;

  @IsEnum(CertificateType)
  type: CertificateType;

  @IsString()
  @IsNotEmpty()
  title: string;

  // Custom certificate body text. If omitted, a sensible default is
  // generated from `type` (see CertificatesService#defaultBody).
  @IsOptional()
  @IsString()
  bodyText?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  // MIGRATION-only fields - everything else for that type (admission date,
  // attendance, marks, dues) is auto-computed server-side from the
  // student's existing records; these two can't be known automatically.
  @IsOptional()
  @IsString()
  shiftedToSchool?: string;

  @IsOptional()
  @IsDateString()
  transferDate?: string;
}
