import { IsOptional, IsString } from 'class-validator';

export class UpdateParentDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
