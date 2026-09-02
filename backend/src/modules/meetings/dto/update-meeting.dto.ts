import { ArrayUnique, IsArray, IsDateString, IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

const STATUSES = ['SCHEDULED', 'COMPLETED', 'CANCELLED'] as const;

export class UpdateMeetingDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsString()
  agenda?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @IsOptional()
  @IsString()
  minutes?: string;

  // Full replacement of the attendee list (used by the "Edit Details" flow).
  // The dedicated /attendees and /attendees/:userId endpoints remain the
  // preferred way to add/remove a single attendee.
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  attendeeIds?: string[];
}
