import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { BookingsModule } from './bookings/bookings.module';
import { CategoriesModule } from './categories/categories.module';
import { ChatModule } from './chat/chat.module';
import { HealthModule } from './health/health.module';
import { PhysiotherapistsModule } from './physiotherapists/physiotherapists.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReviewsModule } from './reviews/reviews.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // isGlobal=true lets us use environment variables anywhere without
    // repeatedly importing ConfigModule in every feature module.
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AdminModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    PhysiotherapistsModule,
    BookingsModule,
    ChatModule,
    ReviewsModule,
    HealthModule,
  ],
})
export class AppModule {}
