import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  // Kept as "email" for backward compatibility with the already-deployed
  // web/mobile apps (they already POST { email, password }) - but no longer
  // @IsEmail()-validated, because this now also accepts a numeric Login ID
  // (e.g. "020101060001") or a phone number. See AuthService.login(), which
  // checks all three columns.
  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}
