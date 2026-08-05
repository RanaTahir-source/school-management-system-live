import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { LogoStorageService } from './logo-storage.service';

@Module({
  controllers: [SettingsController],
  providers: [SettingsService, LogoStorageService],
})
export class SettingsModule {}
