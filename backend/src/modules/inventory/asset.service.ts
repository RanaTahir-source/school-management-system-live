import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { AddMaintenanceLogDto } from './dto/add-maintenance-log.dto';

type Requester = ScopedUser & { userId: string };

const ASSET_INCLUDE = {
  branch: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, fullName: true } },
  maintenanceLogs: {
    orderBy: { date: 'desc' as const },
    include: { createdBy: { select: { id: true, fullName: true } } },
  },
};

@Injectable()
export class AssetService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAssetDto, currentUser: ScopedUser) {
    assertSchoolAccess(currentUser, dto.schoolId);
    if (dto.branchId) {
      const branch = await this.prisma.branch.findFirst({ where: { id: dto.branchId, schoolId: dto.schoolId } });
      if (!branch) throw new BadRequestException('That branch does not belong to the selected school');
    }

    return this.prisma.asset.create({
      data: {
        schoolId: dto.schoolId,
        branchId: dto.branchId,
        name: dto.name,
        category: dto.category,
        assetTag: dto.assetTag,
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : undefined,
        purchaseCost: dto.purchaseCost,
        condition: dto.condition,
        location: dto.location,
        assignedToId: dto.assignedToId,
        warrantyExpiryDate: dto.warrantyExpiryDate ? new Date(dto.warrantyExpiryDate) : undefined,
        notes: dto.notes,
      },
      include: ASSET_INCLUDE,
    });
  }

  async findAll(
    currentUser: ScopedUser,
    filters: { schoolId?: string; branchId?: string; category?: string; condition?: string; includeDisposed?: boolean },
  ) {
    const effectiveSchoolId = resolveSchoolScope(currentUser, filters.schoolId);
    return this.prisma.asset.findMany({
      where: {
        deletedAt: null,
        ...(filters.includeDisposed ? {} : { isDisposed: false }),
        ...(effectiveSchoolId ? { schoolId: effectiveSchoolId } : {}),
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.condition ? { condition: filters.condition as any } : {}),
      },
      include: ASSET_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, currentUser: ScopedUser) {
    const asset = await this.prisma.asset.findFirst({ where: { id, deletedAt: null }, include: ASSET_INCLUDE });
    if (!asset) throw new NotFoundException('Asset not found');
    assertSchoolAccess(currentUser, asset.schoolId);
    return asset;
  }

  async update(id: string, dto: UpdateAssetDto, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    return this.prisma.asset.update({
      where: { id },
      data: {
        ...dto,
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : undefined,
        warrantyExpiryDate: dto.warrantyExpiryDate ? new Date(dto.warrantyExpiryDate) : undefined,
        disposedAt: dto.isDisposed ? new Date() : undefined,
      },
      include: ASSET_INCLUDE,
    });
  }

  async remove(id: string, currentUser: ScopedUser) {
    await this.findOne(id, currentUser);
    return this.prisma.asset.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async addMaintenanceLog(assetId: string, dto: AddMaintenanceLogDto, currentUser: Requester) {
    await this.findOne(assetId, currentUser);
    await this.prisma.assetMaintenanceLog.create({
      data: {
        assetId,
        date: new Date(dto.date),
        description: dto.description,
        cost: dto.cost,
        createdById: currentUser.userId,
      },
    });
    return this.prisma.asset.findUnique({ where: { id: assetId }, include: ASSET_INCLUDE });
  }
}
