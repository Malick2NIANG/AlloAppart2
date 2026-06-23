import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ListingsModule } from './listings/listings.module';
import { BookingsModule } from './bookings/bookings.module';
import { VerificationsModule } from './verifications/verifications.module';
import { MessagesModule } from './messages/messages.module';
import { PaymentsModule } from './payments/payments.module';
import { ReviewsModule } from './reviews/reviews.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SearchModule } from './search/search.module';
import { UploadModule } from './upload/upload.module';
import { PusherModule } from './pusher/pusher.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { OnesignalModule } from './onesignal/onesignal.module';
import { PdfModule } from './pdf/pdf.module';
import { MailModule } from './mail/mail.module';
import { SmsModule } from './sms/sms.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    ListingsModule,
    BookingsModule,
    VerificationsModule,
    MessagesModule,
    PaymentsModule,
    ReviewsModule,
    AnalyticsModule,
    SearchModule,
    UploadModule,
    PusherModule,
    SubscriptionsModule,
    OnesignalModule,
    PdfModule,
    MailModule,
    SmsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
