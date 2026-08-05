import { IsBoolean, IsDateString, IsOptional, IsUUID, Matches } from 'class-validator';

// Generates one FeeInvoice per active student in a class (for its current
// FeeStructure), for a given month. Skips students that already have an
// invoice for that period.
export class GenerateInvoicesDto {
  @IsUUID()
  classId: string;

  @IsUUID()
  academicYearId: string;

  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'period must be in YYYY-MM format' })
  period: string;

  @IsDateString()
  dueDate: string;

  @IsOptional()
  @IsBoolean()
  includeOneTimeFees?: boolean; // include isMonthly=false heads (e.g. Admission Fee) - use only for the first invoice
}
