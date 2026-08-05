import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class LogVisitorDto {
  @IsUUID()
  studentId: string;

  @IsString()
  @IsNotEmpty()
  visitorName: string;

  @IsOptional()
  @IsString()
  relation?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  purpose?: string;
}
