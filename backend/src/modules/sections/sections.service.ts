import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSectionDto, UpdateSectionDto } from './dto/create-section.dto';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';

const SECTION_INCLUDE = {
  class: { select: { id: true, name: true, schoolId: true } },
  academicYear: { select: { id: true, name: true } },
  classTeacher: { select: { id: true, fullName: true, email: true } },
  students: { select: { id: true, admissionNo: true, user: { select: { fullName: true } } } },
} as const;

@Injectable()
export class SectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSectionDto, currentUser: ScopedUser) {
    const klass = await this.prisma.class.findFirst({ where: { id: dto.classId, deletedAt: null } });
    if (!klass) throw new NotFoundException('Class not found');
    assertSchoolAccess(currentUser, klass.schoolId);

    return this.prisma.section.create({
      data: {
        classId: dto.classId,
        academicYearId: dto.academicYearId,
        name: dto.name,
        capacity: dto.capacity,
        classTeacherId: dto.classTeacherId,
        isActive: dto.isActive ?? true,
      },
      include: SECTION_INCLUDE,
    });
  }

  async findAll(currentUser: ScopedUser, classId?: string, academicYearId?: string) {
    const effectiveSchoolId = resolveSchoolScope(currentUser, undefined);

    return this.prisma.section.findMany({
      where: {
        deletedAt: null,
        ...(classId ? { classId } : {}),
        ...(academicYearId ? { academicYearId } : {}),
        ...(effectiveSchoolId ? { class: { schoolId: effectiveSchoolId } } : {}),
      },
      include: SECTION_INCLUDE,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, currentUser: ScopedUser) {
    const section = await this.prisma.section.findFirst({
      where: { id, deletedAt: null },
      include: SECTION_INCLUDE,
    });
    if (!section) throw new NotFoundException('Section not found');
    assertSchoolAccess(currentUser, section.class.schoolId);
    return section;
  }

  async update(id: string, dto: UpdateSectionDto, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    return this.prisma.section.update({
      where: { id },
      data: {
        name: dto.name,
        capacity: dto.capacity,
        classTeacherId: dto.classTeacherId,
        isActive: dto.isActive,
      },
      include: SECTION_INCLUDE,
    });
  }

  async remove(id: string, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    return this.prisma.section.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async assignTeacher(id: string, teacherId: string, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);

    const teacher = await this.prisma.user.findFirst({
      where: { id: teacherId, deletedAt: null, isActive: true },
      include: { userRoles: { include: { role: true } } },
    });
    if (!teacher) throw new NotFoundException('Teacher user not found');
    const hasTeacherRole = teacher.userRoles.some((ur) => ur.role.name === 'TEACHER');
    if (!hasTeacherRole) {
      throw new BadRequestException('This user does not hold the TEACHER role');
    }

    return this.prisma.section.update({
      where: { id },
      data: { classTeacherId: teacherId },
      include: SECTION_INCLUDE,
    });
  }
}
