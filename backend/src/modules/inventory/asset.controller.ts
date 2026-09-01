import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AssetService } from './asset.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { AddMaintenanceLogDto } from './dto/add-maintenance-log.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

type Requester = ScopedUser & { userId: string };

const ASSET_ROLES = ['DIRECTOR', 'ADMIN', 'PRINCIPAL'] as const;

@Controller('assets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ASSET_ROLES)
export class AssetController {
  constructor(private readonly service: AssetService) {}

  @Post()
  create(@Body() dto: CreateAssetDto, @CurrentUser() user: ScopedUser) {
    return this.service.create(dto, user);
  }

  @Get()
  findAll(
    @CurrentUser() user: ScopedUser,
    @Query('schoolId') schoolId?: string,
    @Query('branchId') branchId?: string,
    @Query('category') category?: string,
    @Query('condition') condition?: string,
    @Query('includeDisposed') includeDisposed?: string,
  ) {
    return this.service.findAll(user, { schoolId, branchId, category, condition, includeDisposed: includeDisposed === 'true' });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.findOne(id, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAssetDto, @CurrentUser() user: ScopedUser) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.remove(id, user);
  }

  @Post(':id/maintenance-logs')
  addMaintenanceLog(@Param('id') id: string, @Body() dto: AddMaintenanceLogDto, @CurrentUser() user: Requester) {
    return this.service.addMaintenanceLog(id, dto, user);
  }
}
