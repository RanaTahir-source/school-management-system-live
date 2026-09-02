import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { TimetableService } from './timetable.service';
import { CreateTimetableSlotDto } from './dto/create-timetable-slot.dto';
import { UpdateTimetableSlotDto } from './dto/update-timetable-slot.dto';
import { GenerateTimetableDto } from './dto/generate-timetable.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

type Requester = { userId: string; roles: string[]; schoolId?: string | null };

const MANAGE_ROLES = ['DIRECTOR', 'ADMIN', 'PRINCIPAL'];
const VIEW_ROLES = ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER', 'STUDENT', 'PARENT'];

@Controller('timetable')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TimetableController {
  constructor(private readonly service: TimetableService) {}

  @Post()
  @Roles(...MANAGE_ROLES)
  create(@Body() dto: CreateTimetableSlotDto, @CurrentUser() user: Requester) {
    return this.service.create(dto, user);
  }

  // Auto-fills a section's empty timetable cells from a list of subject
  // requirements (periods/week, optional pinned teacher).
  @Post('generate')
  @Roles(...MANAGE_ROLES)
  generate(@Body() dto: GenerateTimetableDto, @CurrentUser() user: Requester) {
    return this.service.generate(dto, user);
  }

  @Patch(':id')
  @Roles(...MANAGE_ROLES)
  update(@Param('id') id: string, @Body() dto: UpdateTimetableSlotDto, @CurrentUser() user: Requester) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(...MANAGE_ROLES)
  remove(@Param('id') id: string, @CurrentUser() user: Requester) {
    return this.service.remove(id, user);
  }

  // Full weekly grid for a section.
  @Get('section/:sectionId')
  @Roles(...VIEW_ROLES)
  findBySection(@Param('sectionId') sectionId: string, @CurrentUser() user: Requester) {
    return this.service.findBySection(sectionId, user);
  }

  // A specific teacher's weekly schedule across every section they teach.
  @Get('teacher/:teacherId')
  @Roles(...VIEW_ROLES)
  findByTeacher(@Param('teacherId') teacherId: string, @CurrentUser() user: Requester) {
    return this.service.findByTeacher(teacherId, user);
  }

  // "My schedule" - resolves automatically for the logged-in Student/Teacher.
  @Get('mine')
  @Roles('TEACHER', 'STUDENT')
  findMine(@CurrentUser() user: Requester) {
    return this.service.findMine(user);
  }
}
