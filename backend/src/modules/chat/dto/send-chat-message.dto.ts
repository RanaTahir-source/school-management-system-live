import { IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

export class SendChatMessageDto {
  @IsString()
  @MinLength(1)
  body!: string;

  @IsOptional()
  @IsUrl()
  attachmentUrl?: string;
}
