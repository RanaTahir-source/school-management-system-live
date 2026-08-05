import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

// A fee category, e.g. "Tuition Fee", "Admission Fee", "Exam Fee", "Transport Fee"
export class CreateFeeHeadDto {
  @IsUUID()
  schoolId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsBoolean()
  isMonthly?: boolean; // default true; false = one-time charge (e.g. admission fee)
}
