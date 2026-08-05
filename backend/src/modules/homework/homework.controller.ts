import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { HomeworkService } from './homework.service';
import { CreateHomeworkDto } from './dto/create-homework.dto';
import { UpdateHomeworkDto } from './dto/update-homework.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

type Requester = { userId: string; roles: string[]; schoolId?: string | null };

const ASSIGN_ROLES = ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER'];
const VIEW_ROLES = ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER', 'STUDENT'];

@Controller('homework')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HomeworkController {
  constructor(private readonly service: HomeworkService) {}

  @Post()
  @Roles(...ASSIGN_ROLES)
  create(@Body() dto: CreateHomeworkDto, @CurrentUser() user: Requester) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @Roles(...ASSIGN_ROLES)
  update(@Param('id') id: string, @Body() dto: UpdateHomeworkDto, @CurrentUser() user: Requester) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(...ASSIGN_ROLES)
  remove(@Param('id') id: string, @CurrentUser() user: Requester) {
    return this.service.remove(id, user);
  }

  @Get('section/:sectionId')
  @Roles(...VIEW_ROLES)
  findBySection(@Param('sectionId') sectionId: string, @CurrentUser() user: Requester) {
    return this.service.findBySection(sectionId, user);
  }

  // "My homework" - Student's own section, or Teacher's own assigned list.
  @Get('mine')
  @Roles('TEACHER', 'STUDENT')
  findMine(@CurrentUser() user: Requester) {
    return this.service.findMine(user);
  }
}
