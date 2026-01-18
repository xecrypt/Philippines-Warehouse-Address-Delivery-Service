import type {
  ApiResponse,
  PaginatedResponse,
  Parcel,
  ParcelWithOwner,
  ParcelStateHistory,
  ParcelState,
} from '@warehouse/shared';
import { apiClient } from './client';

export interface IntakeParcelData {
  trackingNumber: string;
  memberCode: string;
  weight: number;
  description?: string;
}

export interface UpdateStateData {
  state: ParcelState;
  notes?: string;
}

export async function intakeParcel(data: IntakeParcelData): Promise<ApiResponse<Parcel>> {
  return apiClient<ApiResponse<Parcel>>('/parcels/intake', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getMyParcels(params?: {
  state?: ParcelState;
  page?: number;
  limit?: number;
}): Promise<ApiResponse<PaginatedResponse<ParcelWithOwner>>> {
  const searchParams = new URLSearchParams();
  if (params?.state) searchParams.set('state', params.state);
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const query = searchParams.toString();
  return apiClient<ApiResponse<PaginatedResponse<ParcelWithOwner>>>(
    `/parcels/my/list${query ? `?${query}` : ''}`
  );
}

export async function getAllParcels(params?: {
  state?: ParcelState;
  hasException?: boolean;
  page?: number;
  limit?: number;
}): Promise<ApiResponse<PaginatedResponse<ParcelWithOwner>>> {
  const searchParams = new URLSearchParams();
  if (params?.state) searchParams.set('state', params.state);
  if (params?.hasException !== undefined) searchParams.set('hasException', params.hasException.toString());
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const query = searchParams.toString();
  return apiClient<ApiResponse<PaginatedResponse<ParcelWithOwner>>>(
    `/parcels${query ? `?${query}` : ''}`
  );
}

export async function getParcelById(id: string): Promise<ApiResponse<ParcelWithOwner>> {
  return apiClient<ApiResponse<ParcelWithOwner>>(`/parcels/${id}`);
}

export async function getParcelByTracking(trackingNumber: string): Promise<ApiResponse<ParcelWithOwner>> {
  return apiClient<ApiResponse<ParcelWithOwner>>(`/parcels/tracking/${encodeURIComponent(trackingNumber)}`);
}

export async function searchByMemberCode(code: string): Promise<ApiResponse<ParcelWithOwner[]>> {
  return apiClient<ApiResponse<ParcelWithOwner[]>>(
    `/parcels/search/member-code?code=${encodeURIComponent(code)}`
  );
}

export async function updateParcelState(id: string, data: UpdateStateData): Promise<ApiResponse<Parcel>> {
  return apiClient<ApiResponse<Parcel>>(`/parcels/${id}/state`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function getParcelHistory(id: string): Promise<ApiResponse<ParcelStateHistory[]>> {
  return apiClient<ApiResponse<ParcelStateHistory[]>>(`/parcels/${id}/history`);
}

export async function overrideOwnership(id: string, ownerId: string): Promise<ApiResponse<Parcel>> {
  return apiClient<ApiResponse<Parcel>>(`/parcels/${id}/override-ownership`, {
    method: 'PATCH',
    body: JSON.stringify({ ownerId }),
  });
}

export async function deleteParcel(id: string): Promise<ApiResponse<void>> {
  return apiClient<ApiResponse<void>>(`/parcels/${id}`, {
    method: 'DELETE',
  });
}
