import { IsInt, IsOptional, IsString } from 'class-validator';

// Shared by both AiQuestionPaper and AiLessonPlan edits - a teacher tweaking
// the AI's draft before printing/saving it for real use. `content` is
// intentionally untyped here (validated loosely) since its shape differs
// between the two document types; the frontend sends back the same
// structure it received from the generate call, edited in place.
export class UpdateAiDocumentDto {
  @IsOptional()
  @IsString()
  title?: string; // question papers only

  @IsOptional()
  @IsString()
  topic?: string; // lesson plans only

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsInt()
  totalMarks?: number;

  @IsOptional()
  @IsInt()
  durationMinutes?: number;

  @IsOptional()
  content?: unknown;
}
