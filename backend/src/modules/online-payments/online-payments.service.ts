import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FeePaymentService } from '../finance/fee-payment.service';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';
import { InitiateOnlinePaymentDto } from './dto/initiate-online-payment.dto';
import { ReviewOnlinePaymentDto } from './dto/review-online-payment.dto';
import { savePersonPhoto, fetchPersonPhoto } from '../../common/utils/photo-storage';

const STAFF_ROLES = ['DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL'];

// Methods that work TODAY with no external merchant account: the parent
// sends money to the school's own JazzCash/EasyPaisa/bank account (shown to
// them from SchoolSetting) and uploads a screenshot/receipt as proof: a
// human then approves it. CARD (and JAZZCASH/EASYPAISA in true API-redirect
// mode) needs the school's own real merchant credentials, which don't exist
// yet - see the schema comment on OnlinePaymentAttempt for the full plan.
const PROOF_UPLOAD_METHODS = ['JAZZCASH', 'EASYPAISA', 'BANK_TRANSFER'];

type Requester = ScopedUser & { userId: string };

@Injectable()
export class OnlinePaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly feePayments: FeePaymentService,
  ) {}

  // Confirms the requesting user actually owns (or parents) the invoice's
  // student - the online-payment endpoints are reachable by PARENT/STUDENT
  // roles, which have no school-wide access, unlike staff.
  private async assertOwnsInvoice(invoiceId: string, currentUser: Requester) {
    const invoice = await this.prisma.feeInvoice.findFirst({
      where: { id: invoiceId, deletedAt: null },
      include: { school: { include: { settings: true } }, student: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const isStaff = currentUser.roles.some((r) => STAFF_ROLES.includes(r));
    if (isStaff) return invoice;

    if (currentUser.roles.includes('PARENT')) {
      const link = await this.prisma.parentStudent.findUnique({
        where: { parentId_studentId: { parentId: currentUser.userId, studentId: invoice.studentId } },
      });
      if (!link) throw new ForbiddenException('You can only pay your own child\'s fee invoices');
    } else if (invoice.student.userId !== currentUser.userId) {
      throw new ForbiddenException('You can only pay your own fee invoices');
    }
    return invoice;
  }

  // Starts a payment attempt. For proof-upload methods this just returns the
  // school's payment account details (from SchoolSetting) so the parent
  // knows where to send money before uploading proof. For CARD (and any
  // future true gateway-redirect mode), this is where a real checkout
  // session/redirect URL would be created once merchant credentials exist.
  async initiate(dto: InitiateOnlinePaymentDto, currentUser: Requester) {
    const invoice = await this.assertOwnsInvoice(dto.invoiceId, currentUser);

    const remaining = Number(invoice.totalAmount) - Number(invoice.paidAmount);
    if (dto.amount > remaining + 0.01) {
      throw new BadRequestException(`Amount (${dto.amount}) exceeds the remaining balance (${remaining.toFixed(2)})`);
    }

    if (!PROOF_UPLOAD_METHODS.includes(dto.method)) {
      // CARD (or JAZZCASH/EASYPAISA run in real API mode) - needs the
      // school's own merchant credentials, which aren't configured. Fail
      // loudly and clearly rather than pretending a payment can go through.
      throw new BadRequestException(
        'Online card payment is not yet set up for this school. Please pay via JazzCash, EasyPaisa, or bank transfer instead, or contact the school office.',
      );
    }

    const attempt = await this.prisma.onlinePaymentAttempt.create({
      data: {
        invoiceId: invoice.id,
        amount: dto.amount,
        method: dto.method,
        status: 'PENDING',
        initiatedById: currentUser.userId,
      },
    });

    return {
      attempt,
      payTo: {
        bankName: invoice.school.settings?.bankName ?? null,
        bankAccountTitle: invoice.school.settings?.bankAccountTitle ?? null,
        bankAccountNumber: invoice.school.settings?.bankAccountNumber ?? null,
        jazzCashNumber: invoice.school.settings?.jazzCashNumber ?? null,
        easyPaisaNumber: invoice.school.settings?.easyPaisaNumber ?? null,
      },
    };
  }

  // Parent/student uploads their payment screenshot/receipt against a
  // PENDING attempt they started - moves it to SUBMITTED, awaiting staff review.
  async submitProof(id: string, file: Express.Multer.File, proofNote: string | undefined, currentUser: Requester) {
    const attempt = await this.prisma.onlinePaymentAttempt.findFirst({ where: { id }, include: { invoice: true } });
    if (!attempt) throw new NotFoundException('Payment attempt not found');
    if (attempt.initiatedById !== currentUser.userId) {
      throw new ForbiddenException('You can only submit proof for your own payment attempt');
    }
    if (attempt.status !== 'PENDING') {
      throw new BadRequestException(`This payment attempt is already ${attempt.status.toLowerCase()}`);
    }
    if (!file) throw new BadRequestException('Please attach a screenshot or photo of the payment receipt');

    const ext = (file.originalname.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const fileKey = savePersonPhoto('payment-proofs', `${attempt.id}.${ext}`, file.buffer);

    return this.prisma.onlinePaymentAttempt.update({
      where: { id },
      data: { status: 'SUBMITTED', proofFileKey: fileKey, proofNote },
    });
  }

  async myAttempts(currentUser: Requester) {
    return this.prisma.onlinePaymentAttempt.findMany({
      where: { initiatedById: currentUser.userId },
      include: { invoice: { select: { id: true, period: true } }, feePayment: { select: { receiptNo: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Staff queue: proofs waiting to be checked against the school's real bank/
  // wallet statement before being approved.
  async pending(currentUser: ScopedUser, schoolId?: string) {
    const effectiveSchoolId = resolveSchoolScope(currentUser, schoolId);
    return this.prisma.onlinePaymentAttempt.findMany({
      where: { status: 'SUBMITTED', ...(effectiveSchoolId ? { invoice: { schoolId: effectiveSchoolId } } : {}) },
      include: {
        invoice: {
          include: { student: { include: { user: true } }, school: true },
        },
        initiatedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getProofFile(id: string, currentUser: ScopedUser) {
    const attempt = await this.prisma.onlinePaymentAttempt.findFirst({ where: { id }, include: { invoice: true } });
    if (!attempt) throw new NotFoundException('Payment attempt not found');
    assertSchoolAccess(currentUser, attempt.invoice.schoolId);
    if (!attempt.proofFileKey) throw new NotFoundException('No proof uploaded for this payment attempt');
    const buffer = await fetchPersonPhoto(attempt.proofFileKey);
    if (!buffer) throw new NotFoundException('Proof file is missing on disk');
    const ext = attempt.proofFileKey.split('.').pop()?.toLowerCase();
    const mimeType =
      ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    return { buffer, mimeType };
  }

  // Approves a submitted proof: creates the real FeePayment/IncomeRecord via
  // the same logic as a manually-recorded payment (FeePaymentService.record),
  // and links it back to this attempt.
  async approve(id: string, currentUser: Requester) {
    const attempt = await this.prisma.onlinePaymentAttempt.findFirst({
      where: { id },
      include: { invoice: true },
    });
    if (!attempt) throw new NotFoundException('Payment attempt not found');
    assertSchoolAccess(currentUser, attempt.invoice.schoolId);
    if (attempt.status !== 'SUBMITTED') {
      throw new BadRequestException('Only a submitted proof can be approved');
    }

    const methodLabel = attempt.method === 'BANK_TRANSFER' ? 'Bank Transfer' : attempt.method === 'JAZZCASH' ? 'JazzCash' : 'EasyPaisa';

    const payment = await this.feePayments.record(
      {
        invoiceId: attempt.invoiceId,
        amount: Number(attempt.amount),
        paidDate: new Date().toISOString().slice(0, 10),
        method: methodLabel,
      },
      currentUser,
    );

    return this.prisma.onlinePaymentAttempt.update({
      where: { id },
      data: {
        status: 'APPROVED',
        feePaymentId: payment.id,
        reviewedById: currentUser.userId,
        reviewedAt: new Date(),
      },
    });
  }

  async reject(id: string, dto: ReviewOnlinePaymentDto, currentUser: Requester) {
    const attempt = await this.prisma.onlinePaymentAttempt.findFirst({ where: { id }, include: { invoice: true } });
    if (!attempt) throw new NotFoundException('Payment attempt not found');
    assertSchoolAccess(currentUser, attempt.invoice.schoolId);
    if (attempt.status !== 'SUBMITTED') {
      throw new BadRequestException('Only a submitted proof can be rejected');
    }

    return this.prisma.onlinePaymentAttempt.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewNote: dto.reviewNote,
        reviewedById: currentUser.userId,
        reviewedAt: new Date(),
      },
    });
  }
}
