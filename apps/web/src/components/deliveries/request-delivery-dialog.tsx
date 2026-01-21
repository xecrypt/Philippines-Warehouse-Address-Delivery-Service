'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ParcelState } from '@warehouse/shared';
import * as parcelsApi from '@/lib/api/parcels';
import * as deliveriesApi from '@/lib/api/deliveries';
import type { FeeEstimate } from '@/lib/api/deliveries';
import { generateIdempotencyKey } from '@/lib/api/client';
import { deliveryAddressSchema, type DeliveryAddressFormData } from '@/lib/utils/validation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Label,
} from '@/components/ui';
import type { ParcelWithOwner } from '@warehouse/shared';

interface RequestDeliveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedParcelId?: string | null;
  onSuccess: () => void;
}

type Step = 'select' | 'address' | 'confirm';

export function RequestDeliveryDialog({
  open,
  onOpenChange,
  preselectedParcelId,
  onSuccess,
}: RequestDeliveryDialogProps) {
  const [step, setStep] = useState<Step>('select');
  const [parcels, setParcels] = useState<ParcelWithOwner[]>([]);
  const [selectedParcel, setSelectedParcel] = useState<ParcelWithOwner | null>(null);
  const [feeEstimate, setFeeEstimate] = useState<FeeEstimate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    getValues,
  } = useForm<DeliveryAddressFormData>({
    resolver: zodResolver(deliveryAddressSchema),
  });

  useEffect(() => {
    if (open) {
      fetchStoredParcels();
    } else {
      // Reset state when dialog closes
      setStep('select');
      setSelectedParcel(null);
      setFeeEstimate(null);
      setError(null);
      reset();
    }
  }, [open, reset]);

  useEffect(() => {
    if (preselectedParcelId && parcels.length > 0) {
      const parcel = parcels.find((p) => p.id === preselectedParcelId);
      if (parcel) {
        handleSelectParcel(parcel);
      }
    }
  }, [preselectedParcelId, parcels]);

  async function fetchStoredParcels() {
    setIsLoading(true);
    try {
      const response = await parcelsApi.getMyParcels({ state: ParcelState.STORED });
      if (response.success && response.data) {
        setParcels(response.data.data);
      }
    } catch {
      setError('Failed to load parcels');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSelectParcel(parcel: ParcelWithOwner) {
    setSelectedParcel(parcel);
    setStep('address');

    // Fetch fee estimate
    try {
      const response = await deliveriesApi.getEstimate(parcel.id);
      if (response.success && response.data) {
        setFeeEstimate(response.data);
      }
    } catch {
      // Fee will be calculated on confirmation
    }
  }

  function handleAddressSubmit(data: DeliveryAddressFormData) {
    setStep('confirm');
  }

  async function handleConfirm() {
    if (!selectedParcel) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const address = getValues();
      const response = await deliveriesApi.requestDelivery({
        parcelId: selectedParcel.id,
        deliveryAddress: address,
        idempotencyKey: generateIdempotencyKey(),
      });

      if (response.success) {
        onSuccess();
      } else {
        setError(response.message || 'Failed to request delivery');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request delivery');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === 'select' && 'Select Parcel'}
            {step === 'address' && 'Delivery Address'}
            {step === 'confirm' && 'Confirm Delivery'}
          </DialogTitle>
          <DialogDescription>
            {step === 'select' && 'Choose a parcel to request delivery for'}
            {step === 'address' && 'Enter your delivery address'}
            {step === 'confirm' && 'Review and confirm your delivery request'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {step === 'select' && (
          <div className="space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : parcels.length === 0 ? (
              <p className="py-4 text-center text-muted-foreground">
                No parcels available for delivery. Parcels must be in &quot;Stored&quot; status.
              </p>
            ) : (
              parcels.map((parcel) => (
                <button
                  key={parcel.id}
                  onClick={() => handleSelectParcel(parcel)}
                  className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
                >
                  <p className="font-mono font-medium">{parcel.trackingNumber}</p>
                  <p className="text-sm text-muted-foreground">
                    {parcel.weight}kg
                    {parcel.description && ` - ${parcel.description}`}
                  </p>
                </button>
              ))
            )}
          </div>
        )}

        {step === 'address' && (
          <form onSubmit={handleSubmit(handleAddressSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="street">Street Address</Label>
              <Input id="street" {...register('street')} />
              {errors.street && (
                <p className="text-sm text-destructive">{errors.street.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" {...register('city')} />
                {errors.city && (
                  <p className="text-sm text-destructive">{errors.city.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="province">Province/State</Label>
                <Input id="province" {...register('province')} />
                {errors.province && (
                  <p className="text-sm text-destructive">{errors.province.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="zipCode">Zip/Postal Code</Label>
              <Input id="zipCode" {...register('zipCode')} />
              {errors.zipCode && (
                <p className="text-sm text-destructive">{errors.zipCode.message}</p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStep('select')}>
                Back
              </Button>
              <Button type="submit">Continue</Button>
            </DialogFooter>
          </form>
        )}

        {step === 'confirm' && selectedParcel && (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm font-medium">Parcel</p>
              <p className="font-mono">{selectedParcel.trackingNumber}</p>
              <p className="text-sm text-muted-foreground">{selectedParcel.weight}kg</p>
            </div>

            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm font-medium">Delivery Address</p>
              <p className="text-sm">
                {getValues('street')}
                <br />
                {getValues('city')}, {getValues('province')} {getValues('zipCode')}
              </p>
            </div>

            {feeEstimate && (
              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium">Estimated Fee</p>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Base Fee</span>
                    <span>₱{feeEstimate.baseFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Weight Fee</span>
                    <span>₱{feeEstimate.weightFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1 font-medium">
                    <span>Total</span>
                    <span>₱{feeEstimate.totalFee.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStep('address')}>
                Back
              </Button>
              <Button onClick={handleConfirm} disabled={isSubmitting}>
                {isSubmitting ? 'Requesting...' : 'Confirm Request'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
