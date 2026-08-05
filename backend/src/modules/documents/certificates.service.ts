import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { join } from 'path';
import { writeFileSync } from 'fs';
import { CertificateType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';
import { CertificatePdfService } from './certificate-pdf.service';
import { CreateCertificateDto } from './dto/create-certificate.dto';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';

type Requester = ScopedUser & { userId: string };

const MANAGE_ROLES = ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'RECEPTIONIST'];

const INCLUDE = {
  student: {
    select: { id: true, admissionNo: true, user: { select: { fullName: true } }, section: { include: { class: true } } },
  },
  staff: { select: { id: true, designation: true, user: { select: { fullName: true } } } },
  issuedBy: { select: { id: true, fullName: true } },
} as const;

@Injectable()
export class CertificatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly pdf: CertificatePdfService,
  ) {}

  async create(dto: CreateCertificateDto, currentUser: Requester) {
    assertSchoolAccess(currentUser, dto.schoolId);
    if (!dto.studentId && !dto.staffId) {
      throw new BadRequestException('Either studentId or staffId is required');
    }

    const school = await this.prisma.school.findFirst({ where: { id: dto.schoolId } });
    if (!school) throw new NotFoundException('School not found');

    let student: any = null;
    if (dto.studentId) {
      student = await this.prisma.studentProfile.findFirst({
        where: { id: dto.studentId, deletedAt: null },
        include: { user: true, section: { include: { class: true } } },
      });
      if (!student || student.user.schoolId !== dto.schoolId) {
        throw new BadRequestException('Student does not belong to the given school');
      }
    }
    let staff: any = null;
    if (dto.staffId) {
      staff = await this.prisma.staffProfile.findFirst({ where: { id: dto.staffId, deletedAt: null }, include: { user: true } });
      if (!staff || staff.schoolId !== dto.schoolId) {
        throw new BadRequestException('Staff member does not belong to the given school');
      }
    }

    // Retry on the rare unique-constraint race for certificateNo instead of
    // standing up a separate DB sequence - a handful of certificates get
    // issued per day, so lock-free "count + retry on collision" is enough.
    let lastError: unknown;
    for (let attempt = 0; attempt < 5; attempt++) {
      const certificateNo = await this.nextCertificateNo(dto.schoolId);
      try {
        return await this.issue(dto, certificateNo, student, staff, school, currentUser);
      } catch (err) {
        lastError = err;
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') continue;
        throw err;
      }
    }
    throw lastError instanceof Error ? lastError : new BadRequestException('Could not allocate a certificate number, please retry');
  }

  private async nextCertificateNo(schoolId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.certificate.count({
      where: { schoolId, issuedDate: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) } },
    });
    return `CERT-${year}-${String(count + 1).padStart(6, '0')}`;
  }

  private async issue(dto: CreateCertificateDto, certificateNo: string, student: any, staff: any, school: any, currentUser: Requester) {
    // MIGRATION is the only type with auto-computed fields, and needs to
    // happen before the transaction below since it's just reads.
    const migration =
      dto.type === 'MIGRATION' && dto.studentId ? await this.computeMigrationSnapshot(dto.studentId, dto.schoolId) : null;

    return this.prisma.$transaction(async (tx) => {
      const record = await tx.certificate.create({
        data: {
          schoolId: dto.schoolId,
          studentId: dto.studentId,
          staffId: dto.staffId,
          type: dto.type,
          certificateNo,
          title: dto.title,
          bodyText: dto.bodyText,
          remarks: dto.remarks,
          issuedById: currentUser.userId,
          ...(migration
            ? {
                admissionDate: migration.admissionDate,
                marksObtained: migration.marksObtained,
                marksOutOf: migration.marksOutOf,
                attendanceDays: migration.attendanceDays,
                totalWorkingDays: migration.totalWorkingDays,
                duesAmount: migration.duesAmount,
                duesPaidTill: migration.duesPaidTill,
                transferDate: dto.transferDate ? new Date(dto.transferDate) : new Date(),
                shiftedToSchool: dto.shiftedToSchool,
              }
            : {}),
        },
      });

      const holderName = student?.user?.fullName ?? staff?.user?.fullName ?? '';
      const pdf = await this.pdf.buildCertificatePdf({
        schoolName: school.name,
        schoolAddress: school.address,
        certificateNo,
        type: dto.type,
        title: dto.title,
        bodyText: dto.bodyText?.trim() || this.defaultBody(dto.type, holderName, student),
        holderName,
        admissionNo: student?.admissionNo,
        className: student?.section?.class?.name,
        issuedDate: record.issuedDate,
        qrVerifyToken: record.qrVerifyToken,
        migration: migration
          ? {
              fatherName: student?.guardianName ?? null,
              dateOfBirth: student?.dateOfBirth ?? null,
              admissionDate: migration.admissionDate,
              marksObtained: migration.marksObtained,
              marksOutOf: migration.marksOutOf,
              attendanceDays: migration.attendanceDays,
              totalWorkingDays: migration.totalWorkingDays,
              duesAmount: migration.duesAmount,
              duesPaidTill: migration.duesPaidTill,
              transferDate: record.transferDate,
              shiftedToSchool: dto.shiftedToSchool ?? null,
            }
          : undefined,
      });

      const digitalSignatureHash = createHash('sha256').update(pdf).digest('hex');
      const relativeDir = join('certificates', dto.schoolId);
      this.storage.ensureDir(this.storage.resolve(relativeDir));
      const fileKey = join(relativeDir, `${record.id}.pdf`);
      writeFileSync(this.storage.resolve(fileKey), pdf);

      const updated = await tx.certificate.update({
        where: { id: record.id },
        data: { fileKey, digitalSignatureHash },
        include: INCLUDE,
      });

      await tx.auditLog.create({
        data: {
          userId: currentUser.userId,
          schoolId: dto.schoolId,
          action: 'CERTIFICATE_ISSUED',
          entity: 'Certificate',
          entityId: record.id,
        },
      });

      return updated;
    });
  }

  // Auto-fills everything a Migration Certificate needs from the student's
  // existing records, mirroring the legacy system's "give an ID, it prints
  // itself" behaviour - staff never type in attendance/marks/dues by hand.
  private async computeMigrationSnapshot(studentId: string, schoolId: string) {
    const student = await this.prisma.studentProfile.findFirst({ where: { id: studentId } });

    const [totalWorkingDays, presentDays] = await Promise.all([
      this.prisma.attendanceRecord.count({ where: { studentId } }),
      this.prisma.attendanceRecord.count({ where: { studentId, status: 'PRESENT' } }),
    ]);

    // Only count papers for the student's own class - an exam term can
    // cover every class in the school, and each class's papers/max marks
    // differ (see ExamSubject).
    const classId = student?.sectionId
      ? (await this.prisma.section.findFirst({ where: { id: student.sectionId } }))?.classId
      : undefined;

    const latestExam = classId
      ? await this.prisma.exam.findFirst({
          where: {
            schoolId,
            deletedAt: null,
            examSubjects: { some: { classId, results: { some: { studentId } } } },
          },
          orderBy: { endDate: 'desc' },
          include: { examSubjects: { where: { classId }, include: { results: { where: { studentId } } } } },
        })
      : null;
    let marksObtained: number | null = null;
    let marksOutOf: number | null = null;
    if (latestExam) {
      let obtained = 0;
      let max = 0;
      for (const es of latestExam.examSubjects) {
        max += es.maxMarks;
        const result = es.results[0];
        if (result && !result.isAbsent && result.marksObtained != null) obtained += result.marksObtained;
      }
      marksObtained = obtained;
      marksOutOf = max;
    }

    const invoices = await this.prisma.feeInvoice.findMany({
      where: { studentId, deletedAt: null },
      select: { totalAmount: true, paidAmount: true, status: true, period: true },
    });
    const duesAmount = invoices.reduce((sum, inv) => sum + (Number(inv.totalAmount) - Number(inv.paidAmount)), 0);
    const paidPeriods = invoices.filter((inv) => inv.status === 'PAID').map((inv) => inv.period).sort();
    const duesPaidTill = paidPeriods.length ? new Date(`${paidPeriods[paidPeriods.length - 1]}-01`) : null;

    return {
      admissionDate: student?.admissionDate ?? null,
      totalWorkingDays,
      attendanceDays: presentDays,
      marksObtained,
      marksOutOf,
      duesAmount,
      duesPaidTill,
    };
  }

  private defaultBody(type: string, name: string, student: any) {
    const cls = student?.section?.class?.name ? ` of Class ${student.section.class.name}` : '';
    switch (type) {
      case 'CHARACTER':
        return `This is to certify that ${name}${cls} has been a student of good moral character during their time at this institution.`;
      case 'BONAFIDE':
        return `This is to certify that ${name}${cls} is a bonafide student of this institution.`;
      case 'TRANSFER':
      case 'LEAVING':
        return `This is to certify that ${name}${cls} has been granted a school leaving certificate and is free to seek admission elsewhere.`;
      case 'EXPERIENCE':
        return `This is to certify that ${name} has served this institution and performed their duties satisfactorily.`;
      case 'ACHIEVEMENT':
        return `This certificate is awarded to ${name}${cls} in recognition of their achievement.`;
      default:
        return `This is to certify that ${name}${cls}.`;
    }
  }

  async findAll(currentUser: ScopedUser, filters: { schoolId?: string; studentId?: string; staffId?: string; type?: CertificateType }) {
    const schoolId = resolveSchoolScope(currentUser, filters.schoolId);
    return this.prisma.certificate.findMany({
      where: {
        deletedAt: null,
        ...(schoolId ? { schoolId } : {}),
        ...(filters.studentId ? { studentId: filters.studentId } : {}),
        ...(filters.staffId ? { staffId: filters.staffId } : {}),
        ...(filters.type ? { type: filters.type } : {}),
      },
      include: INCLUDE,
      orderBy: { issuedDate: 'desc' },
    });
  }

  async findMine(userId: string) {
    const studentProfile = await this.prisma.studentProfile.findFirst({ where: { userId, deletedAt: null } });
    if (!studentProfile) return [];
    return this.prisma.certificate.findMany({
      where: { studentId: studentProfile.id, deletedAt: null },
      include: INCLUDE,
      orderBy: { issuedDate: 'desc' },
    });
  }

  async findOne(id: string, currentUser: Requester) {
    const cert = await this.prisma.certificate.findFirst({ where: { id, deletedAt: null }, include: INCLUDE });
    if (!cert) throw new NotFoundException('Certificate not found');
    await this.assertReadAccess(cert, currentUser);
    return cert;
  }

  async getPdfTarget(id: string, currentUser: Requester) {
    const cert = await this.findOne(id, currentUser);
    if (!cert.fileKey) throw new NotFoundException('Certificate PDF is not available');
    return { cert, absolutePath: this.storage.resolve(cert.fileKey) };
  }

  // Public - no auth (see CertificateVerifyController). Anyone holding the
  // QR link (an employer, another school, a parent) can confirm a
  // certificate is genuine and unrevoked, without exposing anything beyond
  // what's already printed on the certificate itself.
  async verify(token: string) {
    const cert = await this.prisma.certificate.findFirst({
      where: { qrVerifyToken: token, deletedAt: null },
      select: {
        certificateNo: true,
        type: true,
        title: true,
        issuedDate: true,
        isRevoked: true,
        school: { select: { name: true } },
        student: { select: { admissionNo: true, user: { select: { fullName: true } } } },
        staff: { select: { user: { select: { fullName: true } } } },
      },
    });
    if (!cert) throw new NotFoundException('No certificate found for this verification code');
    return {
      valid: !cert.isRevoked,
      certificateNo: cert.certificateNo,
      type: cert.type,
      title: cert.title,
      issuedDate: cert.issuedDate,
      schoolName: cert.school.name,
      holderName: cert.student?.user.fullName ?? cert.staff?.user.fullName ?? null,
      isRevoked: cert.isRevoked,
    };
  }

  async revoke(id: string, currentUser: Requester) {
    const cert = await this.prisma.certificate.findFirst({ where: { id, deletedAt: null } });
    if (!cert) throw new NotFoundException('Certificate not found');
    assertSchoolAccess(currentUser, cert.schoolId);
    const updated = await this.prisma.certificate.update({
      where: { id },
      data: { isRevoked: true, revokedAt: new Date() },
      include: INCLUDE,
    });
    await this.prisma.auditLog.create({
      data: { userId: currentUser.userId, schoolId: cert.schoolId, action: 'CERTIFICATE_REVOKED', entity: 'Certificate', entityId: id },
    });
    return updated;
  }

  private async assertReadAccess(cert: { schoolId: string; studentId: string | null }, currentUser: Requester) {
    if (currentUser.roles.some((r) => MANAGE_ROLES.includes(r))) {
      assertSchoolAccess(currentUser, cert.schoolId);
      return;
    }
    if (cert.studentId) {
      const studentProfile = await this.prisma.studentProfile.findFirst({ where: { userId: currentUser.userId } });
      if (studentProfile?.id === cert.studentId) return;
    }
    throw new ForbiddenException('You do not have access to this certificate');
  }
}
