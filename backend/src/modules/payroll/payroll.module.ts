import { Module } from '@nestjs/common';
import { StaffProfilesService } from './staff-profiles.service';
import { StaffProfilesController } from './staff-profiles.controller';
import { SalaryStructureService } from './salary-structure.service';
import { SalaryStructureController } from './salary-structure.controller';
import { PayslipsService } from './payslips.service';
import { PayslipsController } from './payslips.controller';

@Module({
  controllers: [StaffProfilesController, SalaryStructureController, PayslipsController],
  providers: [StaffProfilesService, SalaryStructureService, PayslipsService],
})
export class PayrollModule {}
