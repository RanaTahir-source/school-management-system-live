import { Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import { createReadStream } from 'fs';
import type { Response } from 'express';
import { BackupService } from './backup.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

type Requester = { userId: string; roles: string[] };

// Director-only: this dumps every school's data at once, not just one.
@Controller('admin/backups')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DIRECTOR')
export class BackupController {
  constructor(private readonly service: BackupService) {}

  @Post()
  create(@CurrentUser() user: Requester) {
    return this.service.create(user);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id/download')
  async download(@Param('id') id: string, @Res() res: Response) {
    const { filePath, fileName } = await this.service.getFileTarget(id);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    createReadStream(filePath).pipe(res);
  }
}
