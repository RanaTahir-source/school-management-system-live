import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LeaveApplicantType, LeaveStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { ReviewLeaveRequestDto } from './dto/review-leave-request.dto';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';

type CurrentUser = { userId: string; roles: string[]; schoolId?: string | null };

const REVIEW_ROLES = ['DIRECTOR', 'ADMIN', 'PRINCIPAL'];

@Injectable()
export class LeaveService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLeaveRequestDto, currentUser: CurrentUser) {
    const from = new Date(dto.fromDate);
    const to = new Date(dto.toDate);
    if (to < from) {
      throw new BadRequestException('"toDate" cannot be before "fromDate"');
    }

    if (!currentUser.schoolId) {
      throw new BadRequestException('Your account is not assigned to a school, so leave requests are not available');
    }

    let applicantType: LeaveApplicantType;
    let studentId: string | undefined;

    if (currentUser.roles.includes('PARENT')) {
      if (!dto.studentId) {
        throw new BadRequestException('studentId is required when applying on behalf of a child');
      }
      const link = await this.prisma.parentStudent.findUnique({
        where: { parentId_studentId: { parentId: currentUser.userId, studentId: dto.studentId } },
      });
      if (!link) throw new ForbiddenException('This student is not linked to your account');
      applicantType = 'STUDENT';
      studentId = dto.studentId;
    } else if (currentUser.roles.includes('STUDENT')) {
      const profile = await this.prisma.studentProfile.findFirst({
        where: { userId: currentUser.userId, deletedAt: null },
      });
      if (!profile) throw new NotFoundException('Student profile not found for this account');
      applicantType = 'STUDENT';
      studentId = profile.id;
    } else if (currentUser.roles.includes('TEACHER')) {
      applicantType = 'TEACHER';
    } else {
      applicantType = 'STAFF';
    }

    return this.prisma.leaveRequest.create({
      data: {
        schoolId: currentUser.schoolId,
        applicantType,
        studentId,
        staffUserId: applicantType === 'STUDENT' ? undefined : currentUser.userId,
        submittedById: currentUser.userId,
        fromDate: from,
        toDate: to,
        reason: dto.reason,
      },
    });
  }

  async review(id: string, dto: ReviewLeaveRequestDto, currentUser: CurrentUser) {
    if (dto.status !== 'APPROVED' && dto.status !== 'REJECTED') {
      throw new BadRequestException('status must be APPROVED or REJECTED');
    }

    const existing = await this.prisma.leaveRequest.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException('Leave request not found');
    assertSchoolAccess(currentUser, existing.schoolId);

    if (existing.status !== 'PENDING') {
      throw new BadRequestException(`This request has already been ${existing.status.toLowerCase()}`);
    }

    return this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: dto.status,
        reviewRemarks: dto.reviewRemarks,
        reviewedById: currentUser.userId,
        reviewedAt: new Date(),
      },
    });
  }

  // The applicant can withdraw their own request while it's still pending.
  async cancel(id: string, currentUser: CurrentUser) {
    const existing = await this.prisma.leaveRequest.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException('Leave request not found');

    const isOwner =
      existing.staffUserId === currentUser.userId ||
      existing.submittedById === currentUser.userId ||
      (await this.isOwnStudentRequest(existing.studentId, currentUser.userId));
    const isOverride = currentUser.roles.some((r) => REVIEW_ROLES.includes(r));
    if (!isOwner && !isOverride) {
      throw new ForbiddenException('You can only cancel your own leave request');
    }
    if (existing.status !== 'PENDING') {
      throw new BadRequestException(`This request has already been ${existing.status.toLowerCase()}`);
    }

    return this.prisma.leaveRequest.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  private async isOwnStudentRequest(studentId: string | null, userId: string) {
    if (!studentId) return false;
    const profile = await this.prisma.studentProfile.findFirst({ where: { id: studentId } });
    return profile?.userId === userId;
  }

  // Staff view: every request in scope, optionally filtered by status.
  async findAll(currentUser: ScopedUser, status?: LeaveStatus) {
    const schoolId = resolveSchoolScope(currentUser, undefined);

    return this.prisma.leaveRequest.findMany({
      where: {
        deletedAt: null,
        ...(schoolId ? { schoolId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        student: { select: { admissionNo: true, user: { select: { fullName: true } } } },
        staffUser: { select: { fullName: true } },
        submittedBy: { select: { fullName: true } },
        reviewedBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // The caller's own leave history - for a Parent, this means every request
  // they've filed on behalf of any linked child.
  async findMine(currentUser: CurrentUser) {
    if (currentUser.roles.includes('PARENT')) {
      return this.prisma.leaveRequest.findMany({
        where: { submittedById: currentUser.userId, deletedAt: null },
        include: {
          student: { select: { admissionNo: true, user: { select: { fullName: true } } } },
          reviewedBy: { select: { fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (currentUser.roles.includes('STUDENT')) {
      const profile = await this.prisma.studentProfile.findFirst({
        where: { userId: currentUser.userId, deletedAt: null },
      });
      if (!profile) return [];
      return this.prisma.leaveRequest.findMany({
        where: { studentId: profile.id, deletedAt: null },
        include: { reviewedBy: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
      });
    }

    return this.prisma.leaveRequest.findMany({
      where: { staffUserId: currentUser.userId, deletedAt: null },
      include: { reviewedBy: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
