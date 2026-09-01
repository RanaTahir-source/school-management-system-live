import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class QuizQuestionInput {
  @IsIn(['MCQ', 'TRUE_FALSE'])
  @IsOptional()
  type?: 'MCQ' | 'TRUE_FALSE';

  @IsString()
  text: string;

  // For MCQ: the list of choices, e.g. ["Lahore", "Karachi", "Islamabad", "Quetta"].
  // For TRUE_FALSE this is ignored by the service - it always uses ["True", "False"].
  @IsArray()
  @IsOptional()
  options?: string[];

  // Index into `options` (as a string, e.g. "2") that is the correct choice.
  @IsString()
  correctAnswer: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  marks?: number;
}

export class CreateQuizDto {
  @IsString()
  schoolId: string;

  @IsString()
  @IsOptional()
  subjectId?: string;

  @IsString()
  @IsOptional()
  classId?: string;

  @IsString()
  @IsOptional()
  sectionId?: string;

  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  timeLimitMinutes?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuizQuestionInput)
  questions: QuizQuestionInput[];
}

// Replaces the quiz's meta fields and its full question list in one call -
// same "upsert the whole set" pattern as UpsertFeeStructureDto. Only allowed
// while the quiz is unpublished (see QuizzesService.update).
export class UpdateQuizDto {
  @IsString()
  @IsOptional()
  subjectId?: string;

  @IsString()
  @IsOptional()
  classId?: string;

  @IsString()
  @IsOptional()
  sectionId?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  timeLimitMinutes?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuizQuestionInput)
  @IsOptional()
  questions?: QuizQuestionInput[];

  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;
}
