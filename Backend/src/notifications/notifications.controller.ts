import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { type User, Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { BroadcastDto } from './dto/broadcast.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  /* ── In-app ──────────────────────────────────────────────────────── */

  @Get('mine')
  mine(@CurrentUser() user: User) {
    return this.notifications.findByUser(user.id);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: User) {
    return this.notifications.unreadCount(user.id);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: User) {
    return this.notifications.markRead(id, user.id);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: User) {
    return this.notifications.markAllRead(user.id);
  }

  /* ── Admin broadcast ─────────────────────────────────────────────── */

  @Post('broadcast')
  @Roles(Role.ADMIN)
  @HttpCode(200)
  broadcast(@Body() dto: BroadcastDto) {
    return this.notifications.broadcastPush(dto.title, dto.message, dto.segment);
  }
}
