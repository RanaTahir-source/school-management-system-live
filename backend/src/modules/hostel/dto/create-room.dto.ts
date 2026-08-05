import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Min } from 'class-validator';

export class CreateHostelRoomDto {
  @IsUUID()
  schoolId: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsString()
  @IsNotEmpty()
  roomNo: string;

  @IsOptional()
  @IsString()
  block?: string;

  @IsOptional()
  @IsString()
  floor?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  capacity?: number;

  @IsOptional()
  @IsString()
  roomType?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyFee?: number;
}

export class UpdateHostelRoomDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  roomNo?: string;

  @IsOptional()
  @IsString()
  block?: string;

  @IsOptional()
  @IsString()
  floor?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  capacity?: number;

  @IsOptional()
  @IsString()
  roomType?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyFee?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
