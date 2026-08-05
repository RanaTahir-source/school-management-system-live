import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecordFeePaymentDto } from './dto/record-fee-payment.dto';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';

const STAFF_VIEW_ROLES = ['DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL'];

@Injectable()
export class FeePaymentService {
  constructor(private readonly prisma: PrismaService) {}

  async record(dto: RecordFeePaymentDto, currentUser: ScopedUser & { userId: string }) {
    const invoice = await this.prisma.feeInvoice.findFirst({
      where: { id: dto.invoiceId, deletedAt: null },
      include: { school: true, items: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    assertSchoolAccess(currentUser, invoice.schoolId);

    const remaining = Number(invoice.totalAmount) - Number(invoice.paidAmount);
    if (dto.amount > remaining + 0.01) {
      throw new BadRequestException(
        `Payment amount (${dto.amount}) exceeds remaining balance (${remaining.toFixed(2)})`,
      );
    }

    const receiptNo = await this.nextReceiptNo(invoice.schoolId, invoice.school.code);

    return this.prisma.$transaction(async (tx) => {
      const incomeRecord = await tx.incomeRecord.create({
        data: {
          schoolId: invoice.schoolId,
          branchId: invoice.branchId,
          studentId: invoice.studentId,
          category: 'Tuition Fee',
          amount: dto.amount,
          date: new Date(dto.paidDate),
          description: `Fee payment for ${invoice.period} (Invoice ${invoice.id.slice(0, 8)})`,
          receivedById: currentUser.userId,
        },
      });

      const payment = await tx.feePayment.create({
        data: {
          invoiceId: invoice.id,
          receiptNo,
          amount: dto.amount,
          paidDate: new Date(dto.paidDate),
          method: dto.method ?? 'Cash',
          receivedById: currentUser.userId,
          incomeRecordId: incomeRecord.id,
        },
      });

      const newPaidAmount = Number(invoice.paidAmount) + dto.amount;
      const status = newPaidAmount >= Number(invoice.totalAmount) ? 'PAID' : 'PARTIAL';

      await tx.feeInvoice.update({
        where: { id: invoice.id },
        data: { paidAmount: newPaidAmount, status },
      });

      return payment;
    });
  }

  async findOne(id: string, currentUser: ScopedUser) {
    const payment = await this.prisma.feePayment.findFirst({
      where: { id },
      include: {
        invoice: {
          include: {
            items: { include: { feeHead: true } },
            student: { include: { user: true, section: { include: { class: true } } } },
            school: { include: { settings: true } },
            branch: true,
          },
        },
        receivedBy: true,
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const isStaff = currentUser.roles.some((r) => STAFF_VIEW_ROLES.includes(r));
    if (!isStaff) {
      if (currentUser.roles.includes('PARENT')) {
        if (!currentUser.userId) throw new ForbiddenException('You can only view your own payment records');
        const link = await this.prisma.parentStudent.findUnique({
          where: { parentId_studentId: { parentId: currentUser.userId, studentId: payment.invoice.studentId } },
        });
        if (!link) throw new ForbiddenException('You can only view your own payment records');
      } else if (payment.invoice.student.userId !== currentUser.userId) {
        throw new ForbiddenException('You can only view your own payment records');
      }
    }
    if (isStaff) {
      assertSchoolAccess(currentUser, payment.invoice.schoolId);
    }
    return payment;
  }

  // All payments received on one calendar day (mirrors the old VFP
  // "feetoday"/"fee_receiving_sheet" reports) - the accountant's daily cash
  // book for fee collection.
  async findCollectionReport(currentUser: ScopedUser, schoolIdFilter: string | undefined, date: string) {
    const schoolId = resolveSchoolScope(currentUser, schoolIdFilter);
    const payments = await this.prisma.feePayment.findMany({
      where: {
        paidDate: new Date(date),
        ...(schoolId ? { invoice: { schoolId } } : {}),
      },
      include: {
        invoice: {
          include: {
            student: { include: { user: true, section: { include: { class: true } } } },
            school: true,
          },
        },
        receivedBy: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const schoolNames = new Set(payments.map((p) => p.invoice.school.name));
    const schoolLabel = schoolNames.size === 1 ? [...schoolNames][0] : 'All Schools';

    return { date, schoolLabel, payments };
  }

  private async nextReceiptNo(schoolId: string, schoolCode: string) {
    const count = await this.prisma.feePayment.count({
      where: { invoice: { schoolId } },
    });
    const sequence = String(count + 1).padStart(6, '0');
    return `${schoolCode}-${sequence}`;
  }
}
