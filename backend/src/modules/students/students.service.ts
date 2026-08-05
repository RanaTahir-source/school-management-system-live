import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { MarkStudentLeftDto } from './dto/mark-student-left.dto';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';
import { buildLoginId, buildAliasEmail } from '../../common/utils/login-id';

const USER_SELECT = { id: true, fullName: true, email: true, loginId: true, isActive: true, schoolId: true } as const;

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateStudentDto, currentUser: ScopedUser) {
    assertSchoolAccess(currentUser, dto.schoolId);

    if (dto.email) {
      const existingEmail = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (existingEmail) throw new ConflictException('A user with this email already exists');
    }

    const existingAdmission = await this.prisma.studentProfile.findUnique({
      where: { admissionNo: dto.admissionNo },
    });
    if (existingAdmission) throw new ConflictException('This admission number is already in use');

    const role = await this.prisma.role.findUnique({ where: { name: 'STUDENT' } });
    if (!role) throw new NotFoundException('STUDENT role not found - was the database seeded?');

    const school = await this.prisma.school.findUnique({ where: { id: dto.schoolId } });
    const branch = await this.prisma.branch.findUnique({ where: { id: dto.branchId } });
    if (!school?.tenantCode || !school.schoolSeq || !branch?.branchSeq) {
      throw new BadRequestException(
        'This school/branch has no Login ID codes yet - it predates the Login ID system or was created without them',
      );
    }

    const loginId = await buildLoginId(this.prisma, {
      tenantCode: school.tenantCode,
      schoolSeq: school.schoolSeq,
      branchSeq: branch.branchSeq,
      roleName: 'STUDENT',
    });
    const email =
      dto.email ??
      (await buildAliasEmail(this.prisma, { label: dto.admissionNo, schoolCode: school.code }));

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName: dto.fullName,
          email,
          loginId,
          passwordHash,
          schoolId: dto.schoolId,
          branchId: dto.branchId,
          userRoles: { create: { roleId: role.id } },
        },
      });

      const profile = await tx.studentProfile.create({
        data: {
          userId: user.id,
          admissionNo: dto.admissionNo,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          gender: dto.gender,
          guardianName: dto.guardianName,
          guardianPhone: dto.guardianPhone,
          guardianCnic: dto.guardianCnic,
          address: dto.address,
          sectionId: dto.sectionId,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          schoolId: user.schoolId,
          action: 'STUDENT_CREATED',
          entity: 'StudentProfile',
          entityId: profile.id,
        },
      });

      return this.attachSafeUser(profile, user);
    });
  }

  // status omitted -> only currently-enrolled (ACTIVE) students, matching
  // what every existing caller expects. Pass status='ALL' for every status,
  // or a specific EnrollmentStatus (e.g. 'LEFT') for the alumni/left list.
  async findAll(currentUser: ScopedUser, sectionId?: string, status?: string) {
    const effectiveSchoolId = resolveSchoolScope(currentUser, undefined);

    const profiles = await this.prisma.studentProfile.findMany({
      where: {
        deletedAt: null,
        ...(sectionId ? { sectionId } : {}),
        ...(effectiveSchoolId ? { user: { schoolId: effectiveSchoolId } } : {}),
        ...(status === 'ALL' ? {} : { status: (status as any) || 'ACTIVE' }),
      },
      include: {
        user: { select: USER_SELECT },
        section: { include: { class: true } },
      },
      orderBy: { admissionNo: 'asc' },
    });
    return profiles;
  }

  // A STUDENT-role user has no admin list access, but the mobile/parent app
  // needs a way to resolve "my own studentProfileId" right after login so it
  // can then call the fee/attendance/results endpoints (which already accept
  // a studentId and self-check ownership).
  async findMe(userId: string) {
    const profile = await this.prisma.studentProfile.findFirst({
      where: { userId, deletedAt: null },
      include: {
        user: { select: USER_SELECT },
        section: { include: { class: true } },
      },
    });
    if (!profile) throw new NotFoundException('No student profile is linked to this account');
    return profile;
  }

  async findOne(id: string, currentUser: ScopedUser) {
    const profile = await this.prisma.studentProfile.findFirst({
      where: { id, deletedAt: null },
      include: {
        user: { select: USER_SELECT },
        section: { include: { class: true } },
      },
    });
    if (!profile) throw new NotFoundException('Student not found');
    assertSchoolAccess(currentUser, profile.user.schoolId);
    return profile;
  }

  async update(id: string, dto: UpdateStudentDto, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    return this.prisma.studentProfile.update({
      where: { id },
      data: {
        ...dto,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      },
    });
  }

  async remove(id: string, currentUser: ScopedUser) {
    const profile = await this.findOne(id, currentUser);
    // Deactivating the student must also lock the underlying login account
    // and kill any active sessions - otherwise a "removed" student can still
    // sign in and use the API with whatever access their role/token allows.
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.studentProfile.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });
      await tx.user.update({
        where: { id: profile.userId },
        data: { isActive: false },
      });
      await tx.refreshToken.updateMany({
        where: { userId: profile.userId, revoked: false },
        data: { revoked: true },
      });
      return updated;
    });
  }

  // Records why/when a student left (dropped out, graduated, transferred,
  // expelled) and locks their login - but unlike remove(), does NOT set
  // deletedAt, so fee/attendance/result history and reports still see them,
  // and they show up in the "left students" list (findAll status=LEFT etc.)
  // instead of disappearing entirely.
  async markLeft(id: string, dto: MarkStudentLeftDto, currentUser: ScopedUser & { userId: string }) {
    const profile = await this.findOne(id, currentUser);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.studentProfile.update({
        where: { id },
        data: {
          status: dto.status,
          leftDate: dto.leftDate ? new Date(dto.leftDate) : new Date(),
          leaveReason: dto.leaveReason,
          isActive: false,
        },
      });
      await tx.user.update({ where: { id: profile.userId }, data: { isActive: false } });
      await tx.refreshToken.updateMany({
        where: { userId: profile.userId, revoked: false },
        data: { revoked: true },
      });
      await tx.auditLog.create({
        data: {
          userId: currentUser.userId,
          schoolId: profile.user.schoolId,
          action: 'STUDENT_LEFT',
          entity: 'StudentProfile',
          entityId: id,
          metadata: { status: dto.status, leaveReason: dto.leaveReason },
        },
      });
      return updated;
    });
  }

  // Undoes markLeft() - e.g. a "transfer" fell through and the student is
  // back. Re-enables login too.
  async reactivate(id: string, currentUser: ScopedUser & { userId: string }) {
    const profile = await this.findOne(id, currentUser);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.studentProfile.update({
        where: { id },
        data: { status: 'ACTIVE', leftDate: null, leaveReason: null, isActive: true },
      });
      await tx.user.update({ where: { id: profile.userId }, data: { isActive: true } });
      await tx.auditLog.create({
        data: {
          userId: currentUser.userId,
          schoolId: profile.user.schoolId,
          action: 'STUDENT_REACTIVATED',
          entity: 'StudentProfile',
          entityId: id,
        },
      });
      return updated;
    });
  }

  private attachSafeUser(profile: any, user: any) {
    const { passwordHash, ...safeUser } = user;
    return { ...profile, user: safeUser };
  }
}
