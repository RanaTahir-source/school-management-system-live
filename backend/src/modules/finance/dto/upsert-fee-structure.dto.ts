import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsUUID, Min, ValidateNested } from 'class-validator';

class FeeStructureItemInput {
  @IsUUID()
  feeHeadId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;
}

// The full set of fee-head amounts for one class, for one academic year.
// Calling this again for the same (classId, academicYearId) replaces the items.
export class UpsertFeeStructureDto {
  @IsUUID()
  classId: string;

  @IsUUID()
  academicYearId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FeeStructureItemInput)
  items: FeeStructureItemInput[];
}
