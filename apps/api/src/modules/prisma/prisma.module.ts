import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * PrismaModule
 *
 * Global module that provides database access throughout the application.
 * Marked as @Global so it doesn't need to be imported in every module.
 *
 * Usage in other modules:
 * - Just inject PrismaService in constructors
 * - No need to import PrismaModule explicitly
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
