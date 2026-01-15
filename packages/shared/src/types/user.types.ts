import { Role } from '../constants/roles';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  memberCode: string;
  role: Role;
  isActive: boolean;
  deliveryStreet: string | null;
  deliveryCity: string | null;
  deliveryProvince: string | null;
  deliveryZipCode: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

export interface UserProfile extends Omit<User, 'refreshToken'> {
  warehouseAddress: WarehouseAddress;
}

export interface WarehouseAddress {
  name: string;
  street: string;
  unit: string;
  city: string;
  country: string;
  phone: string;
  formatted: string;
}

export interface DeliveryAddress {
  street: string;
  city: string;
  province: string;
  zipCode: string;
}
