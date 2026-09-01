import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { AssetController } from './asset.controller';
import { AssetService } from './asset.service';

@Module({
  imports: [PrismaModule],
  controllers: [InventoryController, AssetController],
  providers: [InventoryService, AssetService],
})
export class InventoryModule {}
