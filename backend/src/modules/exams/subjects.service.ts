import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubjectDto, UpdateSubjectDto } from './dto/create-subject.dto';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSubjectDto, currentUser: ScopedUser) {
    assertSchoolAccess(currentUser, dto.schoolId);

    const existing = await this.prisma.subject.findFirst({
      where: { schoolId: dto.schoolId, name: dto.name, deletedAt: null },
    });
    if (existing) throw new ConflictException('This subject already exists for this school');

    return this.prisma.subject.create({
      data: { schoolId: dto.schoolId, name: dto.name, code: dto.code },
    });
  }

  findAll(currentUser: ScopedUser, schoolId?: string) {
    const scopedSchoolId = resolveSchoolScope(currentUser, schoolId);
    return this.prisma.subject.findMany({
      where: { deletedAt: null, ...(scopedSchoolId ? { schoolId: scopedSchoolId } : {}) },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, currentUser: ScopedUser) {
    const subject = await this.prisma.subject.findFirst({ where: { id, deletedAt: null } });
    if (!subject) throw new NotFoundException('Subject not found');
    assertSchoolAccess(currentUser, subject.schoolId);
    return subject;
  }

  async update(id: string, dto: UpdateSubjectDto, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    return this.prisma.subject.update({ where: { id }, data: dto });
  }

  async remove(id: string, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    return this.prisma.subject.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }
}
