import { IsDateString, IsEnum, IsUUID } from 'class-validator';

export class IssueBookDto {
  @IsUUID()
  bookId: string;

  @IsUUID()
  borrowerId: string;

  @IsDateString()
  dueDate: string;
}

export enum FineAction {
  PAID = 'PAID',
  WAIVED = 'WAIVED',
}

export class SettleFineDto {
  @IsEnum(FineAction)
  action: FineAction;
}
