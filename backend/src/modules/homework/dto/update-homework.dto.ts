import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateHomeworkDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
