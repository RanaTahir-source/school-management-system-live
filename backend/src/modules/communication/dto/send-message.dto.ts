import { ArrayMinSize, IsArray, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class SendMessageDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  recipientIds: string[];

  @IsOptional()
  @IsString()
  subject?: string;

  @IsString()
  @IsNotEmpty()
  body: string;
}
