import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

// Chairman-only: edits a tenant's own School row (name/code/address/phone).
// Deliberately does NOT touch the Director account or isActive - the
// director's login is a separate concern, and blocking/unblocking already
// has its own dedicated endpoints (see PlatformController.block/unblock).
export class UpdatePlatformSchoolDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  schoolName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  schoolCode?: string;

  @IsOptional()
  @IsString()
  schoolAddress?: string;

  @IsOptional()
  @IsString()
  schoolPhone?: string;
}
