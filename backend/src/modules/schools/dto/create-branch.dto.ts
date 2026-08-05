import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { BranchGender } from '@prisma/client';

export class CreateBranchDto {
  @IsUUID()
  schoolId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsEnum(BranchGender)
  genderScope?: BranchGender;
}

export class UpdateBranchDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(BranchGender)
  genderScope?: BranchGender;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
