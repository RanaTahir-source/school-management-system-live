import { Body, Controller, Delete, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { RouteStopsService } from './route-stops.service';
import { CreateRouteStopDto, UpdateRouteStopDto } from './dto/create-route-stop.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

// Stops are managed as their own resource (mirrors how /sections works
// against /classes) rather than nested under /transport/routes/:id, so the
// route paths never collide with RoutesController's ':id' catch-all.
@Controller('transport/route-stops')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RouteStopsController {
  constructor(private readonly service: RouteStopsService) {}

  @Post()
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  create(@Body() dto: CreateRouteStopDto, @CurrentUser() user: ScopedUser) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  update(@Param('id') id: string, @Body() dto: UpdateRouteStopDto, @CurrentUser() user: ScopedUser) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  remove(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.remove(id, user);
  }
}
