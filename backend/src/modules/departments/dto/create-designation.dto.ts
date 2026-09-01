import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateDesignationDto {
  @IsString()
  schoolId: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  departmentId?: string;
}

export class UpdateDesignationDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  departmentId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
