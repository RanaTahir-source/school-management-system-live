import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRouteStopDto, UpdateRouteStopDto } from './dto/create-route-stop.dto';
import { assertSchoolAccess, ScopedUser } from '../../common/utils/school-scope';

@Injectable()
export class RouteStopsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRouteStopDto, currentUser: ScopedUser) {
    const route = await this.prisma.route.findFirst({ where: { id: dto.routeId, deletedAt: null } });
    if (!route) throw new NotFoundException('Route not found');
    assertSchoolAccess(currentUser, route.schoolId);

    return this.prisma.routeStop.create({
      data: {
        routeId: dto.routeId,
        name: dto.name,
        order: dto.order ?? 0,
        pickupTime: dto.pickupTime,
      },
    });
  }

  async update(id: string, dto: UpdateRouteStopDto, currentUser: ScopedUser) {
    const stop = await this.findStopOrThrow(id, currentUser);
    return this.prisma.routeStop.update({ where: { id: stop.id }, data: dto });
  }

  async remove(id: string, currentUser: ScopedUser) {
    const stop = await this.findStopOrThrow(id, currentUser);
    // Stops aren't soft-deletable via a deletedAt column (no such field on
    // RouteStop) - unassign any students first so no dangling FK is left,
    // then hard-delete. Stops are just labels on a route, not audit-worthy
    // records like Book/StudyMaterial.
    await this.prisma.$transaction([
      this.prisma.studentProfile.updateMany({ where: { routeStopId: id }, data: { routeStopId: null } }),
      this.prisma.routeStop.delete({ where: { id: stop.id } }),
    ]);
    return { success: true };
  }

  private async findStopOrThrow(id: string, currentUser: ScopedUser) {
    const stop = await this.prisma.routeStop.findFirst({ where: { id }, include: { route: true } });
    if (!stop) throw new NotFoundException('Route stop not found');
    assertSchoolAccess(currentUser, stop.route.schoolId);
    return stop;
  }
}
