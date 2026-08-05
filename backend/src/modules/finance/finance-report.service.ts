import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';

type Side = {
  total: number;
  byCategory: { category: string; amount: number }[];
  byBranch: {
    branchId: string | null;
    branchName: string;
    total: number;
    byCategory: { category: string; amount: number }[];
  }[];
};

@Injectable()
export class FinanceReportService {
  constructor(private readonly prisma: PrismaService) {}

  // Monthly (or any date-range) report: total received/spent per "mad" (category),
  // broken down branch-wise, for a school - the standard income vs. expense sheet.
  async report(currentUser: ScopedUser, schoolId: string, from: string, to: string) {
    if (!schoolId || !from || !to) {
      throw new BadRequestException('"schoolId", "from" and "to" query params are required');
    }
    assertSchoolAccess(currentUser, schoolId);

    const school = await this.prisma.school.findFirst({ where: { id: schoolId, deletedAt: null } });
    if (!school) throw new NotFoundException('School not found');

    const branches = await this.prisma.branch.findMany({
      where: { schoolId, deletedAt: null },
      select: { id: true, name: true },
    });
    const branchNameById = new Map(branches.map((b) => [b.id, b.name]));

    const range = { gte: new Date(from), lte: new Date(to) };

    const [incomeRecords, expenseRecords] = await Promise.all([
      this.prisma.incomeRecord.findMany({
        where: { schoolId, deletedAt: null, date: range },
        select: { branchId: true, category: true, amount: true },
      }),
      this.prisma.expenseRecord.findMany({
        where: { schoolId, deletedAt: null, date: range },
        select: { branchId: true, category: true, amount: true },
      }),
    ]);

    const income = this.buildSide(incomeRecords, branchNameById);
    const expense = this.buildSide(expenseRecords, branchNameById);

    return {
      schoolId: school.id,
      schoolName: school.name,
      period: { from, to },
      income,
      expense,
      netBalance: round2(income.total - expense.total),
    };
  }

  // Cumulative income vs. expense since inception, as of one date (mirrors
  // the old VFP "balance_sheet"/"balance_sheet_date" reports) - unlike
  // report() above (which is for one date range), this always starts from
  // the beginning of all records, giving a running "where do we stand today"
  // total rather than a single period's activity.
  async balanceSheet(currentUser: ScopedUser, schoolId: string, asOfDate: string) {
    if (!schoolId || !asOfDate) {
      throw new BadRequestException('"schoolId" and "asOfDate" query params are required');
    }
    assertSchoolAccess(currentUser, schoolId);

    const school = await this.prisma.school.findFirst({ where: { id: schoolId, deletedAt: null } });
    if (!school) throw new NotFoundException('School not found');

    const cutoff = { lte: new Date(asOfDate) };

    const [incomeRecords, expenseRecords] = await Promise.all([
      this.prisma.incomeRecord.findMany({
        where: { schoolId, deletedAt: null, date: cutoff },
        select: { category: true, amount: true },
      }),
      this.prisma.expenseRecord.findMany({
        where: { schoolId, deletedAt: null, date: cutoff },
        select: { category: true, amount: true },
      }),
    ]);

    const summarize = (records: { category: string; amount: unknown }[]) => {
      let total = 0;
      const byCategory = new Map<string, number>();
      for (const r of records) {
        const amt = Number(r.amount);
        total += amt;
        byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + amt);
      }
      return {
        total: round2(total),
        byCategory: Array.from(byCategory.entries())
          .map(([category, amount]) => ({ category, amount: round2(amount) }))
          .sort((a, b) => b.amount - a.amount),
      };
    };

    const income = summarize(incomeRecords);
    const expense = summarize(expenseRecords);

    return {
      schoolName: school.name,
      asOfDate,
      income,
      expense,
      netBalance: round2(income.total - expense.total),
    };
  }

  // Dashboard widget: lifetime income/expense/net balance per school the
  // caller can see (every campus for Director/Admin, just their own school
  // for everyone else scoped to one), plus one combined total across all of
  // them - so a Director sees each campus separately AND the whole picture.
  async dashboardSummary(currentUser: ScopedUser) {
    const resolvedSchoolId = resolveSchoolScope(currentUser, undefined);

    const schools = await this.prisma.school.findMany({
      where: { deletedAt: null, ...(resolvedSchoolId ? { id: resolvedSchoolId } : {}) },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const perSchool = await Promise.all(
      schools.map(async (school) => {
        const [incomeAgg, expenseAgg] = await Promise.all([
          this.prisma.incomeRecord.aggregate({
            where: { schoolId: school.id, deletedAt: null },
            _sum: { amount: true },
          }),
          this.prisma.expenseRecord.aggregate({
            where: { schoolId: school.id, deletedAt: null },
            _sum: { amount: true },
          }),
        ]);

        const income = round2(Number(incomeAgg._sum.amount ?? 0));
        const expense = round2(Number(expenseAgg._sum.amount ?? 0));

        return {
          schoolId: school.id,
          schoolName: school.name,
          income,
          expense,
          netBalance: round2(income - expense),
        };
      }),
    );

    const combined = perSchool.reduce(
      (acc, s) => ({
        income: round2(acc.income + s.income),
        expense: round2(acc.expense + s.expense),
        netBalance: round2(acc.netBalance + s.netBalance),
      }),
      { income: 0, expense: 0, netBalance: 0 },
    );

    return { schools: perSchool, combined };
  }

  private buildSide(
    records: { branchId: string | null; category: string; amount: unknown }[],
    branchNameById: Map<string, string>,
  ): Side {
    let total = 0;
    const byCategory = new Map<string, number>();
    const byBranch = new Map<
      string,
      { branchId: string | null; branchName: string; total: number; byCategory: Map<string, number> }
    >();

    for (const r of records) {
      const amt = Number(r.amount);
      total += amt;
      byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + amt);

      const key = r.branchId ?? '__none__';
      if (!byBranch.has(key)) {
        byBranch.set(key, {
          branchId: r.branchId,
          branchName: r.branchId
            ? branchNameById.get(r.branchId) ?? 'Unknown Branch'
            : 'School-level (no branch)',
          total: 0,
          byCategory: new Map(),
        });
      }
      const b = byBranch.get(key)!;
      b.total += amt;
      b.byCategory.set(r.category, (b.byCategory.get(r.category) ?? 0) + amt);
    }

    return {
      total: round2(total),
      byCategory: Array.from(byCategory.entries())
        .map(([category, amount]) => ({ category, amount: round2(amount) }))
        .sort((a, b) => b.amount - a.amount),
      byBranch: Array.from(byBranch.values())
        .map((b) => ({
          branchId: b.branchId,
          branchName: b.branchName,
          total: round2(b.total),
          byCategory: Array.from(b.byCategory.entries())
            .map(([category, amount]) => ({ category, amount: round2(amount) }))
            .sort((a, c) => c.amount - a.amount),
        }))
        .sort((a, b) => b.total - a.total),
    };
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
