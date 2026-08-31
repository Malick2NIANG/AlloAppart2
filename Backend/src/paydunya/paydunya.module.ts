import { Module } from '@nestjs/common';
import { PaydunyaSoftpayService } from './paydunya-softpay.service';

@Module({
  providers: [PaydunyaSoftpayService],
  exports: [PaydunyaSoftpayService],
})
export class PaydunyaModule {}
