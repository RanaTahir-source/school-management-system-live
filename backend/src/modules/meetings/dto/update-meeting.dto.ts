import { IsDateString, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const STATUSES = ['SCHEDULED', 'COMPLETED', 'CANCELLED'] as const;

export class UpdateMeetingDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsString()
  agenda?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @IsOptional()
  @IsString()
  minutes?: string;
}
