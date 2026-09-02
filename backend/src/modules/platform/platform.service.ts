import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { OnboardSchoolDto } from './dto/onboard-school.dto';
import { OnboardDirectorDto } from './dto/onboard-director.dto';
import { UpdatePlatformSchoolDto } from './dto/update-platform-school.dto';
import { buildLoginId, nextTenantCode } from '../../common/utils/login-id';

type CurrentUser = { userId: string };

@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

  // Step 1 of the normal onboarding flow: Chairman creates just the
  // Director's login (no school yet). Assigns the Director's own numeric
  // Login ID + their tenantCode - the Director then creates their own
  // school via POST /schools/mine, which reuses that tenantCode.
  async onboardDirector(dto: OnboardDirectorDto, currentUser: CurrentUser) {
    if (dto.email) {
      const existingEmail = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (existingEmail) throw new ConflictException('A user with this email already exists');
    }
    if (dto.phone) {
      const existingPhone = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
      if (existingPhone) throw new ConflictException('A user with this phone number already exists');
    }

    const directorRole = await this.prisma.role.findUnique({ where: { name: 'DIRECTOR' } });
    if (!directorRole) throw new NotFoundException('DIRECTOR role is not seeded - run the database seed first');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const tenantCode = await nextTenantCode(this.prisma);
    const loginId = await buildLoginId(this.prisma, {
      tenantCode,
      schoolSeq: '00',
      branchSeq: '00',
      roleName: 'DIRECTOR',
    });

    const director = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        loginId,
        tenantCode,
        userRoles: { create: { roleId: directorRole.id } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: currentUser.userId,
        action: 'DIRECTOR_ONBOARDED',
        entity: 'User',
        entityId: director.id,
        metadata: { loginId, tenantCode },
      },
    });

    const { passwordHash: _omit, ...safe } = director;
    return safe;
  }

  // Every tenant (school), newest first, with its Director's contact info -
  // this is the Chairman's "who's on the platform" view.
  async listSchools() {
    return this.prisma.school.findMany({
      where: { deletedAt: null },
      include: {
        director: { select: { id: true, fullName: true, email: true, phone: true, isActive: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Creates a brand new tenant in one transaction: the School, its first
  // Director account, the DIRECTOR role grant, then links School.directorId
  // back to the new user. Chairman-only - this is how a new customer/school
  // gets onboarded onto the platform.
  async onboardSchool(dto: OnboardSchoolDto, currentUser: CurrentUser) {
    const [existingCode, existingEmail, directorRole] = await Promise.all([
      this.prisma.school.findUnique({ where: { code: dto.schoolCode } }),
      this.prisma.user.findUnique({ where: { email: dto.directorEmail } }),
      this.prisma.role.findUnique({ where: { name: 'DIRECTOR' } }),
    ]);
    if (existingCode) throw new ConflictException('A school with this code already exists');
    if (existingEmail) throw new ConflictException('A user with this email already exists');
    if (!directorRole) throw new NotFoundException('DIRECTOR role is not seeded - run the database seed first');

    const passwordHash = await bcrypt.hash(dto.directorPassword, 10);

    const { school, director } = await this.prisma.$transaction(async (tx) => {
      const school = await tx.school.create({
        data: {
          name: dto.schoolName,
          code: dto.schoolCode,
          address: dto.schoolAddress,
          phone: dto.schoolPhone,
        },
      });

      const director = await tx.user.create({
        data: {
          fullName: dto.directorFullName,
          email: dto.directorEmail,
          phone: dto.directorPhone,
          passwordHash,
          schoolId: school.id,
          userRoles: { create: { roleId: directorRole.id } },
        },
      });

      await tx.school.update({ where: { id: school.id }, data: { directorId: director.id } });

      return { school, director };
    });

    await this.prisma.auditLog.create({
      data: {
        userId: currentUser.userId,
        schoolId: school.id,
        action: 'SCHOOL_ONBOARDED',
        entity: 'School',
        entityId: school.id,
        metadata: { directorEmail: director.email },
      },
    });

    return this.prisma.school.findUnique({
      where: { id: school.id },
      include: { director: { select: { id: true, fullName: true, email: true, phone: true, isActive: true } } },
    });
  }

  // Chairman-only: edits a tenant's own School row. Deliberately leaves the
  // Director account and isActive untouched - block/unblock has its own
  // endpoints above, and re-assigning a Director is a separate, riskier
  // operation not exposed here.
  async updateSchool(id: string, dto: UpdatePlatformSchoolDto, currentUser: CurrentUser) {
    const school = await this.prisma.school.findFirst({ where: { id, deletedAt: null } });
    if (!school) throw new NotFoundException('School not found');

    if (dto.schoolCode && dto.schoolCode !== school.code) {
      const existingCode = await this.prisma.school.findUnique({ where: { code: dto.schoolCode } });
      if (existingCode) throw new ConflictException('A school with this code already exists');
    }

    const updated = await this.prisma.school.update({
      where: { id },
      data: {
        name: dto.schoolName,
        code: dto.schoolCode,
        address: dto.schoolAddress,
        phone: dto.schoolPhone,
      },
      include: { director: { select: { id: true, fullName: true, email: true, phone: true, isActive: true } } },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: currentUser.userId,
        schoolId: id,
        action: 'SCHOOL_UPDATED',
        entity: 'School',
        entityId: id,
      },
    });

    return updated;
  }

  // Chairman-only: soft-deletes a tenant. The school stops appearing on the
  // Platform list and its Director/staff can no longer log in (same effect
  // as Block, made permanent) - history (fees, results, etc.) is kept, just
  // like every other soft-delete in this codebase.
  async deleteSchool(id: string, currentUser: CurrentUser) {
    const school = await this.prisma.school.findFirst({ where: { id, deletedAt: null } });
    if (!school) throw new NotFoundException('School not found');

    await this.prisma.school.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: currentUser.userId,
        schoolId: id,
        action: 'SCHOOL_DELETED',
        entity: 'School',
        entityId: id,
      },
    });

    return { success: true };
  }

  async setBlocked(id: string, blocked: boolean, currentUser: CurrentUser) {
    const school = await this.prisma.school.findFirst({ where: { id, deletedAt: null } });
    if (!school) throw new NotFoundException('School not found');

    const updated = await this.prisma.school.update({ where: { id }, data: { isActive: !blocked } });

    await this.prisma.auditLog.create({
      data: {
        userId: currentUser.userId,
        schoolId: id,
        action: blocked ? 'SCHOOL_BLOCKED' : 'SCHOOL_UNBLOCKED',
        entity: 'School',
        entityId: id,
      },
    });

    return updated;
  }
}
