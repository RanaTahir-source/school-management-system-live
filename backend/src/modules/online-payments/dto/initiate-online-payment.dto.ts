import { IsEnum, IsNumber, IsUUID, Min } from 'class-validator';
import { OnlinePaymentMethod } from '@prisma/client';

export class InitiateOnlinePaymentDto {
  @IsUUID()
  invoiceId: string;

  @IsEnum(OnlinePaymentMethod)
  method: OnlinePaymentMethod;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  amount: number;
}
