import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HomeworkService } from '../homework/homework.service';
import { OnlineClassesService } from '../online-classes/online-classes.service';

@Injectable()
export class ParentPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly homework: HomeworkService,
    private readonly onlineClasses: OnlineClassesService,
  ) {}

  myChildren(parentUserId: string) {
    return this.prisma.parentStudent.findMany({
      where: { parentId: parentUserId },
      include: {
        student: {
          select: {
            id: true,
            admissionNo: true,
            photoUrl: true,
            user: { select: { fullName: true, isActive: true } },
            section: { select: { id: true, name: true, class: { select: { id: true, name: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async attendance(parentUserId: string, studentId: string, from?: string, to?: string) {
    await this.assertLinked(parentUserId, studentId);
    return this.prisma.attendanceRecord.findMany({
      where: {
        studentId,
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

  async results(parentUserId: string, studentId: string) {
    await this.assertLinked(parentUserId, studentId);

    const results = await this.prisma.examResult.findMany({
      where: { studentId },
      include: {
        examSubject: {
          include: {
            subject: { select: { id: true, name: true } },
            exam: { select: { id: true, name: true, startDate: true } },
          },
        },
      },
    });

    const byExam = new Map<
      string,
      { examId: string; examName: string; startDate: Date; totalObtained: number; totalMax: number; subjects: unknown[] }
    >();
    for (const r of results) {
      const exam = r.examSubject.exam;
      if (!byExam.has(exam.id)) {
        byExam.set(exam.id, {
          examId: exam.id,
          examName: exam.name,
          startDate: exam.startDate,
          totalObtained: 0,
          totalMax: 0,
          subjects: [],
        });
      }
      const bucket = byExam.get(exam.id)!;
      const obtained = r.isAbsent ? 0 : r.marksObtained ?? 0;
      bucket.totalMax += r.examSubject.maxMarks;
      bucket.totalObtained += obtained;
      bucket.subjects.push({
        subject: r.examSubject.subject.name,
        maxMarks: r.examSubject.maxMarks,
        passingMarks: r.examSubject.passingMarks,
        marksObtained: r.marksObtained,
        isAbsent: r.isAbsent,
      });
    }

    return Array.from(byExam.values())
      .map((e) => ({ ...e, percentage: e.totalMax ? Math.round((e.totalObtained / e.totalMax) * 10000) / 100 : null }))
      .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
  }

  async fees(parentUserId: string, studentId: string) {
    await this.assertLinked(parentUserId, studentId);
    return this.prisma.feeInvoice.findMany({
      where: { studentId, deletedAt: null },
      include: { items: { include: { feeHead: true } }, payments: true },
      orderBy: { period: 'desc' },
    });
  }

  // Combined fee picture across every child linked to this parent - "single
  // single" per-child totals plus one grand total, so a parent with 2+ kids
  // doesn't have to add up separate invoice screens by hand.
  async familyLedger(parentUserId: string) {
    const links = await this.prisma.parentStudent.findMany({
      where: { parentId: parentUserId },
      include: {
        student: {
          select: {
            id: true,
            admissionNo: true,
            photoUrl: true,
            user: { select: { fullName: true } },
            section: { select: { name: true, class: { select: { name: true } } } },
            familyId: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const children = await Promise.all(
      links.map(async (link) => {
        const invoices = await this.prisma.feeInvoice.findMany({
          where: { studentId: link.studentId, deletedAt: null },
        });
        const totalAmount = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
        const paidAmount = invoices.reduce((sum, inv) => sum + Number(inv.paidAmount), 0);
        const outstandingCount = invoices.filter((inv) => Number(inv.totalAmount) > Number(inv.paidAmount)).length;

        return {
          studentId: link.studentId,
          fullName: link.student.user.fullName,
          admissionNo: link.student.admissionNo,
          photoUrl: link.student.photoUrl,
          className: link.student.section ? `${link.student.section.class.name} - ${link.student.section.name}` : null,
          totalAmount: round2(totalAmount),
          paidAmount: round2(paidAmount),
          balance: round2(Math.max(totalAmount - paidAmount, 0)),
          outstandingInvoices: outstandingCount,
        };
      }),
    );

    const totals = children.reduce(
      (acc, c) => ({
        totalAmount: acc.totalAmount + c.totalAmount,
        paidAmount: acc.paidAmount + c.paidAmount,
        balance: acc.balance + c.balance,
      }),
      { totalAmount: 0, paidAmount: 0, balance: 0 },
    );

    return {
      isFamily: children.length > 1,
      children,
      totals: {
        totalAmount: round2(totals.totalAmount),
        paidAmount: round2(totals.paidAmount),
        balance: round2(totals.balance),
      },
    };
  }

  async homeworkFor(parentUserId: string, studentId: string) {
    const link = await this.prisma.parentStudent.findUnique({
      where: { parentId_studentId: { parentId: parentUserId, studentId } },
      include: { student: { select: { sectionId: true } } },
    });
    if (!link) throw new ForbiddenException('This student is not linked to your account');
    if (!link.student.sectionId) return [];
    return this.homework.listForSection(link.student.sectionId);
  }

  async onlineClassesFor(parentUserId: string, studentId: string) {
    const link = await this.prisma.parentStudent.findUnique({
      where: { parentId_studentId: { parentId: parentUserId, studentId } },
      include: { student: { select: { sectionId: true } } },
    });
    if (!link) throw new ForbiddenException('This student is not linked to your account');
    if (!link.student.sectionId) return [];
    return this.onlineClasses.listForSection(link.student.sectionId);
  }

  private async assertLinked(parentUserId: string, studentId: string) {
    const link = await this.prisma.parentStudent.findUnique({
      where: { parentId_studentId: { parentId: parentUserId, studentId } },
    });
    if (!link) throw new ForbiddenException('This student is not linked to your account');
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
