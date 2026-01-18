import type {
  ApiResponse,
  PaginatedResponse,
  Exception,
  ExceptionWithDetails,
  ExceptionType,
  ExceptionStatus,
} from '@warehouse/shared';
import { apiClient } from './client';

export interface CreateExceptionData {
  parcelId: string;
  type: ExceptionType;
  description: string;
}

export async function createException(data: CreateExceptionData): Promise<ApiResponse<Exception>> {
  return apiClient<ApiResponse<Exception>>('/exceptions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getOpenExceptions(params?: {
  type?: ExceptionType;
  page?: number;
  limit?: number;
}): Promise<ApiResponse<PaginatedResponse<ExceptionWithDetails>>> {
  const searchParams = new URLSearchParams();
  if (params?.type) searchParams.set('type', params.type);
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const query = searchParams.toString();
  return apiClient<ApiResponse<PaginatedResponse<ExceptionWithDetails>>>(
    `/exceptions/open${query ? `?${query}` : ''}`
  );
}

export async function getAllExceptions(params?: {
  status?: ExceptionStatus;
  type?: ExceptionType;
  page?: number;
  limit?: number;
}): Promise<ApiResponse<PaginatedResponse<ExceptionWithDetails>>> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.type) searchParams.set('type', params.type);
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const query = searchParams.toString();
  return apiClient<ApiResponse<PaginatedResponse<ExceptionWithDetails>>>(
    `/exceptions${query ? `?${query}` : ''}`
  );
}

export async function getExceptionById(id: string): Promise<ApiResponse<ExceptionWithDetails>> {
  return apiClient<ApiResponse<ExceptionWithDetails>>(`/exceptions/${id}`);
}

export async function getExceptionsByParcel(parcelId: string): Promise<ApiResponse<ExceptionWithDetails[]>> {
  return apiClient<ApiResponse<ExceptionWithDetails[]>>(`/exceptions/parcel/${parcelId}`);
}

export async function assignException(id: string): Promise<ApiResponse<Exception>> {
  return apiClient<ApiResponse<Exception>>(`/exceptions/${id}/assign`, {
    method: 'PATCH',
  });
}

export async function resolveException(id: string, resolution: string): Promise<ApiResponse<Exception>> {
  return apiClient<ApiResponse<Exception>>(`/exceptions/${id}/resolve`, {
    method: 'PATCH',
    body: JSON.stringify({ resolution }),
  });
}

export async function cancelException(id: string): Promise<ApiResponse<Exception>> {
  return apiClient<ApiResponse<Exception>>(`/exceptions/${id}/cancel`, {
    method: 'PATCH',
  });
}
