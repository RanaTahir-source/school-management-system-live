import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto, UpdateBranchDto } from './dto/create-branch.dto';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';
import { nextBranchSeq } from '../../common/utils/login-id';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBranchDto, currentUser: ScopedUser) {
    assertSchoolAccess(currentUser, dto.schoolId);
    const branchSeq = await nextBranchSeq(this.prisma, dto.schoolId);
    return this.prisma.branch.create({
      data: { schoolId: dto.schoolId, name: dto.name, genderScope: dto.genderScope, branchSeq },
    });
  }

  findAll(currentUser: ScopedUser, schoolId?: string) {
    const scopedSchoolId = resolveSchoolScope(currentUser, schoolId);
    return this.prisma.branch.findMany({
      where: { deletedAt: null, ...(scopedSchoolId ? { schoolId: scopedSchoolId } : {}) },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, currentUser: ScopedUser) {
    const branch = await this.prisma.branch.findFirst({ where: { id, deletedAt: null } });
    if (!branch) throw new NotFoundException('Branch not found');
    assertSchoolAccess(currentUser, branch.schoolId);
    return branch;
  }

  async update(id: string, dto: UpdateBranchDto, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    return this.prisma.branch.update({ where: { id }, data: dto });
  }

  async remove(id: string, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    return this.prisma.branch.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }
}
