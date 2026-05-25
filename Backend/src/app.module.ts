import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

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

@Module({
  imports: [
    // Variables d'environnement disponibles partout via ConfigService
    ConfigModule.forRoot({ isGlobal: true }),

    // Rate limiting : 100 req/min (public) — surcharge possible par route
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    // ORM global (exporté depuis PrismaModule @Global)
    PrismaModule,

    // Modules métier
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
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
