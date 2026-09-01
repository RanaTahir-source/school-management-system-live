import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ManualsController } from './manuals.controller';
import { ManualsService } from './manuals.service';

@Module({
  imports: [PrismaModule],
  controllers: [ManualsController],
  providers: [ManualsService],
})
export class ManualsModule {}
