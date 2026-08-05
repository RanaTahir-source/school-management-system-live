import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopedUser } from '../../common/utils/school-scope';

// Internal messaging - open to every authenticated role (no @Roles guard),
// since any staff/student/teacher may need to message another user at the
// same school. School-membership is enforced inside the service instead.
@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly service: MessagesService) {}

  @Post()
  send(@Body() dto: SendMessageDto, @CurrentUser() user: ScopedUser & { userId: string }) {
    return this.service.send(dto, user);
  }

  @Get('inbox')
  inbox(@CurrentUser() user: ScopedUser & { userId: string }) {
    return this.service.inbox(user);
  }

  @Get('sent')
  sent(@CurrentUser() user: ScopedUser & { userId: string }) {
    return this.service.sent(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: ScopedUser & { userId: string }) {
    return this.service.findOne(id, user);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: ScopedUser & { userId: string }) {
    return this.service.markRead(id, user);
  }
}
