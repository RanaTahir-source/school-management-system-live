import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

// Every authenticated role has a notification feed - no @Roles guard needed.
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  findMine(@CurrentUser() user: { userId: string }, @Query('unreadOnly') unreadOnly?: string) {
    return this.service.findMine(user.userId, unreadOnly === 'true');
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: { userId: string }) {
    return this.service.unreadCount(user.userId);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return this.service.markRead(id, user.userId);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: { userId: string }) {
    return this.service.markAllRead(user.userId);
  }
}
