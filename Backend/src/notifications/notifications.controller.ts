import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { NotificationsService } from './notifications.service';
import { BroadcastDto } from './dto/broadcast.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post('broadcast')
  @Roles(Role.ADMIN)
  @HttpCode(200)
  broadcast(@Body() dto: BroadcastDto) {
    return this.notifications.broadcastPush(dto.title, dto.message, dto.segment);
  }
}
