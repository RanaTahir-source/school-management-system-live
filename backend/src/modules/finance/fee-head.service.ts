import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeeHeadDto } from './dto/create-fee-head.dto';
import { UpdateFeeHeadDto } from './dto/update-fee-head.dto';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';

@Injectable()
export class FeeHeadService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateFeeHeadDto, currentUser: ScopedUser) {
    assertSchoolAccess(currentUser, dto.schoolId);
    return this.prisma.feeHead.create({
      data: {
        schoolId: dto.schoolId,
        name: dto.name,
        isMonthly: dto.isMonthly ?? true,
      },
    });
  }

  findAll(currentUser: ScopedUser, schoolId?: string) {
    const scopedSchoolId = resolveSchoolScope(currentUser, schoolId);
    return this.prisma.feeHead.findMany({
      where: {
        deletedAt: null,
        ...(scopedSchoolId ? { schoolId: scopedSchoolId } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, currentUser: ScopedUser) {
    const head = await this.prisma.feeHead.findFirst({ where: { id, deletedAt: null } });
    if (!head) throw new NotFoundException('Fee head not found');
    assertSchoolAccess(currentUser, head.schoolId);
    return head;
  }

  async update(id: string, dto: UpdateFeeHeadDto, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    return this.prisma.feeHead.update({ where: { id }, data: dto });
  }

  async remove(id: string, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    return this.prisma.feeHead.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
