import { IsEnum } from 'class-validator';
import { Role } from '@prisma/client';

/**
 * UpdateUserRoleDto
 *
 * Validation for admin updating a user's role.
 */
export class UpdateUserRoleDto {
  @IsEnum(Role, { message: 'Invalid role. Must be USER, WAREHOUSE_STAFF, or ADMIN' })
  role: Role;
}
