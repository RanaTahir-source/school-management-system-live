import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdmissionsService } from './admissions.service';
import { CreateEnquiryDto } from './dto/create-enquiry.dto';
import { PublicCreateEnquiryDto } from './dto/public-create-enquiry.dto';
import { UpdateEnquiryDto } from './dto/update-enquiry.dto';
import { AddFollowUpDto } from './dto/add-follow-up.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

type Requester = ScopedUser & { userId: string };

const STAFF_ROLES = ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'RECEPTIONIST'] as const;

@Controller('admissions')
export class AdmissionsController {
  constructor(private readonly service: AdmissionsService) {}

  // Public "Online Admission Enquiry" form - embeddable on the school's own
  // website. No auth: the school is identified by its short public `code`
  // (e.g. "DAS-JND-01"), not an internal id. Deliberately outside the
  // JwtAuthGuard applied to the rest of this controller below.
  @Post('public/:schoolCode/enquiries')
  publicCreate(@Param('schoolCode') schoolCode: string, @Body() dto: PublicCreateEnquiryDto) {
    return this.service.publicCreate(schoolCode, dto);
  }

  @Post('enquiries')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF_ROLES)
  create(@Body() dto: CreateEnquiryDto, @CurrentUser() user: Requester) {
    return this.service.create(dto, user);
  }

  // Must be declared before ':id' - same convention as StudentsController.
  @Get('enquiries/summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF_ROLES)
  summary(@CurrentUser() user: ScopedUser, @Query('schoolId') schoolId?: string) {
    return this.service.summary(user, schoolId);
  }

  @Get('enquiries')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF_ROLES)
  findAll(
    @CurrentUser() user: ScopedUser,
    @Query('schoolId') schoolId?: string,
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('assignedToId') assignedToId?: string,
    @Query('search') search?: string,
  ) {
    return this.service.findAll(user, { schoolId, branchId, status, source, assignedToId, search });
  }

  @Get('enquiries/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF_ROLES)
  findOne(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.findOne(id, user);
  }

  @Patch('enquiries/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF_ROLES)
  update(@Param('id') id: string, @Body() dto: UpdateEnquiryDto, @CurrentUser() user: Requester) {
    return this.service.update(id, dto, user);
  }

  @Delete('enquiries/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DIRECTOR', 'ADMIN')
  remove(@Param('id') id: string, @CurrentUser() user: Requester) {
    return this.service.remove(id, user);
  }

  @Post('enquiries/:id/follow-ups')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF_ROLES)
  addFollowUp(@Param('id') id: string, @Body() dto: AddFollowUpDto, @CurrentUser() user: Requester) {
    return this.service.addFollowUp(id, dto, user);
  }
}
