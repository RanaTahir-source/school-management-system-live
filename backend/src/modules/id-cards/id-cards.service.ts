import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';
import { IdCardData, IdCardPdfService } from './id-card-pdf.service';

@Injectable()
export class IdCardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: IdCardPdfService,
  ) {}

  private async activeYearLabel(schoolId: string | null | undefined): Promise<string | null> {
    if (!schoolId) return null;
    const year = await this.prisma.academicYear.findFirst({ where: { schoolId, isActive: true } });
    return year?.name ?? null;
  }

  private studentToCardData(profile: any, validThrough: string | null): IdCardData {
    const school = profile.user.school;
    const settings = school?.settings;
    return {
      schoolName: school?.name ?? 'School',
      schoolAddress: school?.address ?? null,
      schoolPhone: school?.phone ?? null,
      logoUrl: settings?.logoUrl ?? null,
      roleLabel: 'Student',
      fullName: profile.user.fullName,
      photoUrl: profile.photoUrl,
      identifierLabel: 'Admission No',
      identifierValue: profile.admissionNo,
      subLine: profile.section ? `${profile.section.class.name} - ${profile.section.name}` : null,
      loginId: profile.user.loginId,
      bloodGroup: profile.bloodGroup,
      validThrough,
    };
  }

  private teacherToCardData(profile: any, validThrough: string | null): IdCardData {
    const school = profile.user.school;
    const settings = school?.settings;
    return {
      schoolName: school?.name ?? 'School',
      schoolAddress: school?.address ?? null,
      schoolPhone: school?.phone ?? null,
      logoUrl: settings?.logoUrl ?? null,
      roleLabel: 'Teacher / Staff',
      fullName: profile.user.fullName,
      photoUrl: profile.photoUrl,
      identifierLabel: 'Employee ID',
      identifierValue: profile.employeeId,
      subLine: profile.subjectSpecialty ?? profile.qualification ?? null,
      loginId: profile.user.loginId,
      bloodGroup: null,
      validThrough,
    };
  }

  private readonly studentInclude = {
    user: {
      select: {
        fullName: true,
        loginId: true,
        schoolId: true,
        school: { include: { settings: true } },
      },
    },
    section: { include: { class: true } },
  } as const;

  private readonly teacherInclude = {
    user: {
      select: {
        fullName: true,
        loginId: true,
        schoolId: true,
        branchId: true,
        school: { include: { settings: true } },
      },
    },
  } as const;

  async studentCard(studentId: string, currentUser: ScopedUser): Promise<Buffer> {
    const profile = await this.prisma.studentProfile.findFirst({
      where: { id: studentId, deletedAt: null },
      include: this.studentInclude,
    });
    if (!profile) throw new NotFoundException('Student not found');
    assertSchoolAccess(currentUser, profile.user.schoolId);
    const validThrough = await this.activeYearLabel(profile.user.schoolId);
    return this.pdf.buildSingleCardPdf(this.studentToCardData(profile, validThrough));
  }

  async teacherCard(teacherId: string, currentUser: ScopedUser): Promise<Buffer> {
    const profile = await this.prisma.teacherProfile.findFirst({
      where: { id: teacherId, deletedAt: null },
      include: this.teacherInclude,
    });
    if (!profile) throw new NotFoundException('Teacher not found');
    assertSchoolAccess(currentUser, profile.user.schoolId);
    const validThrough = await this.activeYearLabel(profile.user.schoolId);
    return this.pdf.buildSingleCardPdf(this.teacherToCardData(profile, validThrough));
  }

  // A whole section (class) printed on A4 sheets, for a Director/Admin to
  // print-and-cut before the start of a new term.
  async studentBatchBySection(sectionId: string, currentUser: ScopedUser): Promise<Buffer> {
    const section = await this.prisma.section.findFirst({ where: { id: sectionId }, include: { class: true } });
    if (!section) throw new NotFoundException('Section not found');
    assertSchoolAccess(currentUser, section.class.schoolId);

    const profiles = await this.prisma.studentProfile.findMany({
      where: { sectionId, deletedAt: null, status: 'ACTIVE' },
      include: this.studentInclude,
      orderBy: { admissionNo: 'asc' },
    });
    const validThrough = await this.activeYearLabel(section.class.schoolId);
    return this.pdf.buildBatchPdf(profiles.map((p) => this.studentToCardData(p, validThrough)));
  }

  // Every active teacher in one branch (User.branchId) - the natural unit
  // for "print ID cards for this campus".
  async teacherBatchByBranch(branchId: string, currentUser: ScopedUser): Promise<Buffer> {
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId } });
    if (!branch) throw new NotFoundException('Branch not found');
    assertSchoolAccess(currentUser, branch.schoolId);

    const profiles = await this.prisma.teacherProfile.findMany({
      where: { deletedAt: null, isActive: true, user: { branchId } },
      include: this.teacherInclude,
      orderBy: { employeeId: 'asc' },
    });
    const validThrough = await this.activeYearLabel(branch.schoolId);
    return this.pdf.buildBatchPdf(profiles.map((p) => this.teacherToCardData(p, validThrough)));
  }

  // Every active teacher across the whole school (all branches) - useful for
  // a Director who wants a single print run instead of per-branch.
  async teacherBatchBySchool(schoolId: string, currentUser: ScopedUser): Promise<Buffer> {
    const effectiveSchoolId = resolveSchoolScope(currentUser, schoolId);
    assertSchoolAccess(currentUser, effectiveSchoolId ?? schoolId);

    const profiles = await this.prisma.teacherProfile.findMany({
      where: { deletedAt: null, isActive: true, user: { schoolId: effectiveSchoolId ?? schoolId } },
      include: this.teacherInclude,
      orderBy: { employeeId: 'asc' },
    });
    const validThrough = await this.activeYearLabel(effectiveSchoolId ?? schoolId);
    return this.pdf.buildBatchPdf(profiles.map((p) => this.teacherToCardData(p, validThrough)));
  }
}
