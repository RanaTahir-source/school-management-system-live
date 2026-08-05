import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AssignTransportDto } from './dto/assign-transport.dto';
import { assertSchoolAccess, ScopedUser } from '../../common/utils/school-scope';

const STUDENT_TRANSPORT_INCLUDE = {
  routeStop: {
    include: {
      route: {
        include: {
          vehicle: { select: { id: true, registrationNo: true, vehicleType: true } },
        },
      },
    },
  },
} as const;

@Injectable()
export class StudentTransportService {
  constructor(private readonly prisma: PrismaService) {}

  async assign(studentId: string, dto: AssignTransportDto, currentUser: ScopedUser) {
    const student = await this.prisma.studentProfile.findFirst({
      where: { id: studentId, deletedAt: null },
      include: { user: { select: { schoolId: true } } },
    });
    if (!student) throw new NotFoundException('Student not found');
    assertSchoolAccess(currentUser, student.user.schoolId);

    if (dto.routeStopId) {
      const stop = await this.prisma.routeStop.findFirst({
        where: { id: dto.routeStopId },
        include: { route: true },
      });
      if (!stop) throw new NotFoundException('Route stop not found');
      if (stop.route.schoolId !== student.user.schoolId) {
        throw new ConflictException('This route belongs to a different school');
      }
    }

    return this.prisma.studentProfile.update({
      where: { id: studentId },
      data: { routeStopId: dto.routeStopId ?? null },
      include: STUDENT_TRANSPORT_INCLUDE,
    });
  }

  async mine(userId: string) {
    const student = await this.prisma.studentProfile.findFirst({
      where: { userId },
      include: STUDENT_TRANSPORT_INCLUDE,
    });
    if (!student) throw new NotFoundException('No student profile linked to this account');
    return student.routeStop;
  }
}
