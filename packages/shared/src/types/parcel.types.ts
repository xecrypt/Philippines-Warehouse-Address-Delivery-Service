import { ParcelState } from '../constants/parcel-states';

export interface Parcel {
  id: string;
  trackingNumber: string;
  memberCode: string;
  description: string | null;
  weight: number;
  state: ParcelState;
  isPreAlerted: boolean;
  preAlertedAt: Date | null;
  arrivedAt: Date;
  storedAt: Date | null;
  hasException: boolean;
  ownerId: string | null;
  registeredById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ParcelWithOwner extends Parcel {
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    memberCode: string;
  } | null;
}

export interface ParcelStateHistory {
  id: string;
  parcelId: string;
  fromState: ParcelState | null;
  toState: ParcelState;
  changedById: string;
  notes: string | null;
  createdAt: Date;
}
