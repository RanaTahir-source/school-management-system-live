import { Body, Controller, Param, Patch, Post, Get, UseGuards } from '@nestjs/common';
import { PlatformService } from './platform.service';
import { OnboardSchoolDto } from './dto/onboard-school.dto';
import { OnboardDirectorDto } from './dto/onboard-director.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

// Chairman's platform-wide console: onboard new schools, see every tenant,
// block/unblock. Nothing here is scoped by school - CHAIRMAN is the one
// role meant to see across every tenant on the platform.
@Controller('platform')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CHAIRMAN')
export class PlatformController {
  constructor(private readonly service: PlatformService) {}

  @Get('schools')
  listSchools() {
    return this.service.listSchools();
  }

  @Post('schools')
  onboardSchool(@Body() dto: OnboardSchoolDto, @CurrentUser() user: { userId: string }) {
    return this.service.onboardSchool(dto, user);
  }

  // Normal path going forward: Chairman creates just the Director's login;
  // the Director then creates their own school via POST /schools/mine.
  @Post('directors')
  onboardDirector(@Body() dto: OnboardDirectorDto, @CurrentUser() user: { userId: string }) {
    return this.service.onboardDirector(dto, user);
  }

  @Patch('schools/:id/block')
  block(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return this.service.setBlocked(id, true, user);
  }

  @Patch('schools/:id/unblock')
  unblock(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return this.service.setBlocked(id, false, user);
  }

  @Post('backfill-tenant-code')
  backfillTenantCode(@CurrentUser() user: { userId: string }) {
    return this.service.backfillTenantCode(user);
  }
}
