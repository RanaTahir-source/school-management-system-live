import { Injectable, NotFoundException } from '@nestjs/common';
import { MaterialType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudyMaterialDto, UpdateStudyMaterialDto } from './dto/create-study-material.dto';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';

@Injectable()
export class StudyMaterialsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateStudyMaterialDto, currentUser: ScopedUser & { userId: string }) {
    assertSchoolAccess(currentUser, dto.schoolId);
    return this.prisma.studyMaterial.create({
      data: {
        schoolId: dto.schoolId,
        classId: dto.classId,
        subjectId: dto.subjectId,
        title: dto.title,
        description: dto.description,
        fileUrl: dto.fileUrl,
        type: dto.type ?? MaterialType.DOCUMENT,
        uploadedById: currentUser.userId,
      },
    });
  }

  findAll(currentUser: ScopedUser, schoolId?: string, classId?: string, subjectId?: string) {
    const scopedSchoolId = resolveSchoolScope(currentUser, schoolId);
    return this.prisma.studyMaterial.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        ...(scopedSchoolId ? { schoolId: scopedSchoolId } : {}),
        ...(classId ? { OR: [{ classId }, { classId: null }] } : {}),
        ...(subjectId ? { subjectId } : {}),
      },
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        uploadedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, dto: UpdateStudyMaterialDto, currentUser: ScopedUser) {
    const material = await this.prisma.studyMaterial.findFirst({ where: { id, deletedAt: null } });
    if (!material) throw new NotFoundException('Study material not found');
    assertSchoolAccess(currentUser, material.schoolId);

    const updated = await this.prisma.studyMaterial.update({
      where: { id },
      data: { ...dto },
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        uploadedBy: { select: { id: true, fullName: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: currentUser.userId,
        schoolId: material.schoolId,
        action: 'STUDY_MATERIAL_UPDATED',
        entity: 'StudyMaterial',
        entityId: id,
      },
    });

    return updated;
  }

  async remove(id: string, currentUser: ScopedUser) {
    const material = await this.prisma.studyMaterial.findFirst({ where: { id, deletedAt: null } });
    if (!material) throw new NotFoundException('Study material not found');
    assertSchoolAccess(currentUser, material.schoolId);
    return this.prisma.studyMaterial.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }
}
