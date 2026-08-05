import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIncomeDto } from './dto/create-income.dto';
import { UpdateIncomeDto } from './dto/update-income.dto';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';

@Injectable()
export class IncomeService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateIncomeDto, currentUser: ScopedUser & { userId: string }) {
    assertSchoolAccess(currentUser, dto.schoolId);
    return this.prisma.incomeRecord.create({
      data: {
        schoolId: dto.schoolId,
        branchId: dto.branchId,
        studentId: dto.studentId,
        category: dto.category,
        amount: dto.amount,
        date: new Date(dto.date),
        description: dto.description,
        receivedById: currentUser.userId,
      },
    });
  }

  findAll(
    currentUser: ScopedUser,
    filters: { schoolId?: string; branchId?: string; category?: string; from?: string; to?: string },
  ) {
    const schoolId = resolveSchoolScope(currentUser, filters.schoolId);
    const { branchId, category, from, to } = filters;
    return this.prisma.incomeRecord.findMany({
      where: {
        deletedAt: null,
        ...(schoolId ? { schoolId } : {}),
        ...(branchId ? { branchId } : {}),
        ...(category ? { category } : {}),
        ...(from || to
          ? {
              date: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(id: string, currentUser: ScopedUser) {
    const record = await this.prisma.incomeRecord.findFirst({ where: { id, deletedAt: null } });
    if (!record) throw new NotFoundException('Income record not found');
    assertSchoolAccess(currentUser, record.schoolId);
    return record;
  }

  // Same lookup, but with the relations a printable voucher needs (school
  // name, branch name, who received it, which student if it's a fee row).
  async findOneWithRelations(id: string, currentUser: ScopedUser) {
    const record = await this.prisma.incomeRecord.findFirst({
      where: { id, deletedAt: null },
      include: { school: true, branch: true, receivedBy: true, student: { include: { user: true } } },
    });
    if (!record) throw new NotFoundException('Income record not found');
    assertSchoolAccess(currentUser, record.schoolId);
    return record;
  }

  // Income records tagged as a security deposit (mirrors the old VFP
  // "security" report) - matched by category text since there's no
  // dedicated deposit type column; the accountant enters "Security Deposit"
  // (or similar) as the category when recording one.
  async findSecurityDeposits(currentUser: ScopedUser, schoolIdFilter?: string) {
    const schoolId = resolveSchoolScope(currentUser, schoolIdFilter);
    return this.prisma.incomeRecord.findMany({
      where: {
        deletedAt: null,
        category: { contains: 'security', mode: 'insensitive' },
        ...(schoolId ? { schoolId } : {}),
      },
      include: {
        school: true,
        branch: true,
        student: { include: { user: true } },
        receivedBy: true,
      },
      orderBy: { date: 'desc' },
    });
  }

  async update(id: string, dto: UpdateIncomeDto, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    return this.prisma.incomeRecord.update({
      where: { id },
      data: {
        ...dto,
        date: dto.date ? new Date(dto.date) : undefined,
      },
    });
  }

  async remove(id: string, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    return this.prisma.incomeRecord.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
