import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, IsUUID, Max, Min } from 'class-validator';

export class CreateOnlineClassDto {
  @IsUUID()
  sectionId: string;

  @IsUUID()
  subjectId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  // Zoom/Google Meet/Teams link - we don't host video ourselves, just point
  // students/parents at the teacher's own meeting.
  @IsUrl({ require_protocol: true }, { message: 'meetingLink must be a valid URL (include https://)' })
  meetingLink: string;

  @IsDateString()
  scheduledAt: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(240)
  durationMinutes?: number;
}
