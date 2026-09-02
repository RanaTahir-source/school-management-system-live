import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';
import { CreateEnquiryDto } from './dto/create-enquiry.dto';
import { PublicCreateEnquiryDto } from './dto/public-create-enquiry.dto';
import { UpdateEnquiryDto } from './dto/update-enquiry.dto';
import { AddFollowUpDto } from './dto/add-follow-up.dto';

const ASSIGNED_SELECT = { id: true, fullName: true } as const;

@Injectable()
export class AdmissionsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly include = {
    branch: { select: { id: true, name: true } },
    assignedTo: { select: ASSIGNED_SELECT },
    createdBy: { select: ASSIGNED_SELECT },
    convertedStudent: { select: { id: true, admissionNo: true } },
    followUps: {
      orderBy: { createdAt: 'desc' as const },
      include: { createdBy: { select: ASSIGNED_SELECT } },
    },
  };

  // Staff logging a lead they took by phone/walk-in/referral themselves.
  async create(dto: CreateEnquiryDto, currentUser: ScopedUser & { userId: string }) {
    assertSchoolAccess(currentUser, dto.schoolId);

    const enquiry = await this.prisma.admissionEnquiry.create({
      data: {
        schoolId: dto.schoolId,
        branchId: dto.branchId,
        childName: dto.childName,
        desiredClassName: dto.desiredClassName,
        parentName: dto.parentName,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        source: dto.source ?? 'OTHER',
        notes: dto.notes,
        assignedToId: dto.assignedToId,
        nextFollowUpDate: dto.nextFollowUpDate ? new Date(dto.nextFollowUpDate) : undefined,
        createdById: currentUser.userId,
      },
      include: this.include,
    });

    await this.prisma.auditLog.create({
      data: {
        userId: currentUser.userId,
        schoolId: dto.schoolId,
        action: 'ADMISSION_ENQUIRY_CREATED',
        entity: 'AdmissionEnquiry',
        entityId: enquiry.id,
      },
    });

    return enquiry;
  }

  // Submitted from the school's public website - no auth. The school is
  // identified by its short `code`, not an internal id, since a public form
  // shouldn't need to know database ids.
  async publicCreate(schoolCode: string, dto: PublicCreateEnquiryDto) {
    const school = await this.prisma.school.findUnique({ where: { code: schoolCode } });
    if (!school || !school.isActive) throw new NotFoundException('School not found');

    return this.prisma.admissionEnquiry.create({
      data: {
        schoolId: school.id,
        childName: dto.childName,
        desiredClassName: dto.desiredClassName,
        parentName: dto.parentName,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        source: dto.source ?? 'WEBSITE',
        submittedOnline: true,
      },
    });
  }

  async findAll(
    currentUser: ScopedUser,
    filters: { schoolId?: string; branchId?: string; status?: string; source?: string; assignedToId?: string; search?: string },
  ) {
    const effectiveSchoolId = resolveSchoolScope(currentUser, filters.schoolId);

    return this.prisma.admissionEnquiry.findMany({
      where: {
        deletedAt: null,
        ...(effectiveSchoolId ? { schoolId: effectiveSchoolId } : {}),
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
        ...(filters.status ? { status: filters.status as any } : {}),
        ...(filters.source ? { source: filters.source as any } : {}),
        ...(filters.assignedToId ? { assignedToId: filters.assignedToId } : {}),
        ...(filters.search
          ? {
              OR: [
                { childName: { contains: filters.search, mode: 'insensitive' } },
                { parentName: { contains: filters.search, mode: 'insensitive' } },
                { phone: { contains: filters.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: this.include,
      orderBy: { createdAt: 'desc' },
    });
  }

  // Pipeline counts for a dashboard widget - "N new, N in follow-up, N
  // admitted this month" etc. Grouped both by stage and by lead source so a
  // Director can see which channel actually produces enrollments.
  async summary(currentUser: ScopedUser, schoolId?: string) {
    const effectiveSchoolId = resolveSchoolScope(currentUser, schoolId);
    const where = effectiveSchoolId ? { schoolId: effectiveSchoolId, deletedAt: null } : { deletedAt: null };

    const [byStatus, bySource, total] = await Promise.all([
      this.prisma.admissionEnquiry.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.prisma.admissionEnquiry.groupBy({ by: ['source'], where, _count: { _all: true } }),
      this.prisma.admissionEnquiry.count({ where }),
    ]);

    return {
      total,
      byStatus: byStatus.map((r) => ({ status: r.status, count: r._count._all })),
      bySource: bySource.map((r) => ({ source: r.source, count: r._count._all })),
    };
  }

  async findOne(id: string, currentUser: ScopedUser) {
    const enquiry = await this.prisma.admissionEnquiry.findFirst({
      where: { id, deletedAt: null },
      include: this.include,
    });
    if (!enquiry) throw new NotFoundException('Enquiry not found');
    assertSchoolAccess(currentUser, enquiry.schoolId);
    return enquiry;
  }

  async update(id: string, dto: UpdateEnquiryDto, currentUser: ScopedUser & { userId: string }) {
    const enquiry = await this.findOne(id, currentUser);

    const updated = await this.prisma.admissionEnquiry.update({
      where: { id },
      data: {
        ...dto,
        nextFollowUpDate: dto.nextFollowUpDate ? new Date(dto.nextFollowUpDate) : undefined,
      },
      include: this.include,
    });

    if (dto.status && dto.status !== enquiry.status) {
      await this.prisma.auditLog.create({
        data: {
          userId: currentUser.userId,
          schoolId: enquiry.schoolId,
          action: 'ADMISSION_ENQUIRY_STATUS_CHANGED',
          entity: 'AdmissionEnquiry',
          entityId: id,
          metadata: { from: enquiry.status, to: dto.status },
        },
      });
    }

    return updated;
  }

  // Mistaken/duplicate entries only - genuine "didn't proceed" leads should
  // be marked REJECTED/LOST via update() instead, so their history is kept.
  async remove(id: string, currentUser: ScopedUser & { userId: string }) {
    const enquiry = await this.findOne(id, currentUser);
    const removed = await this.prisma.admissionEnquiry.update({ where: { id }, data: { deletedAt: new Date() } });

    await this.prisma.auditLog.create({
      data: {
        userId: currentUser.userId,
        schoolId: enquiry.schoolId,
        action: 'ADMISSION_ENQUIRY_DELETED',
        entity: 'AdmissionEnquiry',
        entityId: id,
      },
    });

    return removed;
  }

  // Appends to the timestamped follow-up log (never overwrites), and bumps
  // the lead out of NEW/CONTACTED into FOLLOW_UP automatically - staff don't
  // have to remember to change the status manually every time they log a call.
  async addFollowUp(id: string, dto: AddFollowUpDto, currentUser: ScopedUser & { userId: string }) {
    const enquiry = await this.findOne(id, currentUser);
    if (!dto.note?.trim()) throw new BadRequestException('A follow-up note is required');

    await this.prisma.admissionFollowUp.create({
      data: {
        enquiryId: id,
        note: dto.note,
        nextFollowUpDate: dto.nextFollowUpDate ? new Date(dto.nextFollowUpDate) : undefined,
        createdById: currentUser.userId,
      },
    });

    return this.prisma.admissionEnquiry.update({
      where: { id },
      data: {
        nextFollowUpDate: dto.nextFollowUpDate ? new Date(dto.nextFollowUpDate) : enquiry.nextFollowUpDate,
        status: ['NEW', 'CONTACTED'].includes(enquiry.status) ? 'FOLLOW_UP' : enquiry.status,
      },
      include: this.include,
    });
  }
}
