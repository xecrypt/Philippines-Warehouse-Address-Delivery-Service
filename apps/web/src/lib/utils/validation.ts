import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
});

export const deliveryAddressSchema = z.object({
  street: z.string().min(1, 'Street is required'),
  city: z.string().min(1, 'City is required'),
  province: z.string().min(1, 'Province is required'),
  zipCode: z.string().min(1, 'Zip code is required'),
});

export const parcelIntakeSchema = z.object({
  trackingNumber: z.string().min(1, 'Tracking number is required'),
  memberCode: z.string().min(1, 'Member code is required'),
  weight: z
    .number()
    .min(0.01, 'Weight must be greater than 0')
    .max(50, 'Weight cannot exceed 50kg'),
  description: z.string().optional(),
});

export const exceptionSchema = z.object({
  parcelId: z.string().uuid('Invalid parcel ID'),
  type: z.string().min(1, 'Exception type is required'),
  description: z.string().min(1, 'Description is required'),
});

export const resolveExceptionSchema = z.object({
  resolution: z.string().min(1, 'Resolution is required'),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type DeliveryAddressFormData = z.infer<typeof deliveryAddressSchema>;
export type ParcelIntakeFormData = z.infer<typeof parcelIntakeSchema>;
export type ExceptionFormData = z.infer<typeof exceptionSchema>;
export type ResolveExceptionFormData = z.infer<typeof resolveExceptionSchema>;
