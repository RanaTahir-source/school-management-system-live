import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FinanceModule } from '../finance/finance.module';
import { OnlinePaymentsController } from './online-payments.controller';
import { OnlinePaymentsService } from './online-payments.service';

@Module({
  imports: [PrismaModule, FinanceModule],
  controllers: [OnlinePaymentsController],
  providers: [OnlinePaymentsService],
})
export class OnlinePaymentsModule {}
