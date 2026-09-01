import { IsIn } from 'class-validator';

const STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;

export class UpdateTaskStatusDto {
  @IsIn(STATUSES)
  status!: (typeof STATUSES)[number];
}
