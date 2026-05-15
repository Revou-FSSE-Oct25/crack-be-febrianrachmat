import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AvailabilitySlotsModule } from './availability-slots/availability-slots.module';
import { AuthModule } from './auth/auth.module';
import { BookingsModule } from './bookings/bookings.module';
import { CategoriesModule } from './categories/categories.module';
import { ChatModule } from './chat/chat.module';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PhysiotherapistsModule } from './physiotherapists/physiotherapists.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReviewsModule } from './reviews/reviews.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // isGlobal=true lets us use environment variables anywhere without
    // repeatedly importing ConfigModule in every feature module.
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
      skipIf: () => process.env.DISABLE_THROTTLE === 'true',
      errorMessage:
        'Terlalu banyak permintaan dari alamat ini. Coba lagi dalam beberapa saat.',
    }),
    PrismaModule,
    AdminModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    AvailabilitySlotsModule,
    PhysiotherapistsModule,
    BookingsModule,
    ChatModule,
    NotificationsModule,
    ReviewsModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
