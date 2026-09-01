import { IsBoolean } from 'class-validator';

export class MarkAttendanceDto {
  @IsBoolean()
  attended!: boolean;
}
