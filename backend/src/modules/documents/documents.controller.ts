import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { createReadStream } from 'fs';
import { DocumentCategory, DocumentStatus } from '@prisma/client';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

type Requester = ScopedUser & { userId: string };

@Controller('documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Post()
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'RECEPTIONIST')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  create(@Body() dto: CreateDocumentDto, @UploadedFile() file: Express.Multer.File, @CurrentUser() user: Requester) {
    return this.service.create(dto, file, user);
  }

  @Get()
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'RECEPTIONIST')
  findAll(
    @CurrentUser() user: ScopedUser,
    @Query('schoolId') schoolId?: string,
    @Query('studentId') studentId?: string,
    @Query('teacherId') teacherId?: string,
    @Query('staffId') staffId?: string,
    @Query('category') category?: DocumentCategory,
    @Query('status') status?: DocumentStatus,
  ) {
    return this.service.findAll(user, { schoolId, studentId, teacherId, staffId, category, status });
  }

  // Must be declared before ':id' - see StudentsController for why.
  @Get('me')
  @Roles('STUDENT', 'TEACHER')
  findMine(@CurrentUser() user: Requester) {
    return this.service.findMine(user.userId);
  }

  @Get(':id')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'RECEPTIONIST', 'STUDENT', 'TEACHER')
  findOne(@Param('id') id: string, @CurrentUser() user: Requester) {
    return this.service.findOne(id, user);
  }

  @Get(':id/download')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'RECEPTIONIST', 'STUDENT', 'TEACHER')
  async download(@Param('id') id: string, @CurrentUser() user: Requester, @Res() res: Response) {
    const { doc, absolutePath } = await this.service.getDownloadTarget(id, user);
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${doc.originalName.replace(/"/g, '')}"`);
    createReadStream(absolutePath).pipe(res);
  }

  @Patch(':id')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  update(@Param('id') id: string, @Body() dto: UpdateDocumentDto, @CurrentUser() user: Requester) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('DIRECTOR', 'ADMIN')
  remove(@Param('id') id: string, @CurrentUser() user: Requester) {
    return this.service.remove(id, user);
  }
}
