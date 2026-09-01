import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const CATEGORIES = ['ACADEMIC', 'ADMINISTRATION', 'HUMAN_RESOURCE', 'FINANCE', 'HEALTH_SAFETY', 'USER_MANUAL', 'CUSTOM'] as const;

export class UpdateManualDto {
  @IsOptional()
  @IsIn(CATEGORIES)
  category?: (typeof CATEGORIES)[number];

  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
