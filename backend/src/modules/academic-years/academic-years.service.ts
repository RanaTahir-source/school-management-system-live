import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAcademicYearDto, UpdateAcademicYearDto } from './dto/create-academic-year.dto';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';

@Injectable()
export class AcademicYearsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAcademicYearDto, currentUser: ScopedUser) {
    assertSchoolAccess(currentUser, dto.schoolId);
    return this.prisma.academicYear.create({
      data: {
        schoolId: dto.schoolId,
        name: dto.name,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findAll(currentUser: ScopedUser, schoolId?: string) {
    const scopedSchoolId = resolveSchoolScope(currentUser, schoolId);
    return this.prisma.academicYear.findMany({
      where: { deletedAt: null, ...(scopedSchoolId ? { schoolId: scopedSchoolId } : {}) },
      include: { school: { select: { id: true, name: true, code: true } } },
      orderBy: { name: 'desc' },
    });
  }

  async findOne(id: string, currentUser: ScopedUser) {
    const year = await this.prisma.academicYear.findFirst({
      where: { id, deletedAt: null },
      include: { school: { select: { id: true, name: true, code: true } } },
    });
    if (!year) throw new NotFoundException('Academic year not found');
    assertSchoolAccess(currentUser, year.schoolId);
    return year;
  }

  async update(id: string, dto: UpdateAcademicYearDto, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    return this.prisma.academicYear.update({
      where: { id },
      data: {
        name: dto.name,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        isActive: dto.isActive,
      },
    });
  }

  async remove(id: string, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    return this.prisma.academicYear.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
