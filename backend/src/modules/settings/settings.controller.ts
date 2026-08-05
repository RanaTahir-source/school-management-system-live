import { Body, Controller, Get, Param, Post, Put, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { SettingsService } from './settings.service';
import { UpsertSettingsDto } from './dto/upsert-settings.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

type Requester = { userId: string; roles: string[]; schoolId?: string | null };

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DIRECTOR', 'ADMIN', 'PRINCIPAL')
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get(':schoolId')
  get(@Param('schoolId') schoolId: string, @CurrentUser() user: Requester) {
    return this.service.get(schoolId, user);
  }

  @Put(':schoolId')
  upsert(@Param('schoolId') schoolId: string, @Body() dto: UpsertSettingsDto, @CurrentUser() user: Requester) {
    return this.service.upsert(schoolId, dto, user);
  }

  @Post(':schoolId/logo')
  @UseInterceptors(FileInterceptor('logo', { storage: memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } }))
  uploadLogo(
    @Param('schoolId') schoolId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: Requester,
  ) {
    return this.service.uploadLogo(schoolId, file, user);
  }
}
