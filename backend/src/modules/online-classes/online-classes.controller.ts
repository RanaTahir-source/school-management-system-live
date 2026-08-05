import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { OnlineClassesService } from './online-classes.service';
import { CreateOnlineClassDto } from './dto/create-online-class.dto';
import { UpdateOnlineClassDto } from './dto/update-online-class.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

type Requester = { userId: string; roles: string[]; schoolId?: string | null };

const SCHEDULE_ROLES = ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER'];
const VIEW_ROLES = ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER', 'STUDENT'];

@Controller('online-classes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OnlineClassesController {
  constructor(private readonly service: OnlineClassesService) {}

  @Post()
  @Roles(...SCHEDULE_ROLES)
  create(@Body() dto: CreateOnlineClassDto, @CurrentUser() user: Requester) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @Roles(...SCHEDULE_ROLES)
  update(@Param('id') id: string, @Body() dto: UpdateOnlineClassDto, @CurrentUser() user: Requester) {
    return this.service.update(id, dto, user);
  }

  @Patch(':id/cancel')
  @Roles(...SCHEDULE_ROLES)
  cancel(@Param('id') id: string, @CurrentUser() user: Requester) {
    return this.service.cancel(id, user);
  }

  @Delete(':id')
  @Roles(...SCHEDULE_ROLES)
  remove(@Param('id') id: string, @CurrentUser() user: Requester) {
    return this.service.remove(id, user);
  }

  @Get('section/:sectionId')
  @Roles(...VIEW_ROLES)
  findBySection(@Param('sectionId') sectionId: string, @CurrentUser() user: Requester) {
    return this.service.findBySection(sectionId, user);
  }

  // "My online classes" - Student's own section, or Teacher's own scheduled list.
  @Get('mine')
  @Roles('TEACHER', 'STUDENT')
  findMine(@CurrentUser() user: Requester) {
    return this.service.findMine(user);
  }
}
