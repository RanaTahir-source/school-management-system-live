import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { RecordInventoryTransactionDto } from './dto/record-inventory-transaction.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

type Requester = ScopedUser & { userId: string };

const INVENTORY_ROLES = ['DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL'] as const;

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...INVENTORY_ROLES)
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  @Post('items')
  createItem(@Body() dto: CreateInventoryItemDto, @CurrentUser() user: Requester) {
    return this.service.createItem(dto, user);
  }

  @Get('items')
  findAllItems(
    @CurrentUser() user: ScopedUser,
    @Query('schoolId') schoolId?: string,
    @Query('branchId') branchId?: string,
    @Query('category') category?: string,
  ) {
    return this.service.findAllItems(user, { schoolId, branchId, category });
  }

  @Get('items/:id')
  findOneItem(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.findOneItem(id, user);
  }

  @Patch('items/:id')
  updateItem(@Param('id') id: string, @Body() dto: UpdateInventoryItemDto, @CurrentUser() user: ScopedUser) {
    return this.service.updateItem(id, dto, user);
  }

  @Delete('items/:id')
  removeItem(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.removeItem(id, user);
  }

  // Records a PURCHASE (stock in), SALE (POS sale), or ADJUSTMENT.
  @Post('transactions')
  recordTransaction(@Body() dto: RecordInventoryTransactionDto, @CurrentUser() user: Requester) {
    return this.service.recordTransaction(dto, user);
  }

  @Get('transactions')
  findTransactions(
    @CurrentUser() user: ScopedUser,
    @Query('schoolId') schoolId?: string,
    @Query('itemId') itemId?: string,
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.findTransactions(user, { schoolId, itemId, type, from, to });
  }

  @Get('reports/profit-loss')
  profitLossReport(
    @CurrentUser() user: ScopedUser,
    @Query('schoolId') schoolId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.profitLossReport(user, { schoolId, from, to });
  }
}
