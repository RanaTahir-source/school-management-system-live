import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { createReadStream } from 'fs';
import { CertificateType } from '@prisma/client';
import { CertificatesService } from './certificates.service';
import { CreateCertificateDto } from './dto/create-certificate.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

type Requester = ScopedUser & { userId: string };

@Controller('certificates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CertificatesController {
  constructor(private readonly service: CertificatesService) {}

  @Post()
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  create(@Body() dto: CreateCertificateDto, @CurrentUser() user: Requester) {
    return this.service.create(dto, user);
  }

  @Get()
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'RECEPTIONIST')
  findAll(
    @CurrentUser() user: ScopedUser,
    @Query('schoolId') schoolId?: string,
    @Query('studentId') studentId?: string,
    @Query('staffId') staffId?: string,
    @Query('type') type?: CertificateType,
  ) {
    return this.service.findAll(user, { schoolId, studentId, staffId, type });
  }

  // Must be declared before ':id' - see StudentsController for why.
  @Get('mine')
  @Roles('STUDENT')
  findMine(@CurrentUser() user: Requester) {
    return this.service.findMine(user.userId);
  }

  @Get(':id')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'RECEPTIONIST', 'STUDENT')
  findOne(@Param('id') id: string, @CurrentUser() user: Requester) {
    return this.service.findOne(id, user);
  }

  @Get(':id/pdf')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'RECEPTIONIST', 'STUDENT')
  async downloadPdf(@Param('id') id: string, @CurrentUser() user: Requester, @Res() res: Response) {
    const { cert, absolutePath } = await this.service.getPdfTarget(id, user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${cert.certificateNo}.pdf"`);
    createReadStream(absolutePath).pipe(res);
  }

  @Patch(':id/revoke')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  revoke(@Param('id') id: string, @CurrentUser() user: Requester) {
    return this.service.revoke(id, user);
  }
}
