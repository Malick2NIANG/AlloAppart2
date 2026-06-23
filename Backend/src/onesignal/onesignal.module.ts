import { Module } from '@nestjs/common';
import { OnesignalService } from './onesignal.service';

@Module({
  providers: [OnesignalService],
  exports: [OnesignalService],
})
export class OnesignalModule {}
