import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

// Self-service by default - applicantType and the student/staff link are
// resolved server-side from the caller's own JWT (see LeaveService.create),
// never taken from the request body, so nobody can file leave "as" someone
// else. studentId is the one exception: a PARENT must say which linked
// child the leave is for, and the service verifies that link before using it.
export class CreateLeaveRequestDto {
  @IsDateString()
  fromDate: string;

  @IsDateString()
  toDate: string;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;
}
