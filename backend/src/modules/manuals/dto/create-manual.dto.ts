import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

const CATEGORIES = ['ACADEMIC', 'ADMINISTRATION', 'HUMAN_RESOURCE', 'FINANCE', 'HEALTH_SAFETY', 'USER_MANUAL', 'CUSTOM'] as const;

export class CreateManualDto {
  @IsOptional()
  @IsUUID()
  schoolId?: string; // omit = global bundled manual (CHAIRMAN only) or "my school" for everyone else

  @IsIn(CATEGORIES)
  category!: (typeof CATEGORIES)[number];

  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsString()
  @MinLength(1)
  content!: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
