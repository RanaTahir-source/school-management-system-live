import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { TeachersService } from './teachers.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';
import { parseExcelRows } from '../../common/utils/excel-import';

@Controller('teachers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  @Post()
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  create(@Body() dto: CreateTeacherDto, @CurrentUser() user: ScopedUser) {
    return this.teachersService.create(dto, user);
  }

  // Must be declared before ':id' - same reasoning as StudentsController.
  @Get('bulk-import/template')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  async downloadTemplate(@Res() res: Response) {
    const buffer = await this.teachersService.buildImportTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="teachers-import-template.xlsx"');
    res.send(buffer);
  }

  @Post('bulk-import')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  async bulkImport(
    @UploadedFile() file: Express.Multer.File,
    @Query('schoolId') schoolId: string,
    @Query('branchId') branchId: string,
    @CurrentUser() user: ScopedUser & { userId: string },
  ) {
    if (!file) throw new BadRequestException('No file uploaded - attach an .xlsx file as "file"');
    if (!schoolId || !branchId) throw new BadRequestException('schoolId and branchId are required');
    const rows = await parseExcelRows(file.buffer);
    if (!rows.length) throw new BadRequestException('The uploaded file has no data rows');
    return this.teachersService.bulkImport(rows, schoolId, branchId, user);
  }

  @Get()
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  findAll(@CurrentUser() user: ScopedUser) {
    return this.teachersService.findAll(user);
  }

  @Get(':id')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  findOne(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.teachersService.findOne(id, user);
  }

  @Patch(':id')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  update(@Param('id') id: string, @Body() dto: UpdateTeacherDto, @CurrentUser() user: ScopedUser) {
    return this.teachersService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('DIRECTOR', 'ADMIN')
  remove(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.teachersService.remove(id, user);
  }

  // Photo used on ID cards.
  @Post(':id/photo')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 3 * 1024 * 1024 } }))
  uploadPhoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: ScopedUser,
  ) {
    if (!file) throw new BadRequestException('No photo uploaded - attach an image as "file"');
    return this.teachersService.uploadPhoto(id, file, user);
  }
}
