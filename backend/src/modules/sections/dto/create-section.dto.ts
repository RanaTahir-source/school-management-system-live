import { IsString, IsInt, IsBoolean, IsOptional } from 'class-validator';

export class CreateSectionDto {
  @IsString()
  classId: string;

  @IsString()
  academicYearId: string;

  @IsString()
  name: string;

  @IsInt()
  @IsOptional()
  capacity?: number;

  @IsString()
  @IsOptional()
  classTeacherId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateSectionDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsInt()
  @IsOptional()
  capacity?: number;

  @IsString()
  @IsOptional()
  classTeacherId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
