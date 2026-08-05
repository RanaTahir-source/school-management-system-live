import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';

@Injectable()
export class ExpenseService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateExpenseDto, currentUser: ScopedUser & { userId: string }) {
    assertSchoolAccess(currentUser, dto.schoolId);
    return this.prisma.expenseRecord.create({
      data: {
        schoolId: dto.schoolId,
        branchId: dto.branchId,
        category: dto.category,
        amount: dto.amount,
        date: new Date(dto.date),
        description: dto.description,
        recordedById: currentUser.userId,
      },
    });
  }

  findAll(
    currentUser: ScopedUser,
    filters: { schoolId?: string; branchId?: string; category?: string; from?: string; to?: string },
  ) {
    const schoolId = resolveSchoolScope(currentUser, filters.schoolId);
    const { branchId, category, from, to } = filters;
    return this.prisma.expenseRecord.findMany({
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
    const record = await this.prisma.expenseRecord.findFirst({ where: { id, deletedAt: null } });
    if (!record) throw new NotFoundException('Expense record not found');
    assertSchoolAccess(currentUser, record.schoolId);
    return record;
  }

  // Same lookup, but with the relations a printable voucher needs (school
  // name, branch name, who recorded it).
  async findOneWithRelations(id: string, currentUser: ScopedUser) {
    const record = await this.prisma.expenseRecord.findFirst({
      where: { id, deletedAt: null },
      include: { school: true, branch: true, recordedBy: true },
    });
    if (!record) throw new NotFoundException('Expense record not found');
    assertSchoolAccess(currentUser, record.schoolId);
    return record;
  }

  // Expense records tagged as a purchase (mirrors the old VFP "purchase"
  // report) - matched by category text, same approach as security deposits
  // on the income side, since there's no dedicated line-item purchase model.
  async findPurchases(currentUser: ScopedUser, schoolIdFilter?: string) {
    const schoolId = resolveSchoolScope(currentUser, schoolIdFilter);
    return this.prisma.expenseRecord.findMany({
      where: {
        deletedAt: null,
        category: { contains: 'purchase', mode: 'insensitive' },
        ...(schoolId ? { schoolId } : {}),
      },
      include: { school: true, branch: true, recordedBy: true },
      orderBy: { date: 'desc' },
    });
  }

  async update(id: string, dto: UpdateExpenseDto, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    return this.prisma.expenseRecord.update({
      where: { id },
      data: {
        ...dto,
        date: dto.date ? new Date(dto.date) : undefined,
      },
    });
  }

  async remove(id: string, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    return this.prisma.expenseRecord.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
