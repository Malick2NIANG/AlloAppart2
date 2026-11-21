import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PusherModule } from '../pusher/pusher.module';
import { PushModule } from '../push/push.module';

@Module({
  imports: [PusherModule, PushModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
