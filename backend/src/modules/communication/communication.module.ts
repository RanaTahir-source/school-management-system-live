import { Module } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { AnnouncementsController } from './announcements.controller';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { CommunicationProviderService } from './communication-provider.service';

@Module({
  controllers: [AnnouncementsController, MessagesController, NotificationsController],
  providers: [AnnouncementsService, MessagesService, NotificationsService, CommunicationProviderService],
  exports: [CommunicationProviderService],
})
export class CommunicationModule {}
