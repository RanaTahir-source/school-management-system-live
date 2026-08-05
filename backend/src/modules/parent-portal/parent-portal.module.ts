import { Module } from '@nestjs/common';
import { ParentPortalService } from './parent-portal.service';
import { ParentPortalController } from './parent-portal.controller';
import { HomeworkModule } from '../homework/homework.module';
import { OnlineClassesModule } from '../online-classes/online-classes.module';

@Module({
  imports: [HomeworkModule, OnlineClassesModule],
  controllers: [ParentPortalController],
  providers: [ParentPortalService],
})
export class ParentPortalModule {}
