import { IsIn, IsOptional, IsString } from 'class-validator';

const STATUSES = ['NEW', 'REVIEWED', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED'] as const;

export class RespondSuggestionDto {
  @IsIn(STATUSES)
  status!: (typeof STATUSES)[number];

  @IsOptional()
  @IsString()
  adminResponse?: string;
}
