import { IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { InventoryTransactionType } from '@prisma/client';

export class RecordInventoryTransactionDto {
  @IsUUID()
  itemId: string;

  @IsEnum(InventoryTransactionType)
  type: InventoryTransactionType;

  @IsInt()
  @Min(1)
  quantity: number;

  // Optional - defaults to the item's costPrice (PURCHASE) or sellPrice
  // (SALE) so the till operator doesn't have to re-type the standard price
  // every time, but can override for a discount/special deal.
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsString()
  note?: string;

  // Required only when type is ADJUSTMENT - which way the stock count moves
  // (e.g. INCREASE after a recount finds more than expected, DECREASE for
  // damage/loss/theft). Ignored for PURCHASE (always increases) and SALE
  // (always decreases).
  @IsOptional()
  @IsIn(['INCREASE', 'DECREASE'])
  direction?: 'INCREASE' | 'DECREASE';
}
