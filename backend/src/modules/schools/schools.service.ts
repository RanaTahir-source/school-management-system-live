import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSchoolDto, UpdateSchoolDto } from './dto/create-school.dto';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';
import { nextSchoolSeq } from '../../common/utils/login-id';

@Injectable()
export class SchoolsService {
  constructor(private readonly prisma: PrismaService) {}

  // Chairman-only escape hatch (e.g. seeding an extra legacy campus for the
  // grandfathered multi-school Director). New tenants should go through
  // createMine() below instead.
  async create(dto: CreateSchoolDto) {
    const existing = await this.prisma.school.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('A school with this code already exists');
    return this.prisma.school.create({ data: dto });
  }

  // Step 2 of onboarding: a Director who was created via /platform/directors
  // (so they have a tenantCode but no school yet) creates their own school.
  // Attaches School.directorId + copies the tenantCode/schoolSeq for Login
  // IDs, and sets the Director's own User.schoolId. The Director's existing
  // access token still has schoolId=null after this call - the frontend
  // must call POST /auth/refresh right after to get a token with the new
  // schoolId (refresh() always re-reads the current schoolId from the DB).
  async createMine(dto: CreateSchoolDto, currentUser: ScopedUser & { userId: string }) {
    if (!currentUser.roles.includes('DIRECTOR')) {
      throw new ForbiddenException('Only a Director can create their own school');
    }
    if (currentUser.schoolId) {
      throw new ConflictException('Your account is already assigned to a school');
    }

    const me = await this.prisma.user.findUnique({ where: { id: currentUser.userId } });
    if (!me?.tenantCode) {
      throw new BadRequestException('Your account has no tenant code assigned - contact the Chairman');
    }

    const existingCode = await this.prisma.school.findUnique({ where: { code: dto.code } });
    if (existingCode) throw new ConflictException('A school with this code already exists');

    const schoolSeq = await nextSchoolSeq(this.prisma, me.tenantCode);

    return this.prisma.$transaction(async (tx) => {
      const school = await tx.school.create({
        data: {
          name: dto.name,
          code: dto.code,
          address: dto.address,
          phone: dto.phone,
          directorId: me.id,
          tenantCode: me.tenantCode,
          schoolSeq,
        },
      });
      await tx.user.update({ where: { id: me.id }, data: { schoolId: school.id } });
      await tx.auditLog.create({
        data: {
          userId: me.id,
          schoolId: school.id,
          action: 'SCHOOL_SELF_CREATED',
          entity: 'School',
          entityId: school.id,
        },
      });
      return school;
    });
  }

  async findAll(currentUser: ScopedUser) {
    const effectiveSchoolId = resolveSchoolScope(currentUser, undefined);

    return this.prisma.school.findMany({
      where: {
        deletedAt: null,
        ...(effectiveSchoolId ? { id: effectiveSchoolId } : {}),
      },
      include: { branches: { where: { deletedAt: null }, orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, currentUser: ScopedUser) {
    const school = await this.prisma.school.findFirst({
      where: { id, deletedAt: null },
      include: { branches: { where: { deletedAt: null }, orderBy: { name: 'asc' } } },
    });
    if (!school) throw new NotFoundException('School not found');
    assertSchoolAccess(currentUser, school.id);
    return school;
  }

  async update(id: string, dto: UpdateSchoolDto, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    return this.prisma.school.update({ where: { id }, data: dto });
  }

  async remove(id: string, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    return this.prisma.school.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }
}
