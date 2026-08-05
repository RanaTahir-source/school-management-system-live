import { IsDateString, IsOptional, IsString } from 'class-validator';

export class PayPayslipDto {
  @IsOptional()
  @IsDateString()
  paidDate?: string;

  @IsOptional()
  @IsString()
  method?: string;
}
