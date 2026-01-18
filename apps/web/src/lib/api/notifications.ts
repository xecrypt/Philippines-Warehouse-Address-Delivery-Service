import type { ApiResponse, PaginatedResponse, NotificationType } from '@warehouse/shared';
import { apiClient } from './client';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  parcelId: string | null;
  deliveryId: string | null;
  exceptionId: string | null;
  createdAt: Date;
}

export async function getNotifications(params?: {
  isRead?: boolean;
  page?: number;
  limit?: number;
}): Promise<ApiResponse<PaginatedResponse<Notification>>> {
  const searchParams = new URLSearchParams();
  if (params?.isRead !== undefined) searchParams.set('isRead', params.isRead.toString());
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const query = searchParams.toString();
  return apiClient<ApiResponse<PaginatedResponse<Notification>>>(
    `/notifications${query ? `?${query}` : ''}`
  );
}

export async function getUnreadCount(): Promise<ApiResponse<{ count: number }>> {
  return apiClient<ApiResponse<{ count: number }>>('/notifications/unread-count');
}

export async function markAsRead(id: string): Promise<ApiResponse<Notification>> {
  return apiClient<ApiResponse<Notification>>(`/notifications/${id}/read`, {
    method: 'PATCH',
  });
}

export async function markAllAsRead(): Promise<ApiResponse<void>> {
  return apiClient<ApiResponse<void>>('/notifications/read-all', {
    method: 'PATCH',
  });
}
