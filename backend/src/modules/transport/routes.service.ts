import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRouteDto, UpdateRouteDto } from './dto/create-route.dto';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';

const ROUTE_INCLUDE = {
  branch: { select: { id: true, name: true } },
  vehicle: { select: { id: true, registrationNo: true, vehicleType: true, capacity: true } },
  stops: {
    orderBy: { order: 'asc' as const },
    include: {
      students: {
        select: { id: true, admissionNo: true, user: { select: { fullName: true } } },
      },
    },
  },
} as const;

@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRouteDto, currentUser: ScopedUser) {
    assertSchoolAccess(currentUser, dto.schoolId);
    if (dto.vehicleId) await this.assertVehicleInSchool(dto.vehicleId, dto.schoolId);

    return this.prisma.route.create({
      data: {
        schoolId: dto.schoolId,
        branchId: dto.branchId,
        name: dto.name,
        monthlyFare: dto.monthlyFare,
        vehicleId: dto.vehicleId,
      },
      include: ROUTE_INCLUDE,
    });
  }

  findAll(currentUser: ScopedUser, schoolId?: string, branchId?: string) {
    const scopedSchoolId = resolveSchoolScope(currentUser, schoolId);
    return this.prisma.route.findMany({
      where: {
        deletedAt: null,
        ...(scopedSchoolId ? { schoolId: scopedSchoolId } : {}),
        ...(branchId ? { branchId } : {}),
      },
      include: ROUTE_INCLUDE,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, currentUser: ScopedUser) {
    const route = await this.prisma.route.findFirst({ where: { id, deletedAt: null }, include: ROUTE_INCLUDE });
    if (!route) throw new NotFoundException('Route not found');
    assertSchoolAccess(currentUser, route.schoolId);
    return route;
  }

  async update(id: string, dto: UpdateRouteDto, currentUser: ScopedUser) {
    const route = await this.findOne(id, currentUser);
    if (dto.vehicleId) await this.assertVehicleInSchool(dto.vehicleId, route.schoolId);

    return this.prisma.route.update({ where: { id }, data: dto, include: ROUTE_INCLUDE });
  }

  async remove(id: string, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    return this.prisma.route.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }

  private async assertVehicleInSchool(vehicleId: string, schoolId: string) {
    const vehicle = await this.prisma.vehicle.findFirst({ where: { id: vehicleId, deletedAt: null } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    if (vehicle.schoolId !== schoolId) {
      throw new ConflictException('This vehicle belongs to a different school');
    }
  }
}
