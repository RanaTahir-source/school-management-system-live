import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export enum FeeConcessionTypeDto {
  PERCENTAGE = 'PERCENTAGE',
  FLAT = 'FLAT',
}

// A per-student discount, e.g. sibling/staff/merit concession.
export class CreateFeeConcessionDto {
  @IsUUID()
  studentId: string;

  @IsOptional()
  @IsUUID()
  feeHeadId?: string; // omit = applies to every fee head on the invoice

  @IsEnum(FeeConcessionTypeDto)
  type: FeeConcessionTypeDto;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  value: number; // 0-100 for PERCENTAGE, rupees for FLAT

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  reason?: string;
}
