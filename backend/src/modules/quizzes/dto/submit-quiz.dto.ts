import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

class QuizAnswerInput {
  @IsString()
  questionId: string;

  // The option index the student picked (as a string, e.g. "1"). Omitted /
  // empty means the student left this question blank.
  @IsString()
  @IsOptional()
  responseText?: string;
}

export class SubmitQuizDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuizAnswerInput)
  answers: QuizAnswerInput[];
}
