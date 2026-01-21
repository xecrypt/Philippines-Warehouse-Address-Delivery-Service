import type {
  ApiResponse,
  PaginatedResponse,
  Delivery,
  PaymentStatus,
} from '@warehouse/shared';
import { apiClient, generateIdempotencyKey } from './client';

export interface RequestDeliveryData {
  parcelId: string;
  deliveryAddress: {
    street: string;
    city: string;
    province: string;
    zipCode: string;
  };
  idempotencyKey?: string;
}

export interface FeeEstimate {
  parcelId: string;
  weight: number;
  roundedWeight: number;
  baseFee: number;
  weightFee: number;
  totalFee: number;
}

export async function getEstimate(parcelId: string): Promise<ApiResponse<FeeEstimate>> {
  return apiClient<ApiResponse<FeeEstimate>>(`/deliveries/estimate/${parcelId}`);
}

export async function requestDelivery(data: RequestDeliveryData): Promise<ApiResponse<Delivery>> {
  const headers: Record<string, string> = {};
  if (data.idempotencyKey) {
    headers['Idempotency-Key'] = data.idempotencyKey;
  }

  return apiClient<ApiResponse<Delivery>>('/deliveries', {
    method: 'POST',
    body: JSON.stringify({
      parcelId: data.parcelId,
      deliveryStreet: data.deliveryAddress.street,
      deliveryCity: data.deliveryAddress.city,
      deliveryProvince: data.deliveryAddress.province,
      deliveryZipCode: data.deliveryAddress.zipCode,
    }),
    headers,
  });
}

export async function getMyDeliveries(params?: {
  paymentStatus?: PaymentStatus;
  page?: number;
  limit?: number;
}): Promise<ApiResponse<PaginatedResponse<Delivery>>> {
  const searchParams = new URLSearchParams();
  if (params?.paymentStatus) searchParams.set('paymentStatus', params.paymentStatus);
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const query = searchParams.toString();
  return apiClient<ApiResponse<PaginatedResponse<Delivery>>>(
    `/deliveries/my${query ? `?${query}` : ''}`
  );
}

export async function getAllDeliveries(params?: {
  paymentStatus?: PaymentStatus;
  page?: number;
  limit?: number;
}): Promise<ApiResponse<PaginatedResponse<Delivery>>> {
  const searchParams = new URLSearchParams();
  if (params?.paymentStatus) searchParams.set('paymentStatus', params.paymentStatus);
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const query = searchParams.toString();
  return apiClient<ApiResponse<PaginatedResponse<Delivery>>>(
    `/deliveries${query ? `?${query}` : ''}`
  );
}

export async function getDeliveryById(id: string): Promise<ApiResponse<Delivery>> {
  return apiClient<ApiResponse<Delivery>>(`/deliveries/${id}`);
}

export async function confirmPayment(id: string): Promise<ApiResponse<Delivery>> {
  return apiClient<ApiResponse<Delivery>>(`/deliveries/${id}/confirm-payment`, {
    method: 'PATCH',
    headers: {
      'Idempotency-Key': generateIdempotencyKey(),
    },
  });
}

export async function dispatchDelivery(id: string): Promise<ApiResponse<Delivery>> {
  return apiClient<ApiResponse<Delivery>>(`/deliveries/${id}/dispatch`, {
    method: 'PATCH',
  });
}

export async function completeDelivery(id: string): Promise<ApiResponse<Delivery>> {
  return apiClient<ApiResponse<Delivery>>(`/deliveries/${id}/complete`, {
    method: 'PATCH',
  });
}
