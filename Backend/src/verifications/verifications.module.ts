import { Module } from '@nestjs/common';
import { VerificationsController } from './verifications.controller';
import { VerificationsService } from './verifications.service';

@Module({
  controllers: [VerificationsController],
  providers: [VerificationsService],
})
export class VerificationsModule {}
