import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, IsUrl } from 'class-validator';
import { MaterialType } from '@prisma/client';

export class CreateStudyMaterialDto {
  @IsUUID()
  schoolId: string;

  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  // A link to the file (Google Drive, YouTube, etc.) - there's no
  // server-side file storage wired up yet, so this isn't a direct upload.
  @IsUrl({ require_tld: false })
  fileUrl: string;

  @IsOptional()
  @IsEnum(MaterialType)
  type?: MaterialType;
}
