import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto, UpdateAnnouncementDto } from './dto/create-announcement.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

// Staff-facing management endpoints (create/edit/publish/delete notices).
// Recipients read their own copies via GET /notifications instead of here -
// publishing an announcement fans out a Notification row per targeted user.
@Controller('announcements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnnouncementsController {
  constructor(private readonly service: AnnouncementsService) {}

  @Post()
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER')
  create(@Body() dto: CreateAnnouncementDto, @CurrentUser() user: ScopedUser & { userId: string }) {
    return this.service.create(dto, user);
  }

  @Get()
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER', 'ACCOUNTANT')
  findAll(@CurrentUser() user: ScopedUser, @Query('schoolId') schoolId?: string) {
    return this.service.findAll(user, schoolId);
  }

  @Get(':id')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER', 'ACCOUNTANT')
  findOne(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.findOne(id, user);
  }

  @Patch(':id')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER')
  update(@Param('id') id: string, @Body() dto: UpdateAnnouncementDto, @CurrentUser() user: ScopedUser) {
    return this.service.update(id, dto, user);
  }

  @Post(':id/publish')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER')
  publish(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.publish(id, user);
  }

  @Delete(':id')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  remove(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.remove(id, user);
  }
}
