import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AnnouncementPriority, NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CommunicationProviderService } from './communication-provider.service';
import { CreateAnnouncementDto, UpdateAnnouncementDto } from './dto/create-announcement.dto';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: CommunicationProviderService,
  ) {}

  async create(dto: CreateAnnouncementDto, currentUser: ScopedUser & { userId: string }) {
    assertSchoolAccess(currentUser, dto.schoolId);

    const created = await this.prisma.announcement.create({
      data: {
        schoolId: dto.schoolId,
        branchId: dto.branchId,
        classId: dto.classId,
        sectionId: dto.sectionId,
        title: dto.title,
        body: dto.body,
        priority: dto.priority ?? AnnouncementPriority.NORMAL,
        audienceRoles: dto.audienceRoles ?? [],
        publishAt: dto.publishAt ? new Date(dto.publishAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        createdById: currentUser.userId,
      },
    });

    if (dto.publishNow) {
      return this.publish(created.id, currentUser);
    }
    return created;
  }

  // Management list (staff view) - every announcement for the school,
  // draft or published, newest first.
  async findAll(currentUser: ScopedUser, schoolId?: string) {
    const scopedSchoolId = resolveSchoolScope(currentUser, schoolId);
    return this.prisma.announcement.findMany({
      where: {
        deletedAt: null,
        ...(scopedSchoolId ? { schoolId: scopedSchoolId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, currentUser: ScopedUser) {
    const ann = await this.findOrThrow(id, currentUser);
    return ann;
  }

  async update(id: string, dto: UpdateAnnouncementDto, currentUser: ScopedUser) {
    await this.findOrThrow(id, currentUser);
    return this.prisma.announcement.update({
      where: { id },
      data: {
        ...dto,
        publishAt: dto.publishAt ? new Date(dto.publishAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });
  }

  async remove(id: string, currentUser: ScopedUser) {
    await this.findOrThrow(id, currentUser);
    return this.prisma.announcement.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  // Publishes now: fans out one Notification per matching user, and for
  // URGENT announcements also fires the SMS/WhatsApp stub for students'
  // guardian phone numbers (best-effort, never blocks the response).
  async publish(id: string, currentUser: ScopedUser) {
    const ann = await this.findOrThrow(id, currentUser);
    if (ann.isPublished) {
      throw new ConflictException('This announcement is already published');
    }

    const targetUserIds = await this.resolveAudience(ann);

    await this.prisma.$transaction([
      this.prisma.announcement.update({
        where: { id },
        data: { isPublished: true, publishedAt: new Date() },
      }),
      this.prisma.notification.createMany({
        data: targetUserIds.map((userId) => ({
          userId,
          type: NotificationType.ANNOUNCEMENT,
          title: ann.title,
          body: ann.body,
          announcementId: ann.id,
        })),
      }),
    ]);

    if (ann.priority === AnnouncementPriority.URGENT) {
      // Fire-and-forget: don't let a provider hiccup fail the publish call.
      this.notifyUrgent(ann).catch(() => undefined);
    }

    return this.findOrThrow(id, currentUser);
  }

  // Every user whose school/branch/role (and, for class/section-scoped
  // announcements, whose own class/section) matches the announcement.
  private async resolveAudience(ann: {
    id: string;
    schoolId: string;
    branchId: string | null;
    classId: string | null;
    sectionId: string | null;
    audienceRoles: string[];
  }): Promise<string[]> {
    // Class/section-scoped announcements are shown to the enrolled students
    // only (staff still see it in the management list, just not as a
    // personal notification) - keeps "Class 5 test tomorrow" out of
    // everyone else's notification feed.
    if (ann.classId || ann.sectionId) {
      const students = await this.prisma.studentProfile.findMany({
        where: {
          deletedAt: null,
          section: ann.sectionId ? { id: ann.sectionId } : { classId: ann.classId! },
        },
        select: { userId: true },
      });
      return students.map((s) => s.userId);
    }

    const users = await this.prisma.user.findMany({
      where: {
        schoolId: ann.schoolId,
        ...(ann.branchId ? { branchId: ann.branchId } : {}),
        isActive: true,
        deletedAt: null,
        ...(ann.audienceRoles.length
          ? { userRoles: { some: { role: { name: { in: ann.audienceRoles } } } } }
          : {}),
      },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  private async notifyUrgent(ann: {
    id: string;
    schoolId: string;
    classId: string | null;
    sectionId: string | null;
    title: string;
    body: string;
  }) {
    // Same targeting as resolveAudience (school + optional class/section),
    // but reaching guardians directly by phone rather than in-app users.
    const guardianPhones = await this.prisma.studentProfile.findMany({
      where: {
        deletedAt: null,
        guardianPhone: { not: null },
        user: { schoolId: ann.schoolId },
        ...(ann.sectionId
          ? { sectionId: ann.sectionId }
          : ann.classId
            ? { section: { classId: ann.classId } }
            : {}),
      },
      select: { guardianPhone: true },
      take: 500, // safety cap - a real send job should be paginated/queued
    });
    await Promise.all(
      guardianPhones
        .filter((s) => s.guardianPhone)
        .map((s) =>
          this.provider.sendSms(s.guardianPhone as string, `${ann.title}: ${ann.body}`, ann.schoolId, ann.id),
        ),
    );
  }

  private async findOrThrow(id: string, currentUser: ScopedUser) {
    const ann = await this.prisma.announcement.findFirst({ where: { id, deletedAt: null } });
    if (!ann) throw new NotFoundException('Announcement not found');
    assertSchoolAccess(currentUser, ann.schoolId);
    return ann;
  }
}
