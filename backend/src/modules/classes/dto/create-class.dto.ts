import { IsString, IsInt, IsBoolean, IsOptional } from 'class-validator';

export class CreateClassDto {
  @IsString()
  schoolId: string;

  @IsString()
  branchId: string;

  @IsString()
  name: string;

  @IsInt()
  @IsOptional()
  order?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateClassDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsInt()
  @IsOptional()
  order?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
