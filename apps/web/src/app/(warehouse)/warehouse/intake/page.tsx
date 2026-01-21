'use client';

import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Package, User, Check, X, AlertTriangle } from 'lucide-react';
import * as parcelsApi from '@/lib/api/parcels';
import * as usersApi from '@/lib/api/users';
import { parcelIntakeSchema, type ParcelIntakeFormData } from '@/lib/utils/validation';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  Button,
  Input,
  Label,
} from '@/components/ui';
import type { User as UserType } from '@warehouse/shared';

export default function ParcelIntakePage() {
  const [memberLookup, setMemberLookup] = useState<{
    status: 'idle' | 'loading' | 'found' | 'not_found';
    user: UserType | null;
  }>({ status: 'idle', user: null });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    type: 'success' | 'error' | 'exception';
    message: string;
  } | null>(null);

  const trackingInputRef = useRef<HTMLInputElement | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<ParcelIntakeFormData>({
    resolver: zodResolver(parcelIntakeSchema),
    defaultValues: {
      weight: 0,
    },
  });

  const memberCode = watch('memberCode');

  // Auto-focus tracking number input on mount
  useEffect(() => {
    trackingInputRef.current?.focus();
  }, []);

  // Member code lookup with debounce
  useEffect(() => {
    if (!memberCode || memberCode.length < 3) {
      setMemberLookup({ status: 'idle', user: null });
      return;
    }

    const timer = setTimeout(async () => {
      setMemberLookup({ status: 'loading', user: null });
      try {
        const response = await usersApi.findByMemberCode(memberCode);
        if (response.success && response.data?.found && response.data.user) {
          setMemberLookup({ status: 'found', user: response.data.user });
        } else {
          setMemberLookup({ status: 'not_found', user: null });
        }
      } catch {
        setMemberLookup({ status: 'not_found', user: null });
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [memberCode]);

  const onSubmit = async (data: ParcelIntakeFormData) => {
    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      const response = await parcelsApi.intakeParcel({
        trackingNumber: data.trackingNumber,
        memberCode: data.memberCode,
        weight: data.weight,
        description: data.description,
      });

      if (response.success) {
        setSubmitResult({
          type: 'success',
          message: `Parcel ${data.trackingNumber} registered successfully!`,
        });
        reset();
        setMemberLookup({ status: 'idle', user: null });
        trackingInputRef.current?.focus();
      } else {
        // Check if an exception was created
        if (response.message?.includes('exception')) {
          setSubmitResult({
            type: 'exception',
            message: response.message || 'Parcel registered with exception',
          });
        } else {
          setSubmitResult({
            type: 'error',
            message: response.message || 'Failed to register parcel',
          });
        }
      }
    } catch (err) {
      setSubmitResult({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to register parcel',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold lg:text-2xl">Parcel Intake</h1>
        <p className="text-sm text-muted-foreground lg:text-base">
          Register new parcels arriving at the warehouse
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              New Parcel
            </CardTitle>
            <CardDescription>
              Enter the parcel details to register it in the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {submitResult && (
                <div
                  className={`flex items-center gap-2 rounded-md p-3 text-sm ${
                    submitResult.type === 'success'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                      : submitResult.type === 'exception'
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100'
                      : 'bg-destructive/10 text-destructive'
                  }`}
                >
                  {submitResult.type === 'success' ? (
                    <Check className="h-4 w-4" />
                  ) : submitResult.type === 'exception' ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                  {submitResult.message}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="trackingNumber">Tracking Number</Label>
                <Input
                  id="trackingNumber"
                  placeholder="Enter tracking number"
                  {...register('trackingNumber')}
                  ref={(e) => {
                    register('trackingNumber').ref(e);
                    trackingInputRef.current = e;
                  }}
                />
                {errors.trackingNumber && (
                  <p className="text-sm text-destructive">{errors.trackingNumber.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="memberCode">Member Code</Label>
                <div className="relative">
                  <Input
                    id="memberCode"
                    placeholder="e.g., PHW-ABC123"
                    {...register('memberCode')}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {memberLookup.status === 'loading' && (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    )}
                    {memberLookup.status === 'found' && (
                      <Check className="h-4 w-4 text-green-600" />
                    )}
                    {memberLookup.status === 'not_found' && (
                      <X className="h-4 w-4 text-destructive" />
                    )}
                  </div>
                </div>
                {errors.memberCode && (
                  <p className="text-sm text-destructive">{errors.memberCode.message}</p>
                )}
                {memberLookup.status === 'not_found' && (
                  <p className="text-sm text-yellow-600">
                    Member not found. An exception will be created.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="weight">Weight (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="50"
                  placeholder="0.00"
                  {...register('weight', { valueAsNumber: true })}
                />
                {errors.weight && (
                  <p className="text-sm text-destructive">{errors.weight.message}</p>
                )}
                <p className="text-xs text-muted-foreground">Maximum 50kg per parcel</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  placeholder="e.g., Electronics, Clothing"
                  {...register('description')}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Registering...' : 'Register Parcel'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Member Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Member Information
            </CardTitle>
            <CardDescription>
              Owner details for the parcel
            </CardDescription>
          </CardHeader>
          <CardContent>
            {memberLookup.status === 'idle' && (
              <p className="py-8 text-center text-muted-foreground">
                Enter a member code to look up owner details
              </p>
            )}
            {memberLookup.status === 'loading' && (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}
            {memberLookup.status === 'not_found' && (
              <div className="py-8 text-center">
                <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500" />
                <p className="mt-4 font-medium">Member Not Found</p>
                <p className="text-sm text-muted-foreground">
                  The parcel will be registered with an exception for manual review.
                </p>
              </div>
            )}
            {memberLookup.status === 'found' && memberLookup.user && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <User className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {memberLookup.user.firstName} {memberLookup.user.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {memberLookup.user.email}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg bg-muted p-4">
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Member Code</span>
                      <span className="font-mono font-medium">{memberLookup.user.memberCode}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <span className={memberLookup.user.isActive ? 'text-green-600' : 'text-destructive'}>
                        {memberLookup.user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {memberLookup.user.phone && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Phone</span>
                        <span>{memberLookup.user.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
