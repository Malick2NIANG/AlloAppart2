import { Global, Module } from '@nestjs/common';
import { PlatformConfigController } from './platform-config.controller';
import { TarifsController } from './tarifs.controller';
import { PlatformConfigService } from './platform-config.service';
import { NotificationsModule } from '../notifications/notifications.module';

// Global : consommé par subscriptions/verifications/listings/bookings sans
// avoir à réimporter ce module dans chacun (même pattern que Prisma/Mail).
@Global()
@Module({
  imports: [NotificationsModule],
  controllers: [PlatformConfigController, TarifsController],
  providers: [PlatformConfigService],
  exports: [PlatformConfigService],
})
export class PlatformConfigModule {}
