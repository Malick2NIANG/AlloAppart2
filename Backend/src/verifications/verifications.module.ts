import { Module } from '@nestjs/common';
import { VerificationsController } from './verifications.controller';
import { VerificationsService } from './verifications.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaydunyaModule } from '../paydunya/paydunya.module';

@Module({
  imports: [NotificationsModule, PaydunyaModule],
  controllers: [VerificationsController],
  providers: [VerificationsService],
})
export class VerificationsModule {}
