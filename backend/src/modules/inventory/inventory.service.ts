import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertSchoolAccess, resolveSchoolScope, ScopedUser } from '../../common/utils/school-scope';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { RecordInventoryTransactionDto } from './dto/record-inventory-transaction.dto';

type Requester = ScopedUser & { userId: string };

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async createItem(dto: CreateInventoryItemDto, currentUser: Requester) {
    assertSchoolAccess(currentUser, dto.schoolId);
    if (dto.branchId) {
      const branch = await this.prisma.branch.findFirst({ where: { id: dto.branchId, schoolId: dto.schoolId } });
      if (!branch) throw new BadRequestException('That branch does not belong to the selected school');
    }

    const item = await this.prisma.inventoryItem.create({
      data: {
        schoolId: dto.schoolId,
        branchId: dto.branchId,
        name: dto.name,
        category: dto.category,
        sku: dto.sku,
        unit: dto.unit ?? 'pcs',
        costPrice: dto.costPrice ?? 0,
        sellPrice: dto.sellPrice ?? 0,
        reorderLevel: dto.reorderLevel,
      },
    });

    // Opening stock is recorded through the same transaction log as every
    // other stock movement, so the P&L report and stock count never diverge.
    if (dto.openingQuantity && dto.openingQuantity > 0) {
      await this.recordTransaction(
        {
          itemId: item.id,
          type: 'PURCHASE',
          quantity: dto.openingQuantity,
          unitPrice: dto.costPrice ?? 0,
          note: 'Opening stock',
        },
        currentUser,
      );
      return this.prisma.inventoryItem.findUnique({ where: { id: item.id } });
    }

    return item;
  }

  async findAllItems(currentUser: ScopedUser, filters: { schoolId?: string; branchId?: string; category?: string }) {
    const effectiveSchoolId = resolveSchoolScope(currentUser, filters.schoolId);
    return this.prisma.inventoryItem.findMany({
      where: {
        deletedAt: null,
        ...(effectiveSchoolId ? { schoolId: effectiveSchoolId } : {}),
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
        ...(filters.category ? { category: filters.category } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOneItem(id: string, currentUser: ScopedUser) {
    const item = await this.prisma.inventoryItem.findFirst({ where: { id, deletedAt: null } });
    if (!item) throw new NotFoundException('Inventory item not found');
    assertSchoolAccess(currentUser, item.schoolId);
    return item;
  }

  async updateItem(id: string, dto: UpdateInventoryItemDto, currentUser: ScopedUser) {
    await this.findOneItem(id, currentUser);
    return this.prisma.inventoryItem.update({ where: { id }, data: dto });
  }

  async removeItem(id: string, currentUser: ScopedUser) {
    await this.findOneItem(id, currentUser);
    return this.prisma.inventoryItem.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }

  // Every stock movement (purchase from a supplier, POS sale, manual
  // adjustment) goes through here so quantityOnHand always matches the sum
  // of the transaction log - never edited directly.
  async recordTransaction(dto: RecordInventoryTransactionDto, currentUser: Requester) {
    const item = await this.prisma.inventoryItem.findFirst({ where: { id: dto.itemId, deletedAt: null } });
    if (!item) throw new NotFoundException('Inventory item not found');
    assertSchoolAccess(currentUser, item.schoolId);

    const unitPrice = dto.unitPrice ?? (dto.type === 'SALE' ? Number(item.sellPrice) : Number(item.costPrice));
    const totalAmount = unitPrice * dto.quantity;

    let delta: number;
    if (dto.type === 'PURCHASE') {
      delta = dto.quantity;
    } else if (dto.type === 'SALE') {
      delta = -dto.quantity;
    } else {
      delta = dto.direction === 'DECREASE' ? -dto.quantity : dto.quantity;
    }

    const newQuantity = item.quantityOnHand + delta;
    if (newQuantity < 0) {
      throw new BadRequestException(
        `Not enough stock: ${item.name} only has ${item.quantityOnHand} ${item.unit} on hand`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.inventoryTransaction.create({
        data: {
          itemId: item.id,
          type: dto.type,
          quantity: dto.quantity,
          unitPrice,
          totalAmount,
          studentId: dto.studentId,
          note: dto.note,
          createdById: currentUser.userId,
        },
      });
      await tx.inventoryItem.update({ where: { id: item.id }, data: { quantityOnHand: newQuantity } });
      return transaction;
    });
  }

  async findTransactions(
    currentUser: ScopedUser,
    filters: { schoolId?: string; itemId?: string; type?: string; from?: string; to?: string },
  ) {
    const effectiveSchoolId = resolveSchoolScope(currentUser, filters.schoolId);
    return this.prisma.inventoryTransaction.findMany({
      where: {
        ...(filters.itemId ? { itemId: filters.itemId } : {}),
        ...(filters.type ? { type: filters.type as any } : {}),
        ...(effectiveSchoolId ? { item: { schoolId: effectiveSchoolId } } : {}),
        ...(filters.from || filters.to
          ? {
              createdAt: {
                ...(filters.from ? { gte: new Date(filters.from) } : {}),
                ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59`) } : {}),
              },
            }
          : {}),
      },
      include: {
        item: { select: { id: true, name: true, unit: true } },
        student: { select: { id: true, admissionNo: true, user: { select: { fullName: true } } } },
        createdBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Profit & loss for the shop over a date range: revenue from SALEs minus
  // cost of goods sold (quantity sold × the item's costPrice at sale time
  // isn't tracked per-transaction, so this uses the item's CURRENT costPrice
  // as an approximation - accurate enough for a school shop where prices
  // rarely change mid-term, and far simpler than FIFO/weighted-average
  // costing which would be overkill here).
  async profitLossReport(currentUser: ScopedUser, filters: { schoolId?: string; from?: string; to?: string }) {
    const effectiveSchoolId = resolveSchoolScope(currentUser, filters.schoolId);

    const sales = await this.prisma.inventoryTransaction.findMany({
      where: {
        type: 'SALE',
        ...(effectiveSchoolId ? { item: { schoolId: effectiveSchoolId } } : {}),
        ...(filters.from || filters.to
          ? {
              createdAt: {
                ...(filters.from ? { gte: new Date(filters.from) } : {}),
                ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59`) } : {}),
              },
            }
          : {}),
      },
      include: { item: { select: { id: true, name: true, costPrice: true } } },
    });

    const byItem = new Map<string, { itemId: string; itemName: string; quantitySold: number; revenue: number; cost: number }>();
    for (const s of sales) {
      const key = s.itemId;
      const existing = byItem.get(key) ?? { itemId: s.itemId, itemName: s.item.name, quantitySold: 0, revenue: 0, cost: 0 };
      existing.quantitySold += s.quantity;
      existing.revenue += Number(s.totalAmount);
      existing.cost += s.quantity * Number(s.item.costPrice);
      byItem.set(key, existing);
    }

    const items = Array.from(byItem.values()).map((r) => ({ ...r, profit: r.revenue - r.cost }));
    const totalRevenue = items.reduce((sum, r) => sum + r.revenue, 0);
    const totalCost = items.reduce((sum, r) => sum + r.cost, 0);

    return {
      from: filters.from ?? null,
      to: filters.to ?? null,
      totalRevenue,
      totalCost,
      totalProfit: totalRevenue - totalCost,
      items: items.sort((a, b) => b.revenue - a.revenue),
    };
  }
}
