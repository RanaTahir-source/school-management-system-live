import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ManualsService } from './manuals.service';
import { CreateManualDto } from './dto/create-manual.dto';
import { UpdateManualDto } from './dto/update-manual.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

type Requester = ScopedUser & { userId: string };

const MANAGE_ROLES = ['CHAIRMAN', 'DIRECTOR', 'ADMIN', 'PRINCIPAL'] as const;

@Controller('manuals')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...MANAGE_ROLES)
export class ManualsController {
  constructor(private readonly service: ManualsService) {}

  @Post()
  create(@Body() dto: CreateManualDto, @CurrentUser() user: Requester) {
    return this.service.create(dto, user);
  }

  // Every authenticated role can browse/read the library - the service
  // itself hides drafts from non-managers.
  @Get()
  @Roles()
  findAll(
    @CurrentUser() user: ScopedUser,
    @Query('schoolId') schoolId?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    return this.service.findAll(user, { schoolId, category, search });
  }

  @Get(':id')
  @Roles()
  findOne(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.findOne(id, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateManualDto, @CurrentUser() user: Requester) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.remove(id, user);
  }
}
