import { IsDateString, IsInt, IsOptional, IsString, IsUrl, Max, Min } from 'class-validator';

export class UpdateOnlineClassDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'meetingLink must be a valid URL (include https://)' })
  meetingLink?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(240)
  durationMinutes?: number;
}
