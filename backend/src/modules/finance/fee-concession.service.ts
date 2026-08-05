import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeeConcessionDto } from './dto/create-fee-concession.dto';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';

@Injectable()
export class FeeConcessionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateFeeConcessionDto, currentUser: ScopedUser) {
    const student = await this.prisma.studentProfile.findFirst({
      where: { id: dto.studentId, deletedAt: null },
      include: { user: true },
    });
    if (!student) throw new NotFoundException('Student not found');
    assertSchoolAccess(currentUser, student.user.schoolId);

    return this.prisma.feeConcession.create({
      data: {
        studentId: dto.studentId,
        feeHeadId: dto.feeHeadId,
        type: dto.type,
        value: dto.value,
        reason: dto.reason,
      },
    });
  }

  async findForStudent(studentId: string, currentUser: ScopedUser) {
    const student = await this.prisma.studentProfile.findFirst({
      where: { id: studentId, deletedAt: null },
      include: { user: true },
    });
    if (!student) throw new NotFoundException('Student not found');
    assertSchoolAccess(currentUser, student.user.schoolId);

    return this.prisma.feeConcession.findMany({
      where: { studentId, isActive: true },
      include: { feeHead: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // All active concessions for a school, for the printable concession list
  // report - joined through student.user.schoolId since FeeConcession
  // itself doesn't carry a schoolId column.
  async findAllForSchool(currentUser: ScopedUser, schoolIdFilter?: string) {
    const schoolId = resolveSchoolScope(currentUser, schoolIdFilter);
    return this.prisma.feeConcession.findMany({
      where: {
        isActive: true,
        ...(schoolId ? { student: { user: { schoolId } } } : {}),
      },
      include: {
        feeHead: true,
        student: { include: { user: { include: { school: true } }, section: { include: { class: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(id: string, currentUser: ScopedUser) {
    const concession = await this.prisma.feeConcession.findFirst({
      where: { id },
      include: { student: { include: { user: true } } },
    });
    if (!concession) throw new NotFoundException('Concession not found');
    assertSchoolAccess(currentUser, concession.student.user.schoolId);

    return this.prisma.feeConcession.update({ where: { id }, data: { isActive: false } });
  }
}
