import type { ApiResponse, PaginatedResponse } from '@warehouse/shared';
import { apiClient } from './client';

export interface AuditLog {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  previousData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  actor?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface QueryAuditLogsParams {
  actorId?: string;
  entityType?: string;
  action?: string;
  parcelId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export async function queryAuditLogs(
  params?: QueryAuditLogsParams
): Promise<ApiResponse<PaginatedResponse<AuditLog>>> {
  const searchParams = new URLSearchParams();
  if (params?.actorId) searchParams.set('actorId', params.actorId);
  if (params?.entityType) searchParams.set('entityType', params.entityType);
  if (params?.action) searchParams.set('action', params.action);
  if (params?.parcelId) searchParams.set('parcelId', params.parcelId);
  if (params?.startDate) searchParams.set('startDate', params.startDate);
  if (params?.endDate) searchParams.set('endDate', params.endDate);
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const query = searchParams.toString();
  return apiClient<ApiResponse<PaginatedResponse<AuditLog>>>(
    `/audit${query ? `?${query}` : ''}`
  );
}

export async function getAuditLogsByEntity(
  entityType: string,
  entityId: string
): Promise<ApiResponse<AuditLog[]>> {
  return apiClient<ApiResponse<AuditLog[]>>(`/audit/entity/${entityType}/${entityId}`);
}

export async function getAuditLogsByParcel(parcelId: string): Promise<ApiResponse<AuditLog[]>> {
  return apiClient<ApiResponse<AuditLog[]>>(`/audit/parcel/${parcelId}`);
}

export async function getAuditLogsByActor(
  actorId: string,
  params?: { page?: number; limit?: number }
): Promise<ApiResponse<PaginatedResponse<AuditLog>>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const query = searchParams.toString();
  return apiClient<ApiResponse<PaginatedResponse<AuditLog>>>(
    `/audit/actor/${actorId}${query ? `?${query}` : ''}`
  );
}
