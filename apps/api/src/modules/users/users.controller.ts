import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
  ParseBoolPipe,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';
import { UpdateDeliveryAddressDto, UpdateUserRoleDto } from './dto';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { CurrentUser, Roles } from '../../common/decorators';

/**
 * UsersController
 *
 * User management endpoints:
 *
 * User endpoints:
 * - PATCH /api/users/me/address - Update own delivery address
 *
 * Staff endpoints:
 * - GET /api/users/by-member-code/:code - Find user by member code
 *
 * Admin endpoints:
 * - GET /api/users - List all users
 * - GET /api/users/:id - Get user by ID
 * - PATCH /api/users/:id/role - Update user role
 * - PATCH /api/users/:id/status - Activate/deactivate user
 * - DELETE /api/users/:id - Soft delete user
 */
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  // ============================================================
  // USER ENDPOINTS
  // ============================================================

  /**
   * Update own delivery address.
   * Available to all authenticated users.
   */
  @Patch('me/address')
  async updateMyAddress(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateDeliveryAddressDto,
  ) {
    return this.usersService.updateDeliveryAddress(userId, dto);
  }

  // ============================================================
  // STAFF ENDPOINTS
  // ============================================================

  /**
   * Find user by member code.
   * Used during parcel intake to validate member code.
   * Available to WAREHOUSE_STAFF and ADMIN.
   */
  @Get('by-member-code/:code')
  @UseGuards(RolesGuard)
  @Roles(Role.WAREHOUSE_STAFF, Role.ADMIN)
  async findByMemberCode(@Param('code') memberCode: string) {
    const user = await this.usersService.findByMemberCode(memberCode);
    if (!user) {
      return { found: false, user: null };
    }
    return { found: true, user };
  }

  // ============================================================
  // ADMIN ENDPOINTS
  // ============================================================

  /**
   * List all users (paginated).
   * Admin only.
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async listUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('role') role?: Role,
  ) {
    return this.usersService.listUsers(page, limit, role);
  }

  /**
   * Get user by ID.
   * Admin only.
   */
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async getUserById(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findById(id);
  }

  /**
   * Update user's role.
   * Admin only.
   */
  @Patch(':id/role')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async updateUserRole(
    @Param('id', ParseUUIDPipe) targetUserId: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser('id') adminUserId: string,
  ) {
    return this.usersService.updateUserRole(targetUserId, dto, adminUserId);
  }

  /**
   * Activate or deactivate a user.
   * Admin only.
   */
  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async setUserStatus(
    @Param('id', ParseUUIDPipe) targetUserId: string,
    @Query('active', ParseBoolPipe) isActive: boolean,
    @CurrentUser('id') adminUserId: string,
  ) {
    return this.usersService.setUserActiveStatus(
      targetUserId,
      isActive,
      adminUserId,
    );
  }

  /**
   * Soft delete a user.
   * Admin only.
   */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async deleteUser(
    @Param('id', ParseUUIDPipe) targetUserId: string,
    @CurrentUser('id') adminUserId: string,
  ) {
    return this.usersService.softDeleteUser(targetUserId, adminUserId);
  }
}
