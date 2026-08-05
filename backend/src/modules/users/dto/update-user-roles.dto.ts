import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class UpdateUserRolesDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'A user must have at least one role' })
  @IsString({ each: true })
  roleNames: string[];
}
