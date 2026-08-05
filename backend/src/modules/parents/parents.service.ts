import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateParentDto } from './dto/create-parent.dto';
import { UpdateParentDto } from './dto/update-parent.dto';
import { LinkChildDto } from './dto/link-child.dto';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';
import { buildLoginId, buildAliasEmail } from '../../common/utils/login-id';

const CHILD_INCLUDE = {
  children: {
    include: {
      student: { select: { id: true, admissionNo: true, user: { select: { fullName: true } } } },
    },
  },
} as const;

@Injectable()
export class ParentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateParentDto, currentUser: ScopedUser) {
    assertSchoolAccess(currentUser, dto.schoolId);

    if (dto.email) {
      const existingEmail = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (existingEmail) throw new ConflictException('A user with this email already exists');
    }

    const role = await this.prisma.role.findUnique({ where: { name: 'PARENT' } });
    if (!role) throw new NotFoundException('PARENT role not found - was the database seeded?');

    const school = await this.prisma.school.findUnique({ where: { id: dto.schoolId } });
    if (!school?.tenantCode || !school.schoolSeq) {
      throw new BadRequestException(
        'This school has no Login ID codes yet - it predates the Login ID system or was created without them',
      );
    }
    const branch = dto.branchId ? await this.prisma.branch.findUnique({ where: { id: dto.branchId } }) : null;
    const branchSeq = branch?.branchSeq ?? '00'; // parents aren't tied to one branch, "00" = school-wide

    const loginId = await buildLoginId(this.prisma, {
      tenantCode: school.tenantCode,
      schoolSeq: school.schoolSeq,
      branchSeq,
      roleName: 'PARENT',
    });
    const email =
      dto.email ?? (await buildAliasEmail(this.prisma, { label: dto.fullName, schoolCode: school.code }));

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        email,
        loginId,
        phone: dto.phone,
        passwordHash,
        schoolId: dto.schoolId,
        branchId: dto.branchId,
        userRoles: { create: { roleId: role.id } },
      },
      include: CHILD_INCLUDE,
    });

    const { passwordHash: _omit, ...safe } = user;
    return safe;
  }

  async update(id: string, dto: UpdateParentDto, currentUser: ScopedUser) {
    await this.findParentOrThrow(id, currentUser);
    const updated = await this.prisma.user.update({
      where: { id },
      data: { fullName: dto.fullName, phone: dto.phone },
      include: CHILD_INCLUDE,
    });
    const { passwordHash, ...safe } = updated;
    return safe;
  }

  // Deactivates the parent's login and kills any active sessions - does not
  // touch their children's own records or ParentStudent links (kept intact
  // in case the account is reactivated later).
  async remove(id: string, currentUser: ScopedUser) {
    await this.findParentOrThrow(id, currentUser);
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

  async findAll(currentUser: ScopedUser, schoolId?: string) {
    const effectiveSchoolId = resolveSchoolScope(currentUser, schoolId);

    const parents = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        userRoles: { some: { role: { name: 'PARENT' } } },
        ...(effectiveSchoolId ? { schoolId: effectiveSchoolId } : {}),
      },
      include: CHILD_INCLUDE,
      orderBy: { fullName: 'asc' },
    });
    return parents.map(({ passwordHash, ...safe }) => safe);
  }

  async linkChild(parentId: string, dto: LinkChildDto, currentUser: ScopedUser) {
    const parent = await this.findParentOrThrow(parentId, currentUser);

    const student = await this.prisma.studentProfile.findFirst({
      where: { id: dto.studentId, deletedAt: null },
      include: { user: { select: { schoolId: true } } },
    });
    if (!student) throw new NotFoundException('Student not found');
    if (student.user.schoolId !== parent.schoolId) {
      throw new ConflictException('This student belongs to a different school than the parent');
    }

    const existing = await this.prisma.parentStudent.findUnique({
      where: { parentId_studentId: { parentId, studentId: dto.studentId } },
    });
    if (existing) throw new ConflictException('This child is already linked to this parent');

    return this.prisma.parentStudent.create({
      data: { parentId, studentId: dto.studentId, relation: dto.relation },
    });
  }

  async unlinkChild(parentId: string, studentId: string, currentUser: ScopedUser) {
    await this.findParentOrThrow(parentId, currentUser);
    const link = await this.prisma.parentStudent.findUnique({
      where: { parentId_studentId: { parentId, studentId } },
    });
    if (!link) throw new NotFoundException('This child is not linked to this parent');
    await this.prisma.parentStudent.delete({ where: { id: link.id } });
    return { success: true };
  }

  private async findParentOrThrow(parentId: string, currentUser: ScopedUser) {
    const parent = await this.prisma.user.findFirst({
      where: { id: parentId, deletedAt: null, userRoles: { some: { role: { name: 'PARENT' } } } },
    });
    if (!parent) throw new NotFoundException('Parent account not found');
    assertSchoolAccess(currentUser, parent.schoolId);
    return parent;
  }
}
