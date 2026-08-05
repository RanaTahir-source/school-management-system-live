import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { AttendanceRegisterPdfService } from './attendance-register-pdf.service';
import { CommunicationModule } from '../communication/communication.module';

@Module({
  imports: [CommunicationModule],
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceRegisterPdfService],
})
export class AttendanceModule {}
