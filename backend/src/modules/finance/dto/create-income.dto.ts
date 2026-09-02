import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

// Records money received under any "mad" (category) - a fee payment when
// studentId is set, or general school income (donation, misc) when it isn't.
export class CreateIncomeDto {
  @IsUUID()
  schoolId: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;

  // Optional formal Chart-of-Accounts tag - see AccountHead. Free-text
  // category below still stays required, so nothing changes for schools
  // that haven't set up account heads yet.
  @IsOptional()
  @IsUUID()
  accountHeadId?: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  description?: string;
}
