import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

// Any status except ACTIVE - marking someone "ACTIVE" again is a separate
// reactivate() call, not this one.
const LEAVE_STATUSES = ['LEFT', 'GRADUATED', 'TRANSFERRED', 'EXPELLED'] as const;

export class MarkStudentLeftDto {
  @IsIn(LEAVE_STATUSES)
  status: (typeof LEAVE_STATUSES)[number];

  @IsOptional()
  @IsDateString()
  leftDate?: string; // defaults to today if omitted

  @IsOptional()
  @IsString()
  leaveReason?: string;
}
