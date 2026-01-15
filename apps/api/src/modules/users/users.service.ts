import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateDeliveryAddressDto, UpdateUserRoleDto } from './dto';

/**
 * UsersService
 *
 * Handles user management operations:
 * - Get user by ID or member code
 * - Update delivery address
 * - Admin: list users, update roles, activate/deactivate
 */
@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Find user by ID.
   *
   * @param id - User ID
   * @returns User or throws NotFoundException
   */
  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id, isDeleted: false },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        memberCode: true,
        role: true,
        isActive: true,
        deliveryStreet: true,
        deliveryCity: true,
        deliveryProvince: true,
        deliveryZipCode: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Find user by member code.
   * Used by warehouse staff during parcel intake.
   *
   * @param memberCode - Member code (e.g., PHW-ABC123)
   * @returns User or null
   */
  async findByMemberCode(memberCode: string) {
    const user = await this.prisma.user.findUnique({
      where: { memberCode, isDeleted: false },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        memberCode: true,
        role: true,
        isActive: true,
      },
    });

    return user;
  }

  /**
   * Update user's delivery address.
   *
   * @param userId - User ID
   * @param dto - New address data
   * @returns Updated user
   */
  async updateDeliveryAddress(userId: string, dto: UpdateDeliveryAddressDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, isDeleted: false },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        deliveryStreet: dto.deliveryStreet,
        deliveryCity: dto.deliveryCity,
        deliveryProvince: dto.deliveryProvince,
        deliveryZipCode: dto.deliveryZipCode,
      },
      select: {
        id: true,
        deliveryStreet: true,
        deliveryCity: true,
        deliveryProvince: true,
        deliveryZipCode: true,
      },
    });
  }

  // ============================================================
  // ADMIN OPERATIONS
  // ============================================================

  /**
   * List all users (paginated).
   * Admin only.
   *
   * @param page - Page number (1-indexed)
   * @param limit - Items per page
   * @param role - Filter by role (optional)
   * @returns Paginated user list
   */
  async listUsers(page: number = 1, limit: number = 20, role?: Role) {
    const skip = (page - 1) * limit;

    const where = {
      isDeleted: false,
      ...(role && { role }),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          memberCode: true,
          role: true,
          isActive: true,
          createdAt: true,
          lastLoginAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update user's role.
   * Admin only.
   *
   * @param targetUserId - User to update
   * @param dto - New role
   * @param adminUserId - Admin making the change
   * @returns Updated user
   */
  async updateUserRole(
    targetUserId: string,
    dto: UpdateUserRoleDto,
    adminUserId: string,
  ) {
    // Prevent admin from changing their own role
    if (targetUserId === adminUserId) {
      throw new ForbiddenException('Cannot change your own role');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId, isDeleted: false },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: targetUserId },
      data: { role: dto.role },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        memberCode: true,
        role: true,
      },
    });
  }

  /**
   * Activate or deactivate a user.
   * Admin only.
   *
   * @param targetUserId - User to update
   * @param isActive - New active status
   * @param adminUserId - Admin making the change
   * @returns Updated user
   */
  async setUserActiveStatus(
    targetUserId: string,
    isActive: boolean,
    adminUserId: string,
  ) {
    // Prevent admin from deactivating themselves
    if (targetUserId === adminUserId && !isActive) {
      throw new ForbiddenException('Cannot deactivate your own account');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId, isDeleted: false },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: targetUserId },
      data: { isActive },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        memberCode: true,
        role: true,
        isActive: true,
      },
    });
  }

  /**
   * Soft delete a user.
   * Admin only.
   *
   * @param targetUserId - User to delete
   * @param adminUserId - Admin making the change
   */
  async softDeleteUser(targetUserId: string, adminUserId: string) {
    // Prevent admin from deleting themselves
    if (targetUserId === adminUserId) {
      throw new ForbiddenException('Cannot delete your own account');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId, isDeleted: false },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        isDeleted: true,
        isActive: false,
        refreshToken: null, // Invalidate any active sessions
      },
    });

    return { message: 'User deleted successfully' };
  }
}
