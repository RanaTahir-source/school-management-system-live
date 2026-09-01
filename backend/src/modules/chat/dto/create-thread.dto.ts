import { ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

const TYPES = ['STAFF_GROUP', 'BROADCAST'] as const; // DIRECT and CLASS_GROUP have their own dedicated endpoints

export class CreateThreadDto {
  @IsUUID()
  schoolId!: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsIn(TYPES)
  type!: (typeof TYPES)[number];

  @IsString()
  @MinLength(2)
  title!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  memberIds!: string[];

  @IsOptional()
  @IsBoolean()
  postingRestricted?: boolean;
}
