import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class RecordFeePaymentDto {
  @IsUUID()
  invoiceId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @IsDateString()
  paidDate: string;

  @IsOptional()
  @IsString()
  method?: string; // Cash, Bank Transfer, JazzCash, EasyPaisa, Cheque, Online Transfer...
}
