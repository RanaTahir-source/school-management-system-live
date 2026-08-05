import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { writeFileSync } from 'fs';
import { DocumentCategory, DocumentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';

type Requester = ScopedUser & { userId: string };

// Roles that may see documents flagged isConfidential (CNIC, medical, etc.)
// belonging to someone else - on top of the normal school/ownership check.
const CONFIDENTIAL_ROLES = ['DIRECTOR', 'ADMIN', 'PRINCIPAL'];
const MANAGE_ROLES = ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'RECEPTIONIST'];

const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const INCLUDE = {
  student: { select: { id: true, admissionNo: true, user: { select: { fullName: true } } } },
  teacher: { select: { id: true, employeeId: true, user: { select: { fullName: true } } } },
  staff: { select: { id: true, designation: true, user: { select: { fullName: true } } } },
  uploadedBy: { select: { id: true, fullName: true } },
  verifiedBy: { select: { id: true, fullName: true } },
} as const;

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async create(dto: CreateDocumentDto, file: Express.Multer.File | undefined, currentUser: Requester) {
    assertSchoolAccess(currentUser, dto.schoolId);

    if (!file) throw new BadRequestException('A file is required');
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Unsupported file type. Allowed: PDF, JPG, PNG, WEBP.');
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('File is larger than the 10MB limit');
    }
    this.assertOwnerMatchesType(dto);
    await this.assertOwnerBelongsToSchool(dto);

    const relativeDir = join('documents', dto.schoolId);
    this.storage.ensureDir(this.storage.resolve(relativeDir));
    const fileKey = join(relativeDir, `${randomUUID()}${extname(file.originalname) || ''}`);
    writeFileSync(this.storage.resolve(fileKey), file.buffer);

    const created = await this.prisma.document.create({
      data: {
        schoolId: dto.schoolId,
        ownerType: dto.ownerType,
        studentId: dto.studentId,
        teacherId: dto.teacherId,
        staffId: dto.staffId,
        category: dto.category,
        title: dto.title,
        fileKey,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSizeBytes: file.size,
        isConfidential: dto.isConfidential ?? false,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        uploadedById: currentUser.userId,
      },
      include: INCLUDE,
    });

    await this.prisma.auditLog.create({
      data: {
        userId: currentUser.userId,
        schoolId: dto.schoolId,
        action: 'DOCUMENT_UPLOADED',
        entity: 'Document',
        entityId: created.id,
      },
    });

    return created;
  }

  async findAll(
    currentUser: ScopedUser,
    filters: { schoolId?: string; studentId?: string; teacherId?: string; staffId?: string; category?: DocumentCategory; status?: DocumentStatus },
  ) {
    const schoolId = resolveSchoolScope(currentUser, filters.schoolId);
    return this.prisma.document.findMany({
      where: {
        deletedAt: null,
        ...(schoolId ? { schoolId } : {}),
        ...(filters.studentId ? { studentId: filters.studentId } : {}),
        ...(filters.teacherId ? { teacherId: filters.teacherId } : {}),
        ...(filters.staffId ? { staffId: filters.staffId } : {}),
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  // "My documents" for a STUDENT/TEACHER-role account - resolves their own
  // profile id first since the JWT only carries userId, not profile ids.
  async findMine(userId: string) {
    const [studentProfile, teacherProfile] = await Promise.all([
      this.prisma.studentProfile.findFirst({ where: { userId, deletedAt: null } }),
      this.prisma.teacherProfile.findFirst({ where: { userId, deletedAt: null } }),
    ]);
    if (!studentProfile && !teacherProfile) return [];

    return this.prisma.document.findMany({
      where: {
        deletedAt: null,
        OR: [
          ...(studentProfile ? [{ studentId: studentProfile.id }] : []),
          ...(teacherProfile ? [{ teacherId: teacherProfile.id }] : []),
        ],
      },
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, currentUser: Requester) {
    const doc = await this.prisma.document.findFirst({ where: { id, deletedAt: null }, include: INCLUDE });
    if (!doc) throw new NotFoundException('Document not found');
    await this.assertReadAccess(doc, currentUser);
    return doc;
  }

  async getDownloadTarget(id: string, currentUser: Requester) {
    const doc = await this.findOne(id, currentUser);
    return { doc, absolutePath: this.storage.resolve(doc.fileKey) };
  }

  async update(id: string, dto: UpdateDocumentDto, currentUser: ScopedUser & { userId: string }) {
    const doc = await this.prisma.document.findFirst({ where: { id, deletedAt: null } });
    if (!doc) throw new NotFoundException('Document not found');
    assertSchoolAccess(currentUser, doc.schoolId);

    const isVerifying = dto.status && dto.status !== doc.status;
    const updated = await this.prisma.document.update({
      where: { id },
      data: {
        title: dto.title,
        status: dto.status,
        rejectionReason: dto.status === 'REJECTED' ? dto.rejectionReason : dto.status ? null : undefined,
        verifiedById: isVerifying ? currentUser.userId : undefined,
        verifiedAt: isVerifying ? new Date() : undefined,
      },
      include: INCLUDE,
    });

    if (isVerifying) {
      await this.prisma.auditLog.create({
        data: {
          userId: currentUser.userId,
          schoolId: doc.schoolId,
          action: `DOCUMENT_${dto.status}`,
          entity: 'Document',
          entityId: id,
        },
      });
    }
    return updated;
  }

  async remove(id: string, currentUser: ScopedUser & { userId?: string }) {
    const doc = await this.prisma.document.findFirst({ where: { id, deletedAt: null } });
    if (!doc) throw new NotFoundException('Document not found');
    assertSchoolAccess(currentUser, doc.schoolId);

    const removed = await this.prisma.document.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.prisma.auditLog.create({
      data: {
        userId: currentUser.userId ?? null,
        schoolId: doc.schoolId,
        action: 'DOCUMENT_DELETED',
        entity: 'Document',
        entityId: id,
      },
    });
    // File is intentionally left on disk (not storage.remove()'d) so a
    // deleted record can still be recovered/audited - a periodic cleanup
    // job can sweep orphaned files older than the retention window.
    return removed;
  }

  private assertOwnerMatchesType(dto: CreateDocumentDto) {
    const map: Record<string, string | undefined> = {
      STUDENT: dto.studentId,
      TEACHER: dto.teacherId,
      STAFF: dto.staffId,
    };
    if (!map[dto.ownerType]) {
      throw new BadRequestException(`ownerType is ${dto.ownerType} but no matching id was provided`);
    }
  }

  private async assertOwnerBelongsToSchool(dto: CreateDocumentDto) {
    if (dto.ownerType === 'STUDENT' && dto.studentId) {
      const p = await this.prisma.studentProfile.findFirst({ where: { id: dto.studentId, deletedAt: null }, include: { user: true } });
      if (!p || p.user.schoolId !== dto.schoolId) throw new BadRequestException('Student does not belong to the given school');
    }
    if (dto.ownerType === 'TEACHER' && dto.teacherId) {
      const p = await this.prisma.teacherProfile.findFirst({ where: { id: dto.teacherId, deletedAt: null }, include: { user: true } });
      if (!p || p.user.schoolId !== dto.schoolId) throw new BadRequestException('Teacher does not belong to the given school');
    }
    if (dto.ownerType === 'STAFF' && dto.staffId) {
      const p = await this.prisma.staffProfile.findFirst({ where: { id: dto.staffId, deletedAt: null } });
      if (!p || p.schoolId !== dto.schoolId) throw new BadRequestException('Staff member does not belong to the given school');
    }
  }

  private async assertReadAccess(doc: { schoolId: string; studentId: string | null; teacherId: string | null; isConfidential: boolean }, currentUser: Requester) {
    const isManager = currentUser.roles.some((r) => MANAGE_ROLES.includes(r));
    if (isManager) {
      assertSchoolAccess(currentUser, doc.schoolId);
    } else {
      // STUDENT/TEACHER: only their own record.
      const [studentProfile, teacherProfile] = await Promise.all([
        doc.studentId ? this.prisma.studentProfile.findFirst({ where: { userId: currentUser.userId } }) : null,
        doc.teacherId ? this.prisma.teacherProfile.findFirst({ where: { userId: currentUser.userId } }) : null,
      ]);
      const isOwner = (doc.studentId && studentProfile?.id === doc.studentId) || (doc.teacherId && teacherProfile?.id === doc.teacherId);
      if (!isOwner) throw new ForbiddenException("You do not have access to this document");
    }

    if (doc.isConfidential && !currentUser.roles.some((r) => CONFIDENTIAL_ROLES.includes(r))) {
      // Owners can still see their own confidential documents.
      const [studentProfile, teacherProfile] = await Promise.all([
        doc.studentId ? this.prisma.studentProfile.findFirst({ where: { userId: currentUser.userId } }) : null,
        doc.teacherId ? this.prisma.teacherProfile.findFirst({ where: { userId: currentUser.userId } }) : null,
      ]);
      const isOwner = (doc.studentId && studentProfile?.id === doc.studentId) || (doc.teacherId && teacherProfile?.id === doc.teacherId);
      if (!isOwner) throw new ForbiddenException('This document is marked confidential');
    }
  }
}
