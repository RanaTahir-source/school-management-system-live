import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';
import { buildLoginId, buildAliasEmail } from '../../common/utils/login-id';
import { buildExcelTemplate, BulkImportSummary } from '../../common/utils/excel-import';
import { savePersonPhoto } from '../../common/utils/photo-storage';

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

  // Same overwrite-by-id pattern as StudentsService.uploadPhoto().
  async uploadPhoto(id: string, file: Express.Multer.File, currentUser: ScopedUser) {
    const profile = await this.findOne(id, currentUser);
    const ext = (file.originalname.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const fileKey = savePersonPhoto('photos/teachers', `${profile.id}.${ext}`, file.buffer);
    return this.prisma.teacherProfile.update({ where: { id }, data: { photoUrl: fileKey } });
  }

  async buildImportTemplate(): Promise<Buffer> {
    return buildExcelTemplate([
      { header: 'Full Name', example: 'Ayesha Khan' },
      { header: 'Employee ID', example: 'JND-T-045' },
      { header: 'Qualification', example: 'B.Ed' },
      { header: 'Subject Specialty', example: 'Mathematics' },
      { header: 'Joining Date', example: '2026-08-01' },
      { header: 'CNIC', example: '35201-1234567-1' },
      { header: 'Address', example: 'Street 4, Jandanwala' },
      { header: 'Email', example: '(leave blank to auto-generate)' },
      { header: 'Password', example: '(leave blank for default ChangeMe123!)' },
    ]);
  }

  // Same row-by-row, one-bad-row-doesn't-block-the-rest pattern as
  // StudentsService.bulkImport() - see the comment there for the reasoning.
  async bulkImport(
    rows: Record<string, any>[],
    schoolId: string,
    branchId: string,
    currentUser: ScopedUser & { userId: string },
  ): Promise<BulkImportSummary> {
    assertSchoolAccess(currentUser, schoolId);

    const role = await this.prisma.role.findUnique({ where: { name: 'TEACHER' } });
    if (!role) throw new NotFoundException('TEACHER role not found - was the database seeded?');

    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, schoolId } });
    if (!branch) throw new BadRequestException('That branch does not belong to the selected school');
    if (!school?.tenantCode || !school.schoolSeq || !branch.branchSeq) {
      throw new BadRequestException(
        'This school/branch has no Login ID codes yet - it predates the Login ID system or was created without them',
      );
    }

    const results: BulkImportSummary['results'] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2;
      const r = rows[i];
      const employeeId = String(r.employeeId ?? '').trim();
      try {
        const fullName = String(r.fullName ?? '').trim();
        if (!fullName) throw new Error('Full Name is required');
        if (!employeeId) throw new Error('Employee ID is required');

        const existingEmployeeId = await this.prisma.teacherProfile.findUnique({ where: { employeeId } });
        if (existingEmployeeId) throw new Error(`Employee ID "${employeeId}" already exists`);

        let email: string | undefined = r.email ? String(r.email).trim() : undefined;
        if (email) {
          const existingEmail = await this.prisma.user.findUnique({ where: { email } });
          if (existingEmail) throw new Error(`Email "${email}" is already in use`);
        }

        const loginId = await buildLoginId(this.prisma, {
          tenantCode: school.tenantCode,
          schoolSeq: school.schoolSeq,
          branchSeq: branch.branchSeq,
          roleName: 'TEACHER',
        });
        const finalEmail = email ?? (await buildAliasEmail(this.prisma, { label: fullName, schoolCode: school.code }));
        const rawPassword = r.password ? String(r.password) : 'ChangeMe123!';
        const passwordHash = await bcrypt.hash(rawPassword, 10);

        await this.prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              fullName,
              email: finalEmail,
              loginId,
              passwordHash,
              schoolId,
              branchId,
              userRoles: { create: { roleId: role.id } },
            },
          });
          const profile = await tx.teacherProfile.create({
            data: {
              userId: user.id,
              employeeId,
              qualification: r.qualification ? String(r.qualification) : undefined,
              subjectSpecialty: r.subjectSpecialty ? String(r.subjectSpecialty) : undefined,
              joiningDate: r.joiningDate ? new Date(r.joiningDate) : undefined,
              cnic: r.cnic ? String(r.cnic) : undefined,
              address: r.address ? String(r.address) : undefined,
            },
          });
          await tx.auditLog.create({
            data: {
              userId: currentUser.userId,
              schoolId,
              action: 'TEACHER_CREATED',
              entity: 'TeacherProfile',
              entityId: profile.id,
              metadata: { via: 'bulk-import', loginId },
            },
          });
        });

        results.push({ row: rowNum, status: 'created', identifier: employeeId, message: `Login ID: ${loginId}` });
      } catch (e: any) {
        results.push({ row: rowNum, status: 'error', identifier: employeeId || undefined, message: e?.message ?? 'Unknown error' });
      }
    }

    return {
      total: rows.length,
      created: results.filter((r) => r.status === 'created').length,
      failed: results.filter((r) => r.status === 'error').length,
      results,
    };
  }
}
