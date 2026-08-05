import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ResultEntryDto {
  @IsUUID()
  studentId: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  marksObtained?: number;

  @IsOptional()
  @IsBoolean()
  isAbsent?: boolean;

  @IsOptional()
  @IsString()
  remarks?: string;
}

// Bulk-enter marks for a whole class in one paper, so a teacher doesn't have
// to send one request per student.
export class MarkResultsDto {
  @IsUUID()
  examSubjectId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ResultEntryDto)
  entries: ResultEntryDto[];
}
