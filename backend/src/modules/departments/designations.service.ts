import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDesignationDto, UpdateDesignationDto } from './dto/create-designation.dto';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';

@Injectable()
export class DesignationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertDepartmentBelongsToSchool(departmentId: string, schoolId: string) {
    const dept = await this.prisma.department.findFirst({ where: { id: departmentId, deletedAt: null } });
    if (!dept || dept.schoolId !== schoolId) {
      throw new NotFoundException('Department not found for this school');
    }
  }

  async create(dto: CreateDesignationDto, currentUser: ScopedUser) {
    assertSchoolAccess(currentUser, dto.schoolId);
    if (dto.departmentId) {
      await this.assertDepartmentBelongsToSchool(dto.departmentId, dto.schoolId);
    }
    const existing = await this.prisma.designation.findFirst({
      where: { schoolId: dto.schoolId, name: dto.name, deletedAt: null },
    });
    if (existing) throw new ConflictException('A designation with this name already exists');
    return this.prisma.designation.create({
      data: { schoolId: dto.schoolId, name: dto.name, departmentId: dto.departmentId },
    });
  }

  async findAll(currentUser: ScopedUser, schoolId?: string, departmentId?: string) {
    const scopedSchoolId = resolveSchoolScope(currentUser, schoolId);
    return this.prisma.designation.findMany({
      where: {
        deletedAt: null,
        ...(scopedSchoolId ? { schoolId: scopedSchoolId } : {}),
        ...(departmentId ? { departmentId } : {}),
      },
      include: { department: { select: { id: true, name: true } }, _count: { select: { staff: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, currentUser: ScopedUser) {
    const designation = await this.prisma.designation.findFirst({
      where: { id, deletedAt: null },
      include: { department: { select: { id: true, name: true } } },
    });
    if (!designation) throw new NotFoundException('Designation not found');
    assertSchoolAccess(currentUser, designation.schoolId);
    return designation;
  }

  async update(id: string, dto: UpdateDesignationDto, currentUser: ScopedUser) {
    const designation = await this.findOne(id, currentUser);
    if (dto.departmentId) {
      await this.assertDepartmentBelongsToSchool(dto.departmentId, designation.schoolId);
    }
    return this.prisma.designation.update({
      where: { id },
      data: { name: dto.name, departmentId: dto.departmentId, isActive: dto.isActive },
    });
  }

  async remove(id: string, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    return this.prisma.designation.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
