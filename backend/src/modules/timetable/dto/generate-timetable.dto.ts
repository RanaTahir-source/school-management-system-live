import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

class SubjectRequirementInput {
  @IsString()
  subjectId: string;

  // How many periods a week this subject needs for the section.
  @IsInt()
  @Min(1)
  @Max(30)
  periodsPerWeek: number;

  // Pin this subject to a specific teacher - the generator will never
  // double-book that teacher into two places at once, school-wide, even
  // across sections it isn't generating for right now.
  @IsString()
  @IsOptional()
  teacherId?: string;
}

export class GenerateTimetableDto {
  @IsString()
  sectionId: string;

  // Subset of 1..7 (Mon..Sun) - the days this section has classes.
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  workingDays: number[];

  @IsInt()
  @Min(1)
  @Max(12)
  periodsPerDay: number;

  // "08:00" - first period's start time; later periods are computed by
  // adding periodDurationMinutes repeatedly (no break/recess handling in v1).
  @IsString()
  periodStartTime: string;

  @IsInt()
  @Min(10)
  @Max(180)
  periodDurationMinutes: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubjectRequirementInput)
  subjects: SubjectRequirementInput[];

  // false (default): only fills this section's currently-EMPTY day/period
  // cells, leaving any slots someone already entered by hand untouched.
  // true: wipes every existing slot for this section first, then generates
  // on a clean grid.
  @IsBoolean()
  @IsOptional()
  replaceExisting?: boolean;
}
