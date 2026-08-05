import { IsInt, IsOptional, IsString, IsUUID, Matches, Max, Min } from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/; // "HH:mm", 24-hour

export class CreateTimetableSlotDto {
  @IsUUID()
  sectionId: string;

  @IsUUID()
  subjectId: string;

  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @IsInt()
  @Min(1)
  @Max(7) // 1 = Monday ... 7 = Sunday
  dayOfWeek: number;

  @IsInt()
  @Min(1)
  periodNo: number;

  @IsString()
  @Matches(TIME_PATTERN, { message: 'startTime must be in HH:mm 24-hour format' })
  startTime: string;

  @IsString()
  @Matches(TIME_PATTERN, { message: 'endTime must be in HH:mm 24-hour format' })
  endTime: string;

  @IsOptional()
  @IsString()
  room?: string;
}
