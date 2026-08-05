import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';
import { buildLoginId, buildAliasEmail } from '../../common/utils/login-id';

const USER_SELECT = { id: true, fullName: true, email: true, loginId: true, isActive: true, schoolId: true } as const;

@Injectable()
export class TeachersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTeacherDto, currentUser: ScopedUser) {
    assertSchoolAccess(currentUser, dto.schoolId);

    if (dto.email) {
      const existingEmail = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (existingEmail) throw new ConflictException('A user with this email already exists');
    }

    const existingEmployeeId = await this.prisma.teacherProfile.findUnique({
      where: { employeeId: dto.employeeId },
    });
    if (existingEmployeeId) throw new ConflictException('This employee ID is already in use');

    const role = await this.prisma.role.findUnique({ where: { name: 'TEACHER' } });
    if (!role) throw new NotFoundException('TEACHER role not found - was the database seeded?');

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
      roleName: 'TEACHER',
    });
    // Readable alternate login (e.g. farzana.jnd@nexoradsa.org) if Director
    // didn't set a real email - both this and loginId work for login.
    const email = dto.email ?? (await buildAliasEmail(this.prisma, { label: dto.fullName, schoolCode: school.code }));

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

      const profile = await tx.teacherProfile.create({
        data: {
          userId: user.id,
          employeeId: dto.employeeId,
          qualification: dto.qualification,
          subjectSpecialty: dto.subjectSpecialty,
          joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : undefined,
          cnic: dto.cnic,
          address: dto.address,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          schoolId: user.schoolId,
          action: 'TEACHER_CREATED',
          entity: 'TeacherProfile',
          entityId: profile.id,
        },
      });

      const { passwordHash: _omit, ...safeUser } = user;
      return { ...profile, user: safeUser };
    });
  }

  async findAll(currentUser: ScopedUser) {
    const effectiveSchoolId = resolveSchoolScope(currentUser, undefined);

    return this.prisma.teacherProfile.findMany({
      where: {
        deletedAt: null,
        ...(effectiveSchoolId ? { user: { schoolId: effectiveSchoolId } } : {}),
      },
      include: { user: { select: USER_SELECT } },
      orderBy: { employeeId: 'asc' },
    });
  }

  async findOne(id: string, currentUser: ScopedUser) {
    const profile = await this.prisma.teacherProfile.findFirst({
      where: { id, deletedAt: null },
      include: { user: { select: USER_SELECT } },
    });
    if (!profile) throw new NotFoundException('Teacher not found');
    assertSchoolAccess(currentUser, profile.user.schoolId);
    return profile;
  }

  async update(id: string, dto: UpdateTeacherDto, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    return this.prisma.teacherProfile.update({ where: { id }, data: dto });
  }

  async remove(id: string, currentUser: ScopedUser) {
    const profile = await this.findOne(id, currentUser);
    // Deactivating the teacher must also lock the underlying login account
    // and kill any active sessions - otherwise a "removed" teacher can still
    // sign in and use the API with whatever access their role/token allows.
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.teacherProfile.update({
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
}
