import { ArrayMinSize, IsArray, IsDateString, IsEnum, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AttendanceStatus } from '@prisma/client';

class HostelAttendanceEntryDto {
  @IsUUID()
  studentId: string;

  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;

  @IsOptional()
  @IsString()
  remarks?: string;
}

// Bulk-mark every hostel resident for one calendar day in a single call,
// mirroring MarkAttendanceDto from the class Attendance module.
export class MarkHostelAttendanceDto {
  @IsDateString()
  date: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => HostelAttendanceEntryDto)
  entries: HostelAttendanceEntryDto[];
}
