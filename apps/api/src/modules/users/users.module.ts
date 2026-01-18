import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuditModule } from '../audit/audit.module';

/**
 * UsersModule
 *
 * Provides user management functionality:
 * - User profile and address management
 * - Admin user management (list, roles, status)
 * - Member code lookup for staff
 */
@Module({
  imports: [AuditModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
