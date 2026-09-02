import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccountHeadDto, UpdateAccountHeadDto } from './dto/create-account-head.dto';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAccountHeadDto, currentUser: ScopedUser) {
    assertSchoolAccess(currentUser, dto.schoolId);
    const existing = await this.prisma.accountHead.findFirst({
      where: { schoolId: dto.schoolId, name: dto.name, deletedAt: null },
    });
    if (existing) throw new ConflictException('An account head with this name already exists');

    if (dto.parentId) {
      const parent = await this.prisma.accountHead.findFirst({ where: { id: dto.parentId, schoolId: dto.schoolId, deletedAt: null } });
      if (!parent) throw new NotFoundException('Parent account head not found in this school');
    }

    return this.prisma.accountHead.create({
      data: {
        schoolId: dto.schoolId,
        name: dto.name,
        code: dto.code,
        type: dto.type,
        parentId: dto.parentId,
      },
    });
  }

  async findAll(currentUser: ScopedUser, schoolId?: string) {
    const scopedSchoolId = resolveSchoolScope(currentUser, schoolId);
    return this.prisma.accountHead.findMany({
      where: { deletedAt: null, ...(scopedSchoolId ? { schoolId: scopedSchoolId } : {}) },
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { children: true, incomeRecords: true, expenseRecords: true } },
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  private async loadOrThrow(id: string, currentUser: ScopedUser) {
    const head = await this.prisma.accountHead.findFirst({ where: { id, deletedAt: null } });
    if (!head) throw new NotFoundException('Account head not found');
    assertSchoolAccess(currentUser, head.schoolId);
    return head;
  }

  async update(id: string, dto: UpdateAccountHeadDto, currentUser: ScopedUser) {
    const head = await this.loadOrThrow(id, currentUser);

    if (dto.parentId) {
      if (dto.parentId === id) throw new BadRequestException('An account head cannot be its own parent');
      const parent = await this.prisma.accountHead.findFirst({ where: { id: dto.parentId, schoolId: head.schoolId, deletedAt: null } });
      if (!parent) throw new NotFoundException('Parent account head not found in this school');
    }

    return this.prisma.accountHead.update({
      where: { id },
      data: {
        name: dto.name,
        code: dto.code,
        type: dto.type,
        parentId: dto.parentId !== undefined ? dto.parentId || null : undefined,
        isActive: dto.isActive,
      },
    });
  }

  // Blocked while anything still points at this head - a silent delete would
  // orphan real income/expense rows or leave a dangling child in the tree.
  async remove(id: string, currentUser: ScopedUser) {
    await this.loadOrThrow(id, currentUser);
    const [children, incomeCount, expenseCount] = await Promise.all([
      this.prisma.accountHead.count({ where: { parentId: id, deletedAt: null } }),
      this.prisma.incomeRecord.count({ where: { accountHeadId: id, deletedAt: null } }),
      this.prisma.expenseRecord.count({ where: { accountHeadId: id, deletedAt: null } }),
    ]);
    if (children > 0) throw new ConflictException('Move or delete its sub-heads first');
    if (incomeCount > 0 || expenseCount > 0) {
      throw new ConflictException('This account head has income/expense records tagged against it - deactivate it instead of deleting');
    }
    return this.prisma.accountHead.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  // Every school MUST be picked explicitly for a financial report - see the
  // identical reasoning in AnalyticsService.resolveSchool.
  private resolveSchool(currentUser: ScopedUser, requestedSchoolId?: string): string {
    const schoolId = resolveSchoolScope(currentUser, requestedSchoolId ?? null);
    if (!schoolId) throw new BadRequestException('Please specify which school this report is for');
    return schoolId;
  }

  // A simple income-statement-style ledger: how much landed against each
  // account head (plus a catch-all for records nobody has tagged yet) in a
  // date range - the formal "Chart of Accounts" report a school asks for
  // once they start using account heads instead of just free-text categories.
  async ledgerSummary(currentUser: ScopedUser, filters: { schoolId?: string; from?: string; to?: string }) {
    const schoolId = this.resolveSchool(currentUser, filters.schoolId);
    const dateFilter =
      filters.from || filters.to
        ? { date: { ...(filters.from ? { gte: new Date(filters.from) } : {}), ...(filters.to ? { lte: new Date(filters.to) } : {}) } }
        : {};

    const [incomeRows, expenseRows, accountHeads] = await Promise.all([
      this.prisma.incomeRecord.groupBy({ by: ['accountHeadId'], where: { schoolId, deletedAt: null, ...dateFilter }, _sum: { amount: true } }),
      this.prisma.expenseRecord.groupBy({ by: ['accountHeadId'], where: { schoolId, deletedAt: null, ...dateFilter }, _sum: { amount: true } }),
      this.prisma.accountHead.findMany({ where: { schoolId, deletedAt: null }, orderBy: [{ type: 'asc' }, { name: 'asc' }] }),
    ]);

    const incomeByHead = new Map<string | null, number>(incomeRows.map((r) => [r.accountHeadId, Number(r._sum.amount ?? 0)]));
    const expenseByHead = new Map<string | null, number>(expenseRows.map((r) => [r.accountHeadId, Number(r._sum.amount ?? 0)]));

    const heads = accountHeads.map((h) => ({
      id: h.id,
      name: h.name,
      code: h.code,
      type: h.type,
      parentId: h.parentId,
      incomeTotal: Math.round(incomeByHead.get(h.id) ?? 0),
      expenseTotal: Math.round(expenseByHead.get(h.id) ?? 0),
    }));

    const unassignedIncome = Math.round(incomeByHead.get(null) ?? 0);
    const unassignedExpense = Math.round(expenseByHead.get(null) ?? 0);
    const totalIncome = Math.round(Array.from(incomeByHead.values()).reduce((a, b) => a + b, 0));
    const totalExpense = Math.round(Array.from(expenseByHead.values()).reduce((a, b) => a + b, 0));

    return {
      generatedAt: new Date().toISOString(),
      range: { from: filters.from ?? null, to: filters.to ?? null },
      totalIncome,
      totalExpense,
      net: totalIncome - totalExpense,
      unassignedIncome,
      unassignedExpense,
      accountHeads: heads,
    };
  }
}
