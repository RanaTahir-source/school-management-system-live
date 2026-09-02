import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

// Edits a staff account's own profile fields (fullName/email/phone/school/
// branch) - separate from PATCH /:id/roles, which only touches roleNames.
// Like the rest of this codebase's partial updates, an omitted field leaves
// the current value untouched (Prisma ignores `undefined` on update).
export class UpdateStaffProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  fullName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  schoolId?: string;

  @IsOptional()
  @IsString()
  branchId?: string;
}
