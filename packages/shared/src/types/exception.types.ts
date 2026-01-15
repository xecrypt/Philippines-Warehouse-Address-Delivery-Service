import { ExceptionType, ExceptionStatus } from '../constants/exception-types';

export interface Exception {
  id: string;
  parcelId: string;
  type: ExceptionType;
  status: ExceptionStatus;
  description: string;
  resolution: string | null;
  resolvedAt: Date | null;
  createdById: string;
  handledById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExceptionWithDetails extends Exception {
  parcel: {
    id: string;
    trackingNumber: string;
    memberCode: string;
  };
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  handledBy: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
}
