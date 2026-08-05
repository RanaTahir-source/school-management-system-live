import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface StudentLookupMatch {
  studentId: string;
  admissionNo: string;
  studentName: string;
  classSection: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  schoolId: string | null;
  branchId: string | null;
  // ACTIVE = currently enrolled. LEFT = the student's profile has been removed
  // (StudentsService.remove() sets deletedAt + isActive:false) — withdrawn,
  // graduated, transferred, or struck off. The ERP doesn't currently distinguish
  // *why* a student left, only that they have.
  enrollmentStatus: 'ACTIVE' | 'LEFT';
  leftAt: string | null;
}

@Injectable()
export class VoiceIntegrationService {
  constructor(private readonly prisma: PrismaService) {}

  // Looks up student(s) for the Voice Agent Service's caller-verification step.
  //
  // Preferred: admissionNo — unique, unambiguous, and the caller can read it
  // straight off their admission slip/report card.
  // Fallback: phone — matches StudentProfile.guardianPhone. A single guardian
  // phone can legitimately match MORE THAN ONE student (siblings), so this
  // always returns an array — the caller-side conversation must handle 0, 1,
  // or many matches differently.
  //
  // Deliberately includes students who have left (deletedAt set / isActive
  // false) rather than filtering them out, so the voice agent can tell the
  // caller "this student is no longer enrolled here" instead of treating a
  // former student's parent as a complete stranger.
  async lookupStudent(params: { admissionNo?: string; phone?: string }): Promise<{ matches: StudentLookupMatch[] }> {
    const admissionNo = params.admissionNo?.trim();
    const phone = params.phone?.trim();

    if (!admissionNo && !phone) {
      return { matches: [] };
    }

    const profiles = await this.prisma.studentProfile.findMany({
      where: admissionNo ? { admissionNo } : { guardianPhone: phone },
      include: {
        user: { select: { fullName: true, schoolId: true, branchId: true } },
        section: { include: { class: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      matches: profiles.map((profile) => ({
        studentId: profile.id,
        admissionNo: profile.admissionNo,
        studentName: profile.user.fullName,
        classSection: profile.section ? `${profile.section.class.name} - ${profile.section.name}` : null,
        guardianName: profile.guardianName,
        guardianPhone: profile.guardianPhone,
        schoolId: profile.user.schoolId,
        branchId: profile.user.branchId,
        enrollmentStatus: profile.isActive === false || profile.deletedAt !== null ? 'LEFT' : 'ACTIVE',
        leftAt: profile.deletedAt ? profile.deletedAt.toISOString() : null,
      })),
    };
  }
}
