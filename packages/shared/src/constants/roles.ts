export enum Role {
  USER = 'USER',
  WAREHOUSE_STAFF = 'WAREHOUSE_STAFF',
  ADMIN = 'ADMIN',
}

export const ROLE_HIERARCHY: Record<Role, number> = {
  [Role.USER]: 0,
  [Role.WAREHOUSE_STAFF]: 1,
  [Role.ADMIN]: 2,
};
