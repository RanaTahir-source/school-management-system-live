import { IsDateString, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

// A "paper": one subject within an exam, for one class, with its own marks scale.
export class CreateExamSubjectDto {
  @IsUUID()
  classId: string;

  @IsUUID()
  subjectId: string;

  @IsInt()
  @Min(1)
  maxMarks: number;

  @IsInt()
  @Min(0)
  passingMarks: number;

  @IsOptional()
  @IsDateString()
  examDate?: string;
}

export class UpdateExamSubjectDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  maxMarks?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  passingMarks?: number;

  @IsOptional()
  @IsDateString()
  examDate?: string;
}
