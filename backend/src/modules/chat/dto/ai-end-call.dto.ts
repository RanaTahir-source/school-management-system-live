import { IsOptional, IsString } from 'class-validator';

export class AiEndCallDto {
  @IsString()
  callId: string;

  @IsOptional() @IsString() transcript?: string;
  @IsOptional() @IsString() summary?: string;
}
