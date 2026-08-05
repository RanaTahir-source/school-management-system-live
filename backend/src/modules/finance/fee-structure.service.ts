import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertFeeStructureDto } from './dto/upsert-fee-structure.dto';
import { assertSchoolAccess, ScopedUser } from '../../common/utils/school-scope';

@Injectable()
export class FeeStructureService {
  constructor(private readonly prisma: PrismaService) {}

  // Creates or fully replaces the fee-head amounts for one (class, academic year).
  async upsert(dto: UpsertFeeStructureDto, currentUser: ScopedUser) {
    const klass = await this.prisma.class.findFirst({ where: { id: dto.classId, deletedAt: null } });
    if (!klass) throw new NotFoundException('Class not found');
    assertSchoolAccess(currentUser, klass.schoolId);

    const feeHeads = await this.prisma.feeHead.findMany({
      where: { id: { in: dto.items.map((i) => i.feeHeadId) }, deletedAt: null },
    });
    if (feeHeads.length !== new Set(dto.items.map((i) => i.feeHeadId)).size) {
      throw new BadRequestException('One or more fee heads not found');
    }
    if (feeHeads.some((h) => h.schoolId !== klass.schoolId)) {
      throw new BadRequestException('Fee head does not belong to the same school as the class');
    }

    return this.prisma.$transaction(async (tx) => {
      const structure = await tx.feeStructure.upsert({
        where: { classId_academicYearId: { classId: dto.classId, academicYearId: dto.academicYearId } },
        create: { classId: dto.classId, academicYearId: dto.academicYearId },
        update: {},
      });

      await tx.feeStructureItem.deleteMany({ where: { feeStructureId: structure.id } });
      await tx.feeStructureItem.createMany({
        data: dto.items.map((i) => ({
          feeStructureId: structure.id,
          feeHeadId: i.feeHeadId,
          amount: i.amount,
        })),
      });

      return tx.feeStructure.findUnique({
        where: { id: structure.id },
        include: { items: { include: { feeHead: true } } },
      });
    });
  }

  async findForClass(classId: string, academicYearId: string, currentUser: ScopedUser) {
    const klass = await this.prisma.class.findFirst({ where: { id: classId, deletedAt: null } });
    if (!klass) throw new NotFoundException('Class not found');
    assertSchoolAccess(currentUser, klass.schoolId);

    return this.prisma.feeStructure.findUnique({
      where: { classId_academicYearId: { classId, academicYearId } },
      include: { items: { include: { feeHead: true } } },
    });
  }
}
