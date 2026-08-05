import { Body, Controller, Delete, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { FeeConcessionService } from './fee-concession.service';
import { FinancePdfReportService } from './finance-pdf-report.service';
import { CreateFeeConcessionDto } from './dto/create-fee-concession.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

@Controller('finance/fee-concessions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FeeConcessionController {
  constructor(
    private readonly service: FeeConcessionService,
    private readonly pdfReportService: FinancePdfReportService,
  ) {}

  @Post()
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT')
  create(@Body() dto: CreateFeeConcessionDto, @CurrentUser() user: ScopedUser) {
    return this.service.create(dto, user);
  }

  @Get('report.pdf')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL')
  async report(@CurrentUser() user: ScopedUser, @Res() res: Response, @Query('schoolId') schoolId?: string) {
    const rows = await this.service.findAllForSchool(user, schoolId);
    const schoolName = (rows[0] as any)?.student?.user?.school?.name ?? 'All Schools';
    const pdf = await this.pdfReportService.buildConcessionListPdf(rows as any, schoolName);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="concession-list.pdf"');
    res.send(pdf);
  }

  @Get('student/:studentId')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL')
  findForStudent(@Param('studentId') studentId: string, @CurrentUser() user: ScopedUser) {
    return this.service.findForStudent(studentId, user);
  }

  @Delete(':id')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT')
  remove(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.service.remove(id, user);
  }
}
