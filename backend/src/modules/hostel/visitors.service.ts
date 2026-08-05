import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LogVisitorDto } from './dto/log-visitor.dto';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';

const VISITOR_INCLUDE = {
  student: { select: { id: true, admissionNo: true, user: { select: { fullName: true } } } },
  recordedBy: { select: { id: true, fullName: true } },
} as const;

@Injectable()
export class VisitorsService {
  constructor(private readonly prisma: PrismaService) {}

  async checkIn(dto: LogVisitorDto, currentUser: ScopedUser & { userId: string }) {
    const student = await this.prisma.studentProfile.findFirst({
      where: { id: dto.studentId, deletedAt: null },
      include: { user: { select: { schoolId: true } } },
    });
    if (!student) throw new NotFoundException('Student not found');
    assertSchoolAccess(currentUser, student.user.schoolId);

    return this.prisma.hostelVisitor.create({
      data: {
        studentId: dto.studentId,
        visitorName: dto.visitorName,
        relation: dto.relation,
        phone: dto.phone,
        purpose: dto.purpose,
        recordedById: currentUser.userId,
      },
      include: VISITOR_INCLUDE,
    });
  }

  async checkOut(id: string, currentUser: ScopedUser) {
    const visitor = await this.findOrThrow(id, currentUser);
    if (visitor.checkOutAt) {
      throw new ConflictException('This visitor has already checked out');
    }
    return this.prisma.hostelVisitor.update({
      where: { id },
      data: { checkOutAt: new Date() },
      include: VISITOR_INCLUDE,
    });
  }

  findAll(currentUser: ScopedUser, schoolId?: string, studentId?: string) {
    const scopedSchoolId = resolveSchoolScope(currentUser, schoolId);
    return this.prisma.hostelVisitor.findMany({
      where: {
        ...(studentId ? { studentId } : {}),
        ...(scopedSchoolId ? { student: { user: { schoolId: scopedSchoolId } } } : {}),
      },
      include: VISITOR_INCLUDE,
      orderBy: { checkInAt: 'desc' },
    });
  }

  private async findOrThrow(id: string, currentUser: ScopedUser) {
    const visitor = await this.prisma.hostelVisitor.findFirst({
      where: { id },
      include: { student: { include: { user: { select: { schoolId: true } } } } },
    });
    if (!visitor) throw new NotFoundException('Visitor record not found');
    assertSchoolAccess(currentUser, visitor.student.user.schoolId);
    return visitor;
  }
}
