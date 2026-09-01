import { Module } from '@nestjs/common';
import { DepartmentsController } from './departments.controller';
import { DepartmentsService } from './departments.service';
import { DesignationsController } from './designations.controller';
import { DesignationsService } from './designations.service';

@Module({
  controllers: [DepartmentsController, DesignationsController],
  providers: [DepartmentsService, DesignationsService],
  exports: [DepartmentsService, DesignationsService],
})
export class DepartmentsModule {}
