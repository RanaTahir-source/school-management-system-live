import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];

export class CreateAccountHeadDto {
  @IsString()
  schoolId: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsIn(ACCOUNT_TYPES)
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';

  @IsString()
  @IsOptional()
  parentId?: string;
}

export class UpdateAccountHeadDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsIn(ACCOUNT_TYPES)
  @IsOptional()
  type?: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';

  // Sent as '' to clear (make top-level) - see UpdateHouseDto for the same convention.
  @IsString()
  @IsOptional()
  parentId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
