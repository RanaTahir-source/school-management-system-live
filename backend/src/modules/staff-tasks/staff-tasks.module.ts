import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StaffTasksController } from './staff-tasks.controller';
import { StaffTasksService } from './staff-tasks.service';

@Module({
  imports: [PrismaModule],
  controllers: [StaffTasksController],
  providers: [StaffTasksService],
})
export class StaffTasksModule {}
