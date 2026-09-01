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
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { MarkStudentLeftDto } from './dto/mark-student-left.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';
import { parseExcelRows } from '../../common/utils/excel-import';

type Requester = { userId: string; roles: string[]; schoolId?: string | null };

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post()
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  create(@Body() dto: CreateStudentDto, @CurrentUser() user: ScopedUser) {
    return this.studentsService.create(dto, user);
  }

  // Downloadable .xlsx template - must be declared before ':id' routes.
  @Get('bulk-import/template')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  async downloadTemplate(@Res() res: Response) {
    const buffer = await this.studentsService.buildImportTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="students-import-template.xlsx"');
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
    return this.studentsService.bulkImport(rows, schoolId, branchId, user);
  }

  // status: omit for current students only, "ALL" for everyone, or a specific
  // EnrollmentStatus (e.g. "LEFT") for the alumni/left-students list.
  @Get()
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER')
  findAll(
    @CurrentUser() user: ScopedUser,
    @Query('sectionId') sectionId?: string,
    @Query('status') status?: string,
  ) {
    return this.studentsService.findAll(user, sectionId, status);
  }

  // Must be declared before ':id' - otherwise Express would match "me" as an :id param.
  // Lets a STUDENT-role user resolve their own studentProfileId after login
  // (there is no other way for a student to discover it, since GET / and
  // GET /:id are staff-only).
  @Get('me')
  @Roles('STUDENT')
  findMe(@CurrentUser() user: Requester) {
    return this.studentsService.findMe(user.userId);
  }

  @Get(':id')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER')
  findOne(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.studentsService.findOne(id, user);
  }

  @Patch(':id')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  update(@Param('id') id: string, @Body() dto: UpdateStudentDto, @CurrentUser() user: ScopedUser) {
    return this.studentsService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('DIRECTOR', 'ADMIN')
  remove(@Param('id') id: string, @CurrentUser() user: ScopedUser) {
    return this.studentsService.remove(id, user);
  }

  // Marks a student LEFT/GRADUATED/TRANSFERRED/EXPELLED - keeps their history
  // (fees/attendance/results) intact, just moves them out of the current-
  // students list. Different from DELETE, which is for mistaken entries.
  @Patch(':id/leave')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  markLeft(
    @Param('id') id: string,
    @Body() dto: MarkStudentLeftDto,
    @CurrentUser() user: ScopedUser & { userId: string },
  ) {
    return this.studentsService.markLeft(id, dto, user);
  }

  @Patch(':id/reactivate')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
  reactivate(@Param('id') id: string, @CurrentUser() user: ScopedUser & { userId: string }) {
    return this.studentsService.reactivate(id, user);
  }

  // Photo used on ID cards, fee receipts, and result cards.
  @Post(':id/photo')
  @Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL', 'RECEPTIONIST')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 3 * 1024 * 1024 } }))
  uploadPhoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: ScopedUser,
  ) {
    if (!file) throw new BadRequestException('No photo uploaded - attach an image as "file"');
    return this.studentsService.uploadPhoto(id, file, user);
  }
}
