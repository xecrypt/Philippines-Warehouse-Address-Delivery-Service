import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaService
 *
 * Wraps PrismaClient to integrate with NestJS lifecycle.
 * Handles connection management and graceful shutdown.
 *
 * Key features:
 * - Connects to database when module initializes
 * - Disconnects gracefully when application shuts down
 * - Provides full Prisma client API for database operations
 *
 * Usage:
 * ```typescript
 * @Injectable()
 * export class UsersService {
 *   constructor(private prisma: PrismaService) {}
 *
 *   async findById(id: string) {
 *     return this.prisma.user.findUnique({ where: { id } });
 *   }
 * }
 * ```
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  /**
   * Called when the NestJS module initializes.
   * Establishes connection to the PostgreSQL database.
   */
  async onModuleInit() {
    await this.$connect();
  }

  /**
   * Called when the NestJS application is shutting down.
   * Gracefully closes the database connection.
   */
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
