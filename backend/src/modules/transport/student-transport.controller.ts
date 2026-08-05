import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { StudentTransportService } from './student-transport.service';
import { AssignTransportDto } from './dto/assign-transport.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

@Controller('transport/students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentTransportController {
  constructor(private readonly service: StudentTransportService) {}

  @Patch(':studentId')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  assign(
    @Param('studentId') studentId: string,
    @Body() dto: AssignTransportDto,
    @CurrentUser() user: ScopedUser,
  ) {
    return this.service.assign(studentId, dto, user);
  }

  // A student checking their own pickup point/route - no @Roles restriction,
  // ownership is implicit (looked up by the caller's own userId).
  @Get('me')
  mine(@CurrentUser() user: { userId: string }) {
    return this.service.mine(user.userId);
  }
}
