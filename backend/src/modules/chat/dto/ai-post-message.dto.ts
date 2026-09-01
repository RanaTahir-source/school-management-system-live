import { IsString, MinLength } from 'class-validator';

export class AiPostMessageDto {
  @IsString()
  callId: string;

  @IsString() @MinLength(1)
  body: string;
}
