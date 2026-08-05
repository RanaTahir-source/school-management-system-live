import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ParentsService } from './parents.service';
import { CreateParentDto } from './dto/create-parent.dto';
import { UpdateParentDto } from './dto/update-parent.dto';
import { LinkChildDto } from './dto/link-child.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

// Admin-facing management: create parent login accounts and link them to
// their children. The parent's own self-service views live under
// /parent-portal (ParentPortalController).
@Controller('parents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ParentsController {
  constructor(private readonly service: ParentsService) {}

  @Post()
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  create(@Body() dto: CreateParentDto, @CurrentUser() user: ScopedUser) {
    return this.service.create(dto, user);
  }

  @Get()
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  findAll(@CurrentUser() user: ScopedUser, @Query('schoolId') schoolId?: string) {
    return this.service.findAll(user, schoolId);
  }

  @Patch(':id')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  update(@Param('id') id: string, @Body() dto: UpdateParentDto, @CurrentUser() user: ScopedUser) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  remove(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.remove(id, user);
  }

  @Post(':parentId/children')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  linkChild(@Param('parentId') parentId: string, @Body() dto: LinkChildDto, @CurrentUser() user: ScopedUser) {
    return this.service.linkChild(parentId, dto, user);
  }

  @Delete(':parentId/children/:studentId')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  unlinkChild(
    @Param('parentId') parentId: string,
    @Param('studentId') studentId: string,
    @CurrentUser() user: ScopedUser,
  ) {
    return this.service.unlinkChild(parentId, studentId, user);
  }
}
