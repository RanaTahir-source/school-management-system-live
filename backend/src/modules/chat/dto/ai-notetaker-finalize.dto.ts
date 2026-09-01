import { IsString, MinLength } from 'class-validator';

export class AiNotetakerFinalizeDto {
  @IsString()
  callId: string;

  @IsString() @MinLength(1)
  transcript: string;

  @IsString() @MinLength(1)
  summary: string;
}
