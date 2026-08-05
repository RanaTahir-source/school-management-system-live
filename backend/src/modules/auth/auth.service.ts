import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CommunicationProviderService } from '../communication/communication-provider.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ScopedUser } from '../../common/utils/school-scope';
import { buildLoginId, buildAliasEmail } from '../../common/utils/login-id';

// Roles this endpoint may never grant - CHAIRMAN only ever comes from the
// initial seed, DIRECTOR only from /platform/directors (which also assigns
// the tenantCode everything else depends on). Without this, a DIRECTOR
// calling /auth/signup could grant themselves or anyone else CHAIRMAN/DIRECTOR.
const FORBIDDEN_SIGNUP_ROLES = ['CHAIRMAN', 'DIRECTOR'];

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_DAYS = 7;
const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;

// Generic response for forgot-password so the API never reveals whether an
// email address has an account (prevents user enumeration).
const GENERIC_FORGOT_MESSAGE =
  'If an account exists for this email, a verification code has been sent.';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly communication: CommunicationProviderService,
  ) {}

  // Caller is always a DIRECTOR/ADMIN/CHAIRMAN (enforced by the controller's
  // @Roles guard). A DIRECTOR/ADMIN is now locked to their own school no
  // matter what schoolId they pass - only CHAIRMAN may target a different
  // one (support/setup purposes). Nobody may grant CHAIRMAN or DIRECTOR here.
  async signup(dto: SignupDto, currentUser: ScopedUser) {
    const roleName = dto.roleName.toUpperCase();
    if (FORBIDDEN_SIGNUP_ROLES.includes(roleName)) {
      throw new ForbiddenException(
        `The ${roleName} role cannot be granted here - use the platform onboarding endpoints instead`,
      );
    }

    const isChairman = currentUser.roles.includes('CHAIRMAN');
    const schoolId = isChairman ? dto.schoolId : currentUser.schoolId ?? undefined;
    if (!isChairman && !schoolId) {
      throw new ForbiddenException('Your account is not assigned to a school');
    }
    if (!isChairman && dto.schoolId && dto.schoolId !== currentUser.schoolId) {
      throw new ForbiddenException('You can only create accounts in your own school');
    }

    if (dto.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (existing) throw new ConflictException('A user with this email already exists');
    }

    const role = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      throw new NotFoundException(`Role "${dto.roleName}" does not exist`);
    }

    let loginId: string | undefined;
    let email = dto.email;
    if (schoolId) {
      const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
      const branch = dto.branchId ? await this.prisma.branch.findUnique({ where: { id: dto.branchId } }) : null;
      if (school?.tenantCode && school.schoolSeq) {
        loginId = await buildLoginId(this.prisma, {
          tenantCode: school.tenantCode,
          schoolSeq: school.schoolSeq,
          branchSeq: branch?.branchSeq ?? '00',
          roleName,
        });
        email = email ?? (await buildAliasEmail(this.prisma, { label: dto.fullName, schoolCode: school.code }));
      }
    }
    if (!loginId && !email) {
      throw new BadRequestException('Could not generate a Login ID (school has no Login ID codes) - please provide an email');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        email,
        phone: dto.phone,
        loginId,
        passwordHash,
        schoolId,
        branchId: dto.branchId,
        userRoles: {
          create: { roleId: role.id },
        },
      },
      include: { userRoles: { include: { role: true } } },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        schoolId: user.schoolId,
        action: 'USER_SIGNUP',
        entity: 'User',
        entityId: user.id,
      },
    });

    return this.sanitizeUser(user);
  }

  // dto.email is really "Login ID, phone, or email" - whichever the account
  // has. Checked as an exact match against all three columns; the value is
  // never partial/fuzzy-matched, so this can't be used to enumerate accounts
  // faster than a normal login attempt already would.
  async login(dto: LoginDto, ipAddress?: string) {
    const identifier = dto.email.trim();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ loginId: identifier }, { phone: identifier }, { email: identifier }],
      },
      include: {
        userRoles: { include: { role: true } },
        school: { select: { name: true, code: true, isActive: true, settings: { select: { logoUrl: true } } } },
      },
    });

    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Invalid login ID/phone/email or password');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid login ID/phone/email or password');
    }

    // A Chairman can block a whole school (School.isActive) - this stops
    // every one of that school's users from signing in, even with a correct
    // password. CHAIRMAN accounts themselves have no schoolId, so this never
    // blocks a Chairman.
    if (user.schoolId && user.school && !user.school.isActive) {
      throw new UnauthorizedException('This school has been suspended. Please contact the platform administrator.');
    }

    const tokens = await this.issueTokens(user.id, user.userRoles.map((ur) => ur.role.name), user.schoolId);

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        schoolId: user.schoolId,
        action: 'LOGIN',
        entity: 'User',
        entityId: user.id,
        ipAddress,
      },
    });

    return { user: this.sanitizeUser(user), ...tokens };
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string };
    try {
      payload = this.jwtService.verify(refreshToken, { secret: process.env.JWT_REFRESH_SECRET });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { userId: payload.sub, tokenHash, revoked: false },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token not recognized or expired');
    }

    // Rotate: revoke the old one, issue a new pair
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revoked: true },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { userRoles: { include: { role: true } }, school: { select: { isActive: true } } },
    });
    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('User no longer active');
    }
    if (user.schoolId && user.school && !user.school.isActive) {
      throw new UnauthorizedException('This school has been suspended. Please contact the platform administrator.');
    }

    return this.issueTokens(user.id, user.userRoles.map((ur) => ur.role.name), user.schoolId);
  }

  async logout(userId: string, refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { userId, tokenHash, revoked: false },
      data: { revoked: true },
    });
    return { message: 'Logged out successfully' };
  }

  // Step 1 of password reset: always responds with the same generic message
  // regardless of whether the email exists, so the endpoint can't be used to
  // enumerate valid accounts. A fresh request silently invalidates any
  // earlier unconsumed codes for that user.
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (user && user.isActive && !user.deletedAt) {
      await this.prisma.passwordResetOtp.updateMany({
        where: { userId: user.id, consumed: false },
        data: { consumed: true },
      });

      const otp = crypto.randomInt(100000, 1000000).toString();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + OTP_TTL_MINUTES);

      await this.prisma.passwordResetOtp.create({
        data: { userId: user.id, otpHash: this.hashToken(otp), expiresAt },
      });

      await this.communication.sendEmail(
        dto.email,
        'Password reset code',
        `Your password reset code is ${otp}. It expires in ${OTP_TTL_MINUTES} minutes. ` +
          `If you did not request this, you can ignore this message.`,
        user.schoolId ?? undefined,
      );

      await this.prisma.auditLog.create({
        data: {
          userId: user.id,
          schoolId: user.schoolId,
          action: 'PASSWORD_RESET_REQUESTED',
          entity: 'User',
          entityId: user.id,
        },
      });
    }

    return { message: GENERIC_FORGOT_MESSAGE };
  }

  // Step 2: verify the code and set the new password. Also revokes every
  // existing refresh token for the user, so a leaked/old session can't
  // outlive a password reset.
  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    const record = await this.prisma.passwordResetOtp.findFirst({
      where: { userId: user.id, consumed: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!record || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      throw new UnauthorizedException('Too many attempts. Please request a new code.');
    }

    if (record.otpHash !== this.hashToken(dto.otp)) {
      await this.prisma.passwordResetOtp.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Invalid or expired code');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      this.prisma.passwordResetOtp.update({ where: { id: record.id }, data: { consumed: true } }),
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revoked: false },
        data: { revoked: true },
      }),
    ]);

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        schoolId: user.schoolId,
        action: 'PASSWORD_RESET_COMPLETED',
        entity: 'User',
        entityId: user.id,
      },
    });

    return { message: 'Password has been reset. Please sign in with your new password.' };
  }

  private async issueTokens(userId: string, roles: string[], schoolId: string | null) {
    const accessToken = this.jwtService.sign(
      { sub: userId, roles, schoolId },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: ACCESS_TOKEN_TTL },
    );

    const refreshToken = this.jwtService.sign(
      { sub: userId },
      { secret: process.env.JWT_REFRESH_SECRET, expiresIn: `${REFRESH_TOKEN_TTL_DAYS}d` },
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private sanitizeUser(user: any) {
    const { passwordHash, ...safe } = user;
    return safe;
  }
}
