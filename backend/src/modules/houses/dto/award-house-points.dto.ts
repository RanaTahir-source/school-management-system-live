import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class AwardHousePointsDto {
  // Positive to award, negative to deduct - never 0 (that wouldn't be a real
  // entry worth logging).
  @IsInt()
  @Min(-1000)
  @Max(1000)
  points: number;

  @IsString()
  reason: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  date?: string;
}

export class AssignHouseDto {
  // null/omitted clears the student's house assignment.
  @IsString()
  @IsOptional()
  houseId?: string | null;
}
