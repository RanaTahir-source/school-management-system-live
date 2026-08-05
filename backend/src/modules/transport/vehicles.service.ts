import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVehicleDto, UpdateVehicleDto } from './dto/create-vehicle.dto';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';

const VEHICLE_INCLUDE = {
  driver: { select: { id: true, fullName: true, phone: true } },
  branch: { select: { id: true, name: true } },
} as const;

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateVehicleDto, currentUser: ScopedUser) {
    assertSchoolAccess(currentUser, dto.schoolId);
    if (dto.driverId) await this.assertDriverInSchool(dto.driverId, dto.schoolId);

    return this.prisma.vehicle.create({
      data: {
        schoolId: dto.schoolId,
        branchId: dto.branchId,
        registrationNo: dto.registrationNo,
        vehicleType: dto.vehicleType,
        make: dto.make,
        capacity: dto.capacity,
        driverId: dto.driverId,
      },
      include: VEHICLE_INCLUDE,
    });
  }

  findAll(currentUser: ScopedUser, schoolId?: string, branchId?: string) {
    const scopedSchoolId = resolveSchoolScope(currentUser, schoolId);
    return this.prisma.vehicle.findMany({
      where: {
        deletedAt: null,
        ...(scopedSchoolId ? { schoolId: scopedSchoolId } : {}),
        ...(branchId ? { branchId } : {}),
      },
      include: VEHICLE_INCLUDE,
      orderBy: { registrationNo: 'asc' },
    });
  }

  async findOne(id: string, currentUser: ScopedUser) {
    const vehicle = await this.prisma.vehicle.findFirst({ where: { id, deletedAt: null }, include: VEHICLE_INCLUDE });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    assertSchoolAccess(currentUser, vehicle.schoolId);
    return vehicle;
  }

  async update(id: string, dto: UpdateVehicleDto, currentUser: ScopedUser) {
    const vehicle = await this.findOne(id, currentUser);
    if (dto.driverId) await this.assertDriverInSchool(dto.driverId, vehicle.schoolId);

    return this.prisma.vehicle.update({ where: { id }, data: dto, include: VEHICLE_INCLUDE });
  }

  async remove(id: string, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    return this.prisma.vehicle.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }

  private async assertDriverInSchool(driverId: string, schoolId: string) {
    const driver = await this.prisma.driver.findFirst({ where: { id: driverId, deletedAt: null } });
    if (!driver) throw new NotFoundException('Driver not found');
    if (driver.schoolId !== schoolId) {
      throw new ConflictException('This driver belongs to a different school');
    }
  }
}
