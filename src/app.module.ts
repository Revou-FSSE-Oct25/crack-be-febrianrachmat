import * as path from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import {
  AcceptLanguageResolver,
  HeaderResolver,
  I18nModule,
  QueryResolver,
} from 'nestjs-i18n';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { AvailabilitySlotsModule } from './availability-slots/availability-slots.module';
import { AuthModule } from './auth/auth.module';
import { BookingsModule } from './bookings/bookings.module';
import { CategoriesModule } from './categories/categories.module';
import { ChatModule } from './chat/chat.module';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PatientsModule } from './patients/patients.module';
import { PhysiotherapistsModule } from './physiotherapists/physiotherapists.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReviewsModule } from './reviews/reviews.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // isGlobal=true lets us use environment variables anywhere without
    // repeatedly importing ConfigModule in every feature module.
    ConfigModule.forRoot({ isGlobal: true }),
    // Internationalization. `en` stays the default so existing English API
    // messages are unchanged; clients opt into other languages per request via
    // `?lang=id`, an `x-lang: id` header, or the standard `Accept-Language`
    // header (resolvers are tried in this order).
    I18nModule.forRoot({
      fallbackLanguage: process.env.DEFAULT_LANGUAGE ?? 'en',
      loaderOptions: {
        path: path.join(__dirname, '/i18n/'),
        watch: process.env.NODE_ENV !== 'production',
      },
      resolvers: [
        { use: QueryResolver, options: ['lang'] },
        new HeaderResolver(['x-lang']),
        AcceptLanguageResolver,
      ],
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
      skipIf: () => process.env.DISABLE_THROTTLE === 'true',
      errorMessage:
        'Terlalu banyak permintaan dari alamat ini. Coba lagi dalam beberapa saat.',
    }),
    PrismaModule,
    AuditModule,
    AdminModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    AvailabilitySlotsModule,
    PhysiotherapistsModule,
    PatientsModule,
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
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformResponseInterceptor,
    },
  ],
})
export class AppModule {}
