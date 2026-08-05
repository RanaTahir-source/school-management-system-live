import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GeneratePayrollDto } from './dto/generate-payroll.dto';
import { PayPayslipDto } from './dto/pay-payslip.dto';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';

const STAFF_VIEW_ROLES = ['DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL'];

const PAYSLIP_INCLUDE = {
  staff: { select: { id: true, employeeId: true, designation: true, user: { select: { id: true, fullName: true } } } },
} as const;

@Injectable()
export class PayslipsService {
  constructor(private readonly prisma: PrismaService) {}

  // One payslip per active staff member (who has a SalaryStructure) in the
  // school, for the given month. Staff that already have a payslip for this
  // period are skipped - mirrors FeeInvoiceService.generateForClass.
  async generate(dto: GeneratePayrollDto, currentUser: ScopedUser & { userId: string }) {
    assertSchoolAccess(currentUser, dto.schoolId);

    const staffList = await this.prisma.staffProfile.findMany({
      where: {
        schoolId: dto.schoolId,
        isActive: true,
        deletedAt: null,
        ...(dto.branchId ? { branchId: dto.branchId } : {}),
        salaryStructure: { isNot: null },
      },
      include: { salaryStructure: true },
    });

    if (staffList.length === 0) {
      return { created: 0, skipped: 0, staff: 0, message: 'No staff with a salary structure found' };
    }

    const existing = await this.prisma.payslip.findMany({
      where: { staffId: { in: staffList.map((s) => s.id) }, period: dto.period },
      select: { staffId: true },
    });
    const alreadyGenerated = new Set(existing.map((e) => e.staffId));
    const toCreate = staffList.filter((s) => !alreadyGenerated.has(s.id));

    let created = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const staff of toCreate) {
        const structure = staff.salaryStructure!;
        const netPay = new Prisma.Decimal(structure.basicPay).add(structure.allowances).sub(structure.deductions);
        await tx.payslip.create({
          data: {
            staffId: staff.id,
            period: dto.period,
            basicPay: structure.basicPay,
            allowances: structure.allowances,
            deductions: structure.deductions,
            netPay,
            generatedById: currentUser.userId,
          },
        });
        created += 1;
      }
    });

    return { created, skipped: alreadyGenerated.size, staff: staffList.length };
  }

  findAll(currentUser: ScopedUser, schoolId?: string, period?: string, status?: string) {
    const scopedSchoolId = resolveSchoolScope(currentUser, schoolId);
    return this.prisma.payslip.findMany({
      where: {
        ...(period ? { period } : {}),
        ...(status ? { status: status as any } : {}),
        ...(scopedSchoolId ? { staff: { schoolId: scopedSchoolId } } : {}),
      },
      include: PAYSLIP_INCLUDE,
      orderBy: [{ period: 'desc' }],
    });
  }

  async pay(id: string, dto: PayPayslipDto, currentUser: ScopedUser & { userId: string }) {
    const payslip = await this.prisma.payslip.findFirst({ where: { id }, include: { staff: true } });
    if (!payslip) throw new NotFoundException('Payslip not found');
    assertSchoolAccess(currentUser, payslip.staff.schoolId);
    if (payslip.status === 'PAID') {
      throw new BadRequestException('This payslip has already been paid');
    }

    const paidDate = dto.paidDate ? new Date(dto.paidDate) : new Date();

    return this.prisma.$transaction(async (tx) => {
      const expenseRecord = await tx.expenseRecord.create({
        data: {
          schoolId: payslip.staff.schoolId,
          branchId: payslip.staff.branchId,
          category: 'Salaries',
          amount: payslip.netPay,
          date: paidDate,
          description: `Salary for ${payslip.period}`,
          recordedById: currentUser.userId,
        },
      });

      return tx.payslip.update({
        where: { id },
        data: {
          status: 'PAID',
          paidDate,
          method: dto.method ?? 'Bank Transfer',
          paidById: currentUser.userId,
          expenseRecordId: expenseRecord.id,
        },
        include: PAYSLIP_INCLUDE,
      });
    });
  }

  // A staff member checking their own payslip history.
  async mine(userId: string) {
    const staff = await this.prisma.staffProfile.findFirst({ where: { userId } });
    if (!staff) throw new NotFoundException('No staff profile linked to this account');
    return this.prisma.payslip.findMany({
      where: { staffId: staff.id },
      orderBy: [{ period: 'desc' }],
    });
  }

  async findForStaff(staffId: string, currentUser: ScopedUser & { userId: string }) {
    const staff = await this.prisma.staffProfile.findFirst({ where: { id: staffId, deletedAt: null } });
    if (!staff) throw new NotFoundException('Staff member not found');

    const isStaffViewer = currentUser.roles.some((r) => STAFF_VIEW_ROLES.includes(r));
    if (!isStaffViewer && staff.userId !== currentUser.userId) {
      throw new ForbiddenException('You can only view your own payslips');
    }
    if (isStaffViewer) {
      assertSchoolAccess(currentUser, staff.schoolId);
    }

    return this.prisma.payslip.findMany({ where: { staffId }, orderBy: [{ period: 'desc' }] });
  }
}
