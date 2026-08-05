import { IsUUID } from 'class-validator';

export class AssignTeacherDto {
  @IsUUID()
  teacherId: string; // userId of a user holding the TEACHER role
}
