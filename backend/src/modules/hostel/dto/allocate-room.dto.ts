import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class AllocateRoomDto {
  @IsUUID()
  studentId: string;

  @IsUUID()
  roomId: string;

  @IsOptional()
  @IsDateString()
  checkInDate?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class VacateRoomDto {
  @IsOptional()
  @IsDateString()
  checkOutDate?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}
