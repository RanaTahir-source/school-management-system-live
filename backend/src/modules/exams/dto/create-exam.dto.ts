import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

// See ExamsService.update() for why academicYearId is editable here but
// schoolId is not: an exam can be reassigned to a different academic year
// of the SAME school (e.g. it was created under the wrong year by mistake),
// but moving it to a different school is not supported by any UI action -
// it would leave existing exam subjects/results pointing at a class/subject
// that belongs to the old school.

export class CreateExamDto {
  @IsUUID()
  schoolId: string;

  @IsUUID()
  academicYearId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}

export class UpdateExamDto {
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
