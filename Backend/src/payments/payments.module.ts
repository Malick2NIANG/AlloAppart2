import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaydunyaModule } from '../paydunya/paydunya.module';
import { ContractsModule } from '../contracts/contracts.module';

@Module({
  imports: [NotificationsModule, PaydunyaModule, ContractsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
