import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AuditModule } from './modules/audit/audit.module';
import { ParcelsModule } from './modules/parcels/parcels.module';
import { DeliveriesModule } from './modules/deliveries/deliveries.module';
import { ExceptionsModule } from './modules/exceptions/exceptions.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    AuditModule,
    ParcelsModule,
    DeliveriesModule,
    ExceptionsModule,
    NotificationsModule,
  ],
})
export class AppModule {}
