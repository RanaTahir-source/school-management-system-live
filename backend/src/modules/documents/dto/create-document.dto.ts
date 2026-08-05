import { IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { DocumentCategory, DocumentOwnerType } from '@prisma/client';

// This DTO is bound from multipart/form-data (the file rides alongside it
// via FileInterceptor), so every field arrives as a string - booleans need
// an explicit @Transform or class-validator's @IsBoolean() rejects the
// literal string "true".
export class CreateDocumentDto {
  @IsUUID()
  schoolId: string;

  @IsEnum(DocumentOwnerType)
  ownerType: DocumentOwnerType;

  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @IsOptional()
  @IsUUID()
  staffId?: string;

  @IsEnum(DocumentCategory)
  category: DocumentCategory;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isConfidential?: boolean;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
