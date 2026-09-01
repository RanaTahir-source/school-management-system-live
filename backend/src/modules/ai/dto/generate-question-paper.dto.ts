import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class GenerateQuestionPaperDto {
  @IsUUID()
  schoolId: string;

  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  examType?: string; // "Class Test", "Midterm", "Final", "Quiz"

  @IsInt()
  @Min(5)
  totalMarks: number;

  @IsOptional()
  @IsInt()
  @Min(10)
  durationMinutes?: number;

  // Free text: chapters/topics to draw questions from, e.g. "Chapter 3:
  // Photosynthesis, Chapter 4: Respiration in plants". Required - without
  // this the AI has no grounding for what the paper should actually cover.
  @IsString()
  @IsNotEmpty()
  topics: string;

  @IsOptional()
  @IsString()
  instructions?: string; // extra instructions for the AI, e.g. "include 5 MCQs and 3 long questions"
}
