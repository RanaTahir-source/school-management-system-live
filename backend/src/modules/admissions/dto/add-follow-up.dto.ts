import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AddFollowUpDto {
  @IsString()
  @IsNotEmpty()
  note: string;

  @IsOptional()
  @IsDateString()
  nextFollowUpDate?: string;
}
