import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateInvoicesDto } from './dto/generate-invoices.dto';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';

const STAFF_VIEW_ROLES = ['DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL'];

@Injectable()
export class FeeInvoiceService {
  constructor(private readonly prisma: PrismaService) {}

  // Generates one FeeInvoice per active student in `classId`'s sections (for the
  // given academic year), for the given month - using the class's FeeStructure,
  // minus any active concessions the student has. Students that already have an
  // invoice for this period are skipped (not duplicated).
  async generateForClass(dto: GenerateInvoicesDto, currentUser: ScopedUser) {
    const klass = await this.prisma.class.findFirst({ where: { id: dto.classId, deletedAt: null } });
    if (!klass) throw new NotFoundException('Class not found');
    assertSchoolAccess(currentUser, klass.schoolId);

    const structure = await this.prisma.feeStructure.findUnique({
      where: { classId_academicYearId: { classId: dto.classId, academicYearId: dto.academicYearId } },
      include: { items: { include: { feeHead: true } } },
    });
    if (!structure || structure.items.length === 0) {
      throw new BadRequestException('No fee structure set for this class/academic year yet');
    }

    const applicableItems = structure.items.filter((i) => dto.includeOneTimeFees || i.feeHead.isMonthly);
    if (applicableItems.length === 0) {
      throw new BadRequestException('Fee structure has no applicable (monthly) items for this period');
    }

    const sections = await this.prisma.section.findMany({
      where: { classId: dto.classId, academicYearId: dto.academicYearId, deletedAt: null },
      select: { id: true },
    });
    const sectionIds = sections.map((s) => s.id);

    const students = await this.prisma.studentProfile.findMany({
      where: { sectionId: { in: sectionIds }, isActive: true, deletedAt: null },
      include: {
        feeConcessions: { where: { isActive: true } },
      },
    });

    if (students.length === 0) {
      return { created: 0, skipped: 0, students: 0, message: 'No active students found in this class' };
    }

    const existing = await this.prisma.feeInvoice.findMany({
      where: { studentId: { in: students.map((s) => s.id) }, period: dto.period, deletedAt: null },
      select: { studentId: true },
    });
    const alreadyInvoiced = new Set(existing.map((e) => e.studentId));

    const toCreate = students.filter((s) => !alreadyInvoiced.has(s.id));

    let created = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const student of toCreate) {
        let total = new Prisma.Decimal(0);
        const items = applicableItems.map((item) => {
          const concession = student.feeConcessions.find(
            (c) => c.feeHeadId === item.feeHeadId || c.feeHeadId === null,
          );
          let concessionAmount = new Prisma.Decimal(0);
          if (concession) {
            concessionAmount =
              concession.type === 'PERCENTAGE'
                ? item.amount.mul(concession.value).div(100)
                : Prisma.Decimal.min(concession.value, item.amount);
          }
          const netAmount = Prisma.Decimal.max(item.amount.sub(concessionAmount), 0);
          total = total.add(netAmount);
          return {
            feeHeadId: item.feeHeadId,
            amount: item.amount,
            concessionAmount,
            netAmount,
          };
        });

        await tx.feeInvoice.create({
          data: {
            studentId: student.id,
            schoolId: klass.schoolId,
            branchId: klass.branchId,
            period: dto.period,
            dueDate: new Date(dto.dueDate),
            totalAmount: total,
            items: { createMany: { data: items } },
          },
        });
        created += 1;
      }
    });

    return {
      created,
      skipped: alreadyInvoiced.size,
      students: students.length,
    };
  }

  async findForStudent(studentId: string, currentUser: ScopedUser) {
    const student = await this.prisma.studentProfile.findFirst({
      where: { id: studentId, deletedAt: null },
      include: { user: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    const isStaff = currentUser.roles.some((r) => STAFF_VIEW_ROLES.includes(r));
    if (!isStaff && student.userId !== currentUser.userId) {
      throw new ForbiddenException('You can only view your own fee records');
    }
    if (isStaff) {
      assertSchoolAccess(currentUser, student.user.schoolId);
    }

    return this.prisma.feeInvoice.findMany({
      where: { studentId, deletedAt: null },
      include: { items: { include: { feeHead: true } }, payments: true },
      orderBy: { period: 'desc' },
    });
  }

  // Same data as findForStudent, but also returns the student+school info
  // needed for a printable ledger header, and orders oldest-first so a
  // running balance reads top-to-bottom like a real ledger.
  async findLedgerForStudent(studentId: string, currentUser: ScopedUser) {
    const student = await this.prisma.studentProfile.findFirst({
      where: { id: studentId, deletedAt: null },
      include: { user: true, section: { include: { class: true } } },
    });
    if (!student) throw new NotFoundException('Student not found');
    assertSchoolAccess(currentUser, student.user.schoolId);

    const school = await this.prisma.school.findUnique({ where: { id: student.user.schoolId! } });

    const invoices = await this.prisma.feeInvoice.findMany({
      where: { studentId, deletedAt: null },
      include: { items: { include: { feeHead: true } }, payments: { orderBy: { createdAt: 'asc' } } },
      orderBy: { period: 'asc' },
    });

    return { student, school, invoices };
  }

  async findDues(
    currentUser: ScopedUser,
    filters: { schoolId?: string; branchId?: string; period?: string; status?: string },
  ) {
    const schoolId = resolveSchoolScope(currentUser, filters.schoolId);
    return this.prisma.feeInvoice.findMany({
      where: {
        deletedAt: null,
        ...(schoolId ? { schoolId } : {}),
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
        ...(filters.period ? { period: filters.period } : {}),
        ...(filters.status ? { status: filters.status as any } : {}),
      },
      include: {
        student: { include: { user: true, section: { include: { class: true } } } },
        items: { include: { feeHead: true } },
        payments: { orderBy: { createdAt: 'desc' } },
        school: true,
      },
      orderBy: [{ period: 'desc' }],
    });
  }

  // Class-wise collection summary for one period (mirrors the old VFP
  // "monthly_fee_detail" report) - how much was invoiced/collected/still due,
  // broken down by class, for the accountant's monthly review.
  async findMonthlySummary(currentUser: ScopedUser, schoolIdFilter: string | undefined, period: string) {
    const schoolId = resolveSchoolScope(currentUser, schoolIdFilter);
    if (!schoolId) {
      throw new BadRequestException('"schoolId" is required for the monthly summary');
    }
    const school = await this.prisma.school.findFirst({ where: { id: schoolId, deletedAt: null } });
    if (!school) throw new NotFoundException('School not found');

    const invoices = await this.prisma.feeInvoice.findMany({
      where: { schoolId, period, deletedAt: null },
      include: { student: { include: { section: { include: { class: true } } } } },
    });

    const byClass = new Map<string, { className: string; studentCount: number; totalAmount: number; paidAmount: number }>();
    for (const inv of invoices) {
      const className = inv.student.section?.class.name ?? 'Unassigned';
      if (!byClass.has(className)) {
        byClass.set(className, { className, studentCount: 0, totalAmount: 0, paidAmount: 0 });
      }
      const row = byClass.get(className)!;
      row.studentCount += 1;
      row.totalAmount += Number(inv.totalAmount);
      row.paidAmount += Number(inv.paidAmount);
    }

    const rows = Array.from(byClass.values())
      .map((r) => ({ ...r, balance: round2(r.totalAmount - r.paidAmount) }))
      .sort((a, b) => a.className.localeCompare(b.className));

    const grandTotal = {
      studentCount: rows.reduce((s, r) => s + r.studentCount, 0),
      totalAmount: round2(rows.reduce((s, r) => s + r.totalAmount, 0)),
      paidAmount: round2(rows.reduce((s, r) => s + r.paidAmount, 0)),
      balance: round2(rows.reduce((s, r) => s + r.balance, 0)),
    };

    return { schoolName: school.name, period, rows, grandTotal };
  }

  // Month-by-month collection totals for a full calendar year (mirrors the
  // old VFP "annual_fee_report") - one row per month, invoiced vs. collected.
  async findAnnualSummary(currentUser: ScopedUser, schoolIdFilter: string | undefined, year: string) {
    const schoolId = resolveSchoolScope(currentUser, schoolIdFilter);
    if (!schoolId) {
      throw new BadRequestException('"schoolId" is required for the annual report');
    }
    const school = await this.prisma.school.findFirst({ where: { id: schoolId, deletedAt: null } });
    if (!school) throw new NotFoundException('School not found');

    const invoices = await this.prisma.feeInvoice.findMany({
      where: { schoolId, period: { startsWith: `${year}-` }, deletedAt: null },
      select: { period: true, totalAmount: true, paidAmount: true },
    });

    const byMonth = new Map<string, { totalAmount: number; paidAmount: number }>();
    for (let m = 1; m <= 12; m++) {
      byMonth.set(`${year}-${String(m).padStart(2, '0')}`, { totalAmount: 0, paidAmount: 0 });
    }
    for (const inv of invoices) {
      const row = byMonth.get(inv.period) ?? { totalAmount: 0, paidAmount: 0 };
      row.totalAmount += Number(inv.totalAmount);
      row.paidAmount += Number(inv.paidAmount);
      byMonth.set(inv.period, row);
    }

    const rows = Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, r]) => ({ period, ...r, balance: round2(r.totalAmount - r.paidAmount) }));

    const grandTotal = {
      totalAmount: round2(rows.reduce((s, r) => s + r.totalAmount, 0)),
      paidAmount: round2(rows.reduce((s, r) => s + r.paidAmount, 0)),
      balance: round2(rows.reduce((s, r) => s + r.balance, 0)),
    };

    return { schoolName: school.name, year, rows, grandTotal };
  }

  // A class-wide grid of student x period invoice status (mirrors the old
  // VFP "fee_register_filled" report) - one row per active student, one
  // column per period that has an invoice for this class, cell = that
  // student's invoice for that period (or null if none was generated).
  async findFeeRegister(currentUser: ScopedUser, classId: string, academicYearId: string) {
    const klass = await this.prisma.class.findFirst({
      where: { id: classId, deletedAt: null },
      include: { school: true },
    });
    if (!klass) throw new NotFoundException('Class not found');
    assertSchoolAccess(currentUser, klass.schoolId);

    const sections = await this.prisma.section.findMany({
      where: { classId, academicYearId, deletedAt: null },
      select: { id: true },
    });
    const sectionIds = sections.map((s) => s.id);

    const students = await this.prisma.studentProfile.findMany({
      where: { sectionId: { in: sectionIds }, isActive: true, deletedAt: null },
      include: { user: true, section: true },
    });
    students.sort((a, b) => a.user.fullName.localeCompare(b.user.fullName));

    const invoices = students.length
      ? await this.prisma.feeInvoice.findMany({
          where: { studentId: { in: students.map((s) => s.id) }, deletedAt: null },
          select: { studentId: true, period: true, status: true, totalAmount: true, paidAmount: true },
        })
      : [];

    const periods = Array.from(new Set(invoices.map((i) => i.period))).sort();

    const rows = students.map((s) => ({
      student: s,
      cells: periods.map((p) => invoices.find((i) => i.studentId === s.id && i.period === p) ?? null),
    }));

    return { school: klass.school, className: klass.name, periods, rows };
  }

  // Fee invoices for future periods that are already fully PAID (mirrors the
  // old VFP "advance_fee_sheet" report) - parents who paid ahead of schedule.
  async findAdvancePayments(currentUser: ScopedUser, schoolIdFilter?: string) {
    const schoolId = resolveSchoolScope(currentUser, schoolIdFilter);
    const currentPeriod = new Date().toISOString().slice(0, 7);

    return this.prisma.feeInvoice.findMany({
      where: {
        deletedAt: null,
        status: 'PAID',
        period: { gt: currentPeriod },
        ...(schoolId ? { schoolId } : {}),
      },
      include: {
        student: { include: { user: true, section: { include: { class: true } } } },
        payments: { orderBy: { paidDate: 'desc' }, take: 1 },
        school: true,
      },
      orderBy: [{ period: 'asc' }],
    });
  }

  // Guardian/nominee contact list for fee correspondence (mirrors the old
  // VFP "fee_nominees" report) - who to contact for each student's fee.
  async findNominees(currentUser: ScopedUser, schoolIdFilter?: string, classId?: string) {
    const schoolId = resolveSchoolScope(currentUser, schoolIdFilter);
    const students = await this.prisma.studentProfile.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        ...(schoolId ? { user: { schoolId } } : {}),
        ...(classId ? { section: { classId } } : {}),
      },
      include: { user: true, section: { include: { class: true } } },
    });
    students.sort((a, b) => a.user.fullName.localeCompare(b.user.fullName));

    const school = schoolId ? await this.prisma.school.findFirst({ where: { id: schoolId, deletedAt: null } }) : null;
    return { schoolName: school?.name ?? 'All Schools', students };
  }

  // All-time (not period-limited) class-wise collection rate (mirrors the
  // old VFP "fee_analysing" report) - a bird's-eye view of which classes are
  // collecting well vs. lagging, since the school opened.
  async findFeeAnalysis(currentUser: ScopedUser, schoolIdFilter: string | undefined) {
    const schoolId = resolveSchoolScope(currentUser, schoolIdFilter);
    if (!schoolId) {
      throw new BadRequestException('"schoolId" is required for fee analysis');
    }
    const school = await this.prisma.school.findFirst({ where: { id: schoolId, deletedAt: null } });
    if (!school) throw new NotFoundException('School not found');

    const invoices = await this.prisma.feeInvoice.findMany({
      where: { schoolId, deletedAt: null },
      include: { student: { include: { section: { include: { class: true } } } } },
    });

    const byClass = new Map<string, { className: string; invoiceCount: number; totalAmount: number; paidAmount: number }>();
    for (const inv of invoices) {
      const className = inv.student.section?.class.name ?? 'Unassigned';
      if (!byClass.has(className)) {
        byClass.set(className, { className, invoiceCount: 0, totalAmount: 0, paidAmount: 0 });
      }
      const row = byClass.get(className)!;
      row.invoiceCount += 1;
      row.totalAmount += Number(inv.totalAmount);
      row.paidAmount += Number(inv.paidAmount);
    }

    const rows = Array.from(byClass.values())
      .map((r) => ({
        ...r,
        balance: round2(r.totalAmount - r.paidAmount),
        collectionRate: r.totalAmount > 0 ? round2((r.paidAmount / r.totalAmount) * 100) : 0,
      }))
      .sort((a, b) => a.className.localeCompare(b.className));

    const grandTotalAmount = round2(rows.reduce((s, r) => s + r.totalAmount, 0));
    const grandPaidAmount = round2(rows.reduce((s, r) => s + r.paidAmount, 0));
    const grandTotal = {
      invoiceCount: rows.reduce((s, r) => s + r.invoiceCount, 0),
      totalAmount: grandTotalAmount,
      paidAmount: grandPaidAmount,
      balance: round2(grandTotalAmount - grandPaidAmount),
      collectionRate: grandTotalAmount > 0 ? round2((grandPaidAmount / grandTotalAmount) * 100) : 0,
    };

    return { schoolName: school.name, rows, grandTotal };
  }

  // Combined fee statement for all active siblings sharing one guardian
  // phone number (mirrors the old VFP "family_fee"/"family_fee_balance"/
  // "family_ledger" reports) - schema has no dedicated Family model, so
  // "family" here means "students with the same guardianPhone", which is
  // how the old system's paper records grouped siblings in practice.
  async findFamilyStatement(currentUser: ScopedUser, guardianPhone: string) {
    if (!guardianPhone) {
      throw new BadRequestException('"guardianPhone" is required');
    }
    const isUnrestricted = currentUser.roles.some((r) => ['CHAIRMAN'].includes(r));

    const students = await this.prisma.studentProfile.findMany({
      where: {
        guardianPhone,
        isActive: true,
        deletedAt: null,
        ...(isUnrestricted ? {} : { user: { schoolId: currentUser.schoolId ?? undefined } }),
      },
      include: { user: { include: { school: true } }, section: { include: { class: true } } },
    });
    if (students.length === 0) {
      throw new NotFoundException('No active students found for this guardian phone number');
    }

    const invoices = await this.prisma.feeInvoice.findMany({
      where: { studentId: { in: students.map((s) => s.id) }, deletedAt: null },
      orderBy: { period: 'asc' },
    });

    const byStudent = students.map((s) => {
      const studentInvoices = invoices.filter((i) => i.studentId === s.id);
      const totalAmount = studentInvoices.reduce((sum, i) => sum + Number(i.totalAmount), 0);
      const paidAmount = studentInvoices.reduce((sum, i) => sum + Number(i.paidAmount), 0);
      return {
        student: s,
        invoiceCount: studentInvoices.length,
        totalAmount: round2(totalAmount),
        paidAmount: round2(paidAmount),
        balance: round2(totalAmount - paidAmount),
      };
    });

    const familyTotal = {
      totalAmount: round2(byStudent.reduce((s, r) => s + r.totalAmount, 0)),
      paidAmount: round2(byStudent.reduce((s, r) => s + r.paidAmount, 0)),
      balance: round2(byStudent.reduce((s, r) => s + r.balance, 0)),
    };

    return {
      guardianPhone,
      guardianName: students[0].guardianName,
      schoolName: students[0].user.school?.name ?? 'All Schools',
      byStudent,
      familyTotal,
    };
  }

  // Same student list as findFeeRegister, but with fixed Jan-Dec columns
  // and no data - a printable blank grid for manual fee tracking (mirrors
  // the old VFP "fee_register_blank"/"fee_register_blank_1" reports).
  async findFeeRegisterStudents(currentUser: ScopedUser, classId: string, academicYearId: string) {
    const klass = await this.prisma.class.findFirst({
      where: { id: classId, deletedAt: null },
      include: { school: true },
    });
    if (!klass) throw new NotFoundException('Class not found');
    assertSchoolAccess(currentUser, klass.schoolId);

    const sections = await this.prisma.section.findMany({
      where: { classId, academicYearId, deletedAt: null },
      select: { id: true },
    });
    const sectionIds = sections.map((s) => s.id);

    const students = await this.prisma.studentProfile.findMany({
      where: { sectionId: { in: sectionIds }, isActive: true, deletedAt: null },
      include: { user: true },
    });
    students.sort((a, b) => a.user.fullName.localeCompare(b.user.fullName));

    return { school: klass.school, className: klass.name, students };
  }

  async findOne(id: string, currentUser: ScopedUser) {
    const invoice = await this.prisma.feeInvoice.findFirst({
      where: { id, deletedAt: null },
      include: {
        student: { include: { user: true, section: { include: { class: true } } } },
        items: { include: { feeHead: true } },
        payments: true,
        school: true,
        branch: true,
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    assertSchoolAccess(currentUser, invoice.schoolId);
    return invoice;
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
