import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class GenerateLessonPlanDto {
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
  topic: string;

  @IsOptional()
  @IsInt()
  @Min(10)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  instructions?: string; // e.g. "include a group activity", "focus on practical examples"
}
