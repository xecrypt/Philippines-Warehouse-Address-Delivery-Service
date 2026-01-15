import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Roles Decorator
 *
 * Marks a route as requiring specific role(s).
 * Used with RolesGuard to enforce RBAC.
 *
 * Usage:
 * ```typescript
 * @Roles(Role.ADMIN)
 * @Get('admin-only')
 * adminOnly() {}
 *
 * @Roles(Role.WAREHOUSE_STAFF, Role.ADMIN)
 * @Post('register-parcel')
 * registerParcel() {}
 * ```
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
