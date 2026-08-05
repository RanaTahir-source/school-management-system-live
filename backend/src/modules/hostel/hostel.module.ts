import { Module } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { AllocationsService } from './allocations.service';
import { AllocationsController } from './allocations.controller';
import { VisitorsService } from './visitors.service';
import { VisitorsController } from './visitors.controller';
import { HostelAttendanceService } from './hostel-attendance.service';
import { HostelAttendanceController } from './hostel-attendance.controller';

@Module({
  controllers: [RoomsController, AllocationsController, VisitorsController, HostelAttendanceController],
  providers: [RoomsService, AllocationsService, VisitorsService, HostelAttendanceService],
})
export class HostelModule {}
