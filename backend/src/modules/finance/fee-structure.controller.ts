import { BadRequestException, Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { FeeStructureService } from './fee-structure.service';
import { UpsertFeeStructureDto } from './dto/upsert-fee-structure.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

@Controller('finance/fee-structures')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FeeStructureController {
  constructor(private readonly service: FeeStructureService) {}

  @Post()
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT')
  upsert(@Body() dto: UpsertFeeStructureDto, @CurrentUser() user: ScopedUser) {
    return this.service.upsert(dto, user);
  }

  @Get()
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL')
  findForClass(
    @CurrentUser() user: ScopedUser,
    @Query('classId') classId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!classId || !academicYearId) {
      throw new BadRequestException('"classId" and "academicYearId" query params are required');
    }
    return this.service.findForClass(classId, academicYearId, user);
  }
}
