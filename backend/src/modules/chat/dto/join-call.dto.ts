import { IsBoolean, IsOptional } from 'class-validator';

export class JoinCallDto {
  // Milestone 10d - only meaningful when this join actually starts a NEW
  // call (ignored when joining one already in progress, since the notetaker
  // decision was already made by whoever started it).
  @IsOptional() @IsBoolean() withNotetaker?: boolean;
}
