import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/create-department.dto';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDepartmentDto, currentUser: ScopedUser) {
    assertSchoolAccess(currentUser, dto.schoolId);
    const existing = await this.prisma.department.findFirst({
      where: { schoolId: dto.schoolId, name: dto.name, deletedAt: null },
    });
    if (existing) throw new ConflictException('A department with this name already exists');
    return this.prisma.department.create({
      data: {
        schoolId: dto.schoolId,
        name: dto.name,
        description: dto.description,
        headOfDepartmentId: dto.headOfDepartmentId,
      },
    });
  }

  async findAll(currentUser: ScopedUser, schoolId?: string) {
    const scopedSchoolId = resolveSchoolScope(currentUser, schoolId);
    return this.prisma.department.findMany({
      where: { deletedAt: null, ...(scopedSchoolId ? { schoolId: scopedSchoolId } : {}) },
      include: {
        headOfDepartment: { select: { id: true, fullName: true } },
        _count: { select: { designations: true, staff: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, currentUser: ScopedUser) {
    const dept = await this.prisma.department.findFirst({
      where: { id, deletedAt: null },
      include: {
        headOfDepartment: { select: { id: true, fullName: true } },
        designations: { where: { deletedAt: null }, orderBy: { name: 'asc' } },
      },
    });
    if (!dept) throw new NotFoundException('Department not found');
    assertSchoolAccess(currentUser, dept.schoolId);
    return dept;
  }

  async update(id: string, dto: UpdateDepartmentDto, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    return this.prisma.department.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        headOfDepartmentId: dto.headOfDepartmentId,
        isActive: dto.isActive,
      },
    });
  }

  async remove(id: string, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    return this.prisma.department.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
