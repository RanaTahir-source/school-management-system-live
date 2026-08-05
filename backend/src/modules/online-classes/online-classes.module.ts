import { Module } from '@nestjs/common';
import { OnlineClassesService } from './online-classes.service';
import { OnlineClassesController } from './online-classes.controller';

@Module({
  controllers: [OnlineClassesController],
  providers: [OnlineClassesService],
  exports: [OnlineClassesService], // ParentPortalModule reuses listForSection()
})
export class OnlineClassesModule {}
