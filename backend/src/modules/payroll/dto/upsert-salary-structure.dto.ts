import { IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class UpsertSalaryStructureDto {
  @IsUUID()
  staffId: string;

  @IsNumber()
  @Min(0)
  basicPay: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  allowances?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deductions?: number;
}
