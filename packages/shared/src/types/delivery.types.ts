import { PaymentStatus } from '../constants/exception-types';

export interface Delivery {
  id: string;
  parcelId: string;
  recipientId: string;
  deliveryStreet: string;
  deliveryCity: string;
  deliveryProvince: string;
  deliveryZipCode: string;
  weightKg: number;
  baseFee: number;
  weightFee: number;
  totalFee: number;
  paymentStatus: PaymentStatus;
  paymentConfirmedAt: Date | null;
  paymentConfirmedById: string | null;
  requestedAt: Date;
  dispatchedAt: Date | null;
  deliveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeeBreakdown {
  baseFee: number;
  weightFee: number;
  totalFee: number;
  weightKg: number;
}

export interface FeeConfiguration {
  id: string;
  name: string;
  baseFee: number;
  perKgRate: number;
  minWeight: number;
  maxWeight: number | null;
  isActive: boolean;
}
