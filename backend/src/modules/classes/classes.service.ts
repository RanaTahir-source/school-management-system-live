import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClassDto, UpdateClassDto } from './dto/create-class.dto';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateClassDto, currentUser: ScopedUser) {
    assertSchoolAccess(currentUser, dto.schoolId);
    return this.prisma.class.create({
      data: {
        schoolId: dto.schoolId,
        branchId: dto.branchId,
        name: dto.name,
        order: dto.order ?? 0,
        isActive: dto.isActive ?? true,
      },
      include: { school: { select: { id: true, name: true } }, branch: { select: { id: true, name: true } } },
    });
  }

  async findAll(currentUser: ScopedUser, branchId?: string, schoolId?: string) {
    const scopedSchoolId = resolveSchoolScope(currentUser, schoolId);
    return this.prisma.class.findMany({
      where: {
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
        ...(scopedSchoolId ? { schoolId: scopedSchoolId } : {}),
      },
      include: { school: { select: { id: true, name: true } }, branch: { select: { id: true, name: true } } },
      orderBy: { order: 'asc' },
    });
  }

  async findOne(id: string, currentUser: ScopedUser) {
    const klass = await this.prisma.class.findFirst({
      where: { id, deletedAt: null },
      include: { school: { select: { id: true, name: true } }, branch: { select: { id: true, name: true } } },
    });
    if (!klass) throw new NotFoundException('Class not found');
    assertSchoolAccess(currentUser, klass.schoolId);
    return klass;
  }

  async update(id: string, dto: UpdateClassDto, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    return this.prisma.class.update({
      where: { id },
      data: {
        name: dto.name,
        order: dto.order,
        isActive: dto.isActive,
      },
      include: { school: { select: { id: true, name: true } }, branch: { select: { id: true, name: true } } },
    });
  }

  async remove(id: string, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    return this.prisma.class.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
