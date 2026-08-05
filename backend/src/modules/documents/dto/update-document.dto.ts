import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DocumentStatus } from '@prisma/client';

// Used for both "edit metadata" (title) and the verify/reject workflow
// (status + rejectionReason) - kept as one DTO since both actions hit the
// same PATCH /documents/:id endpoint.
export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
