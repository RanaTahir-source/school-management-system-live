import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
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
import { OnlinePaymentsService } from './online-payments.service';
import { InitiateOnlinePaymentDto } from './dto/initiate-online-payment.dto';
import { ReviewOnlinePaymentDto } from './dto/review-online-payment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

type Requester = ScopedUser & { userId: string };

const STAFF_ROLES = ['DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL'] as const;

@Controller('online-payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OnlinePaymentsController {
  constructor(private readonly service: OnlinePaymentsService) {}

  // Parent/Student starts a payment attempt against one of their own invoices.
  @Post('initiate')
  @Roles('PARENT', 'STUDENT')
  initiate(@Body() dto: InitiateOnlinePaymentDto, @CurrentUser() user: Requester) {
    return this.service.initiate(dto, user);
  }

  @Post(':id/proof')
  @Roles('PARENT', 'STUDENT')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  submitProof(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('proofNote') proofNote: string | undefined,
    @CurrentUser() user: Requester,
  ) {
    if (!file) throw new BadRequestException('Please attach a screenshot or photo of the payment receipt as "file"');
    return this.service.submitProof(id, file, proofNote, user);
  }

  @Get('mine')
  @Roles('PARENT', 'STUDENT')
  mine(@CurrentUser() user: Requester) {
    return this.service.myAttempts(user);
  }

  // Staff review queue.
  @Get('pending')
  @Roles(...STAFF_ROLES)
  pending(@CurrentUser() user: ScopedUser, @Query('schoolId') schoolId?: string) {
    return this.service.pending(user, schoolId);
  }

  @Get(':id/proof')
  @Roles(...STAFF_ROLES)
  async proof(@Param('id') id: string, @CurrentUser() user: ScopedUser, @Res() res: Response) {
    const { buffer, mimeType } = await this.service.getProofFile(id, user);
    res.setHeader('Content-Type', mimeType);
    res.send(buffer);
  }

  @Post(':id/approve')
  @Roles(...STAFF_ROLES)
  approve(@Param('id') id: string, @CurrentUser() user: Requester) {
    return this.service.approve(id, user);
  }

  @Post(':id/reject')
  @Roles(...STAFF_ROLES)
  reject(@Param('id') id: string, @Body() dto: ReviewOnlinePaymentDto, @CurrentUser() user: Requester) {
    return this.service.reject(id, dto, user);
  }
}
