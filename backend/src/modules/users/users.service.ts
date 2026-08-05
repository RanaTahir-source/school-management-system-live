import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(currentUser: ScopedUser) {
    // undefined schoolId here means "every school" - only true for CHAIRMAN.
    const effectiveSchoolId = resolveSchoolScope(currentUser, undefined);

    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(effectiveSchoolId ? { schoolId: effectiveSchoolId } : {}),
      },
      include: {
        userRoles: { include: { role: true } },
        school: true,
        branch: true,
      },
    });
    return users.map(({ passwordHash, ...safe }) => safe);
  }

  async findOne(id: string, currentUser: ScopedUser) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: {
        userRoles: { include: { role: true } },
        school: true,
        branch: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    assertSchoolAccess(currentUser, user.schoolId);
    const { passwordHash, ...safe } = user;
    return safe;
  }

  // Admin-assisted password reset - no OTP/email needed. A Director can reset
  // anyone in their own school (assertSchoolAccess); a Chairman can reset
  // anyone at all, including a Director (who has no schoolId to scope to).
  // Revokes existing sessions so a leaked/old session can't outlive the reset.
  async resetPassword(id: string, newPassword: string, currentUser: ScopedUser & { userId: string }) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');
    assertSchoolAccess(currentUser, user.schoolId);

    const passwordHash = await bcrypt.hash(newPassword, 10);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id }, data: { passwordHash } });
      await tx.refreshToken.updateMany({
        where: { userId: id, revoked: false },
        data: { revoked: true },
      });
      await tx.auditLog.create({
        data: {
          userId: currentUser.userId,
          schoolId: user.schoolId,
          action: 'PASSWORD_RESET_BY_ADMIN',
          entity: 'User',
          entityId: id,
        },
      });
      const { passwordHash: _omit, ...safe } = updated;
      return safe;
    });
  }

  // Deactivates a login account directly - for staff (Director/Admin/Principal/
  // Accountant/etc.) who aren't behind /students or /teachers. Also revokes
  // any refresh tokens so an active session can't outlive the deactivation.
  async deactivate(id: string, currentUser: ScopedUser & { userId: string }) {
    if (id === currentUser.userId) {
      throw new BadRequestException('You cannot deactivate your own account');
    }
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');
    assertSchoolAccess(currentUser, user.schoolId);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { isActive: false, deletedAt: new Date() },
      });
      await tx.refreshToken.updateMany({
        where: { userId: id, revoked: false },
        data: { revoked: true },
      });
      const { passwordHash, ...safe } = updated;
      return safe;
    });
  }

  // Full replace of a user's role set. Only a Director may grant or revoke
  // the DIRECTOR role itself, so an Admin can't promote themselves (or
  // anyone else) to Director.
  async updateRoles(id: string, roleNames: string[], currentUser: ScopedUser & { userId: string }) {
    if (id === currentUser.userId) {
      throw new BadRequestException('You cannot change your own roles');
    }

    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');
    assertSchoolAccess(currentUser, user.schoolId);

    const normalized = [...new Set(roleNames.map((r) => r.toUpperCase()))];
    const isDirector = currentUser.roles.includes('DIRECTOR');
    if (!isDirector && normalized.includes('DIRECTOR')) {
      throw new ForbiddenException('Only a Director can grant or revoke the Director role');
    }
    const isChairman = currentUser.roles.includes('CHAIRMAN');
    if (!isChairman && normalized.includes('CHAIRMAN')) {
      throw new ForbiddenException('Only a Chairman can grant or revoke the Chairman role');
    }

    const roles = await this.prisma.role.findMany({ where: { name: { in: normalized } } });
    if (roles.length !== normalized.length) {
      const found = new Set(roles.map((r) => r.name));
      const missing = normalized.filter((n) => !found.has(n));
      throw new BadRequestException(`Unknown role(s): ${missing.join(', ')}`);
    }

    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId: id } }),
      this.prisma.userRole.createMany({ data: roles.map((r) => ({ userId: id, roleId: r.id })) }),
    ]);

    await this.prisma.auditLog.create({
      data: {
        userId: currentUser.userId,
        schoolId: user.schoolId,
        action: 'USER_ROLES_UPDATED',
        entity: 'User',
        entityId: id,
        metadata: { roles: normalized },
      },
    });

    return this.findOne(id, currentUser);
  }
}
