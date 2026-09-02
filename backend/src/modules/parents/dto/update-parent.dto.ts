import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateParentDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
