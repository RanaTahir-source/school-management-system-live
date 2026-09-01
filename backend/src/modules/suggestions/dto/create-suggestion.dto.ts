import { IsBoolean, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateSuggestionDto {
  @IsUUID()
  schoolId!: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsString()
  @MinLength(5)
  message!: string;

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;
}
