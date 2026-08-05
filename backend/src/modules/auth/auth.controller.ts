import { Body, Controller, Post, Req, UseGuards, Get } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Creates a staff/user account with any role except CHAIRMAN/DIRECTOR. This
  // is NOT public signup - only Director/Admin/Chairman may create accounts
  // (students/teachers/parents have their own dedicated POST /students,
  // /teachers, /parents flows instead). Director/Admin are locked to their
  // own school regardless of what schoolId they pass (enforced in the service).
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DIRECTOR', 'ADMIN', 'CHAIRMAN')
  @Post('signup')
  signup(@Body() dto: SignupDto, @CurrentUser() user: ScopedUser) {
    return this.authService.signup(dto, user);
  }

  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, req.ip);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  // Public: request a 6-digit reset code by email. Always returns the same
  // generic message so the endpoint can't be used to check which emails
  // have accounts.
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  // Public: verify the code and set a new password.
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@CurrentUser() user: { userId: string }, @Body() dto: RefreshTokenDto) {
    return this.authService.logout(user.userId, dto.refreshToken);
  }

  // Simple protected route to prove JWT + RBAC wiring works end-to-end
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: { userId: string; roles: string[] }) {
    return user;
  }
}
