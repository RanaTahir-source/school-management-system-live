import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;

export class CreateStaffTaskDto {
  @IsUUID()
  schoolId!: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: (typeof PRIORITIES)[number];

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsUUID()
  assignedToId!: string;
}
