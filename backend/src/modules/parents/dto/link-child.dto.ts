import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class LinkChildDto {
  @IsUUID()
  studentId: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  relation?: string; // e.g. "Father", "Mother", "Guardian"
}
