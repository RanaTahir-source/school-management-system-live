import { IsString, MinLength } from 'class-validator';

// Admin-assisted password reset - no OTP. Most accounts created via the
// Login ID system don't have a real, checked email/phone to send an OTP to,
// so the person who created the account (their Director, or Chairman for a
// Director) sets a new password directly and tells them in person/by phone.
export class ResetUserPasswordDto {
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  newPassword: string;
}
