import type { ApiResponse, AuthResponse, LoginRequest, RegisterRequest, UserProfile } from '@warehouse/shared';
import { apiClient } from './client';

export async function register(data: RegisterRequest): Promise<ApiResponse<AuthResponse>> {
  return apiClient<ApiResponse<AuthResponse>>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
    skipAuth: true,
  });
}

export async function login(data: LoginRequest): Promise<ApiResponse<AuthResponse>> {
  return apiClient<ApiResponse<AuthResponse>>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
    skipAuth: true,
  });
}

export async function refreshToken(): Promise<ApiResponse<{ tokens: { accessToken: string; refreshToken: string } }>> {
  return apiClient('/auth/refresh', {
    method: 'POST',
  });
}

export async function logout(): Promise<ApiResponse<void>> {
  return apiClient<ApiResponse<void>>('/auth/logout', {
    method: 'POST',
  });
}

export async function getProfile(): Promise<ApiResponse<UserProfile>> {
  return apiClient<ApiResponse<UserProfile>>('/auth/me');
}
