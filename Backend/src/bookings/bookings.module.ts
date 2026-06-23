import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { PdfModule } from '../pdf/pdf.module';

@Module({
  imports: [NotificationsModule, PdfModule],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
