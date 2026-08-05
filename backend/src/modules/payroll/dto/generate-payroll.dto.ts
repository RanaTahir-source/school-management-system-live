import { IsOptional, IsUUID, Matches } from 'class-validator';

// Generates one Payslip per active staff member (who has a SalaryStructure)
// in a school, for a given month. Skips staff that already have a payslip
// for that period - mirrors GenerateInvoicesDto from the Finance module.
export class GeneratePayrollDto {
  @IsUUID()
  schoolId: string;

  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'period must be in YYYY-MM format' })
  period: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}
