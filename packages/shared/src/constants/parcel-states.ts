export enum ParcelState {
  EXPECTED = 'EXPECTED',
  ARRIVED = 'ARRIVED',
  STORED = 'STORED',
  DELIVERY_REQUESTED = 'DELIVERY_REQUESTED',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
}

export const PARCEL_STATE_TRANSITIONS: Record<ParcelState, ParcelState[]> = {
  [ParcelState.EXPECTED]: [ParcelState.ARRIVED],
  [ParcelState.ARRIVED]: [ParcelState.STORED],
  [ParcelState.STORED]: [ParcelState.DELIVERY_REQUESTED],
  [ParcelState.DELIVERY_REQUESTED]: [ParcelState.OUT_FOR_DELIVERY],
  [ParcelState.OUT_FOR_DELIVERY]: [ParcelState.DELIVERED],
  [ParcelState.DELIVERED]: [], // Terminal state
};

export const PARCEL_STATE_LABELS: Record<ParcelState, string> = {
  [ParcelState.EXPECTED]: 'Expected',
  [ParcelState.ARRIVED]: 'Arrived',
  [ParcelState.STORED]: 'Stored',
  [ParcelState.DELIVERY_REQUESTED]: 'Delivery Requested',
  [ParcelState.OUT_FOR_DELIVERY]: 'Out for Delivery',
  [ParcelState.DELIVERED]: 'Delivered',
};
