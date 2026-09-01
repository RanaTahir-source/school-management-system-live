import { ArrayMinSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class AddAttendeesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  attendeeIds!: string[];
}
