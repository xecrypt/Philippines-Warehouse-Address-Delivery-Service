import type { ApiResponse, PaginatedResponse, User, Role } from '@warehouse/shared';
import { apiClient } from './client';

export interface UpdateAddressData {
  street: string;
  city: string;
  province: string;
  zipCode: string;
}

export async function updateMyAddress(data: UpdateAddressData): Promise<ApiResponse<User>> {
  return apiClient<ApiResponse<User>>('/users/me/address', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function findByMemberCode(code: string): Promise<ApiResponse<User>> {
  return apiClient<ApiResponse<User>>(`/users/by-member-code/${encodeURIComponent(code)}`);
}

export async function getAllUsers(params?: {
  page?: number;
  limit?: number;
  role?: Role;
  isActive?: boolean;
}): Promise<ApiResponse<PaginatedResponse<User>>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.role) searchParams.set('role', params.role);
  if (params?.isActive !== undefined) searchParams.set('isActive', params.isActive.toString());

  const query = searchParams.toString();
  return apiClient<ApiResponse<PaginatedResponse<User>>>(
    `/users${query ? `?${query}` : ''}`
  );
}

export async function getUserById(id: string): Promise<ApiResponse<User>> {
  return apiClient<ApiResponse<User>>(`/users/${id}`);
}

export async function updateUserRole(id: string, role: Role): Promise<ApiResponse<User>> {
  return apiClient<ApiResponse<User>>(`/users/${id}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export async function updateUserStatus(id: string, isActive: boolean): Promise<ApiResponse<User>> {
  return apiClient<ApiResponse<User>>(`/users/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}

export async function deleteUser(id: string): Promise<ApiResponse<void>> {
  return apiClient<ApiResponse<void>>(`/users/${id}`, {
    method: 'DELETE',
  });
}
