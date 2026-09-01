import { ArrayMinSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class AddThreadMembersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  memberIds!: string[];
}
