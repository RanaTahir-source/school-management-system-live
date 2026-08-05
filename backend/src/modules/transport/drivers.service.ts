import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDriverDto, UpdateDriverDto } from './dto/create-driver.dto';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';

@Injectable()
export class DriversService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateDriverDto, currentUser: ScopedUser) {
    assertSchoolAccess(currentUser, dto.schoolId);
    return this.prisma.driver.create({
      data: {
        schoolId: dto.schoolId,
        fullName: dto.fullName,
        phone: dto.phone,
        cnic: dto.cnic,
        licenseNo: dto.licenseNo,
        address: dto.address,
      },
    });
  }

  findAll(currentUser: ScopedUser, schoolId?: string) {
    const scopedSchoolId = resolveSchoolScope(currentUser, schoolId);
    return this.prisma.driver.findMany({
      where: {
        deletedAt: null,
        ...(scopedSchoolId ? { schoolId: scopedSchoolId } : {}),
      },
      orderBy: { fullName: 'asc' },
    });
  }

  async findOne(id: string, currentUser: ScopedUser) {
    const driver = await this.prisma.driver.findFirst({ where: { id, deletedAt: null } });
    if (!driver) throw new NotFoundException('Driver not found');
    assertSchoolAccess(currentUser, driver.schoolId);
    return driver;
  }

  async update(id: string, dto: UpdateDriverDto, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    return this.prisma.driver.update({ where: { id }, data: dto });
  }

  async remove(id: string, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    return this.prisma.driver.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }
}
