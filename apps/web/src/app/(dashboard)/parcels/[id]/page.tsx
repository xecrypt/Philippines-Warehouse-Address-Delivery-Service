'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Package, Truck } from 'lucide-react';
import { ParcelState, PARCEL_STATE_LABELS } from '@warehouse/shared';
import * as parcelsApi from '@/lib/api/parcels';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, Button, Badge } from '@/components/ui';
import { ParcelStateTimeline } from '@/components/parcels/state-timeline';
import type { ParcelWithOwner, ParcelStateHistory } from '@warehouse/shared';

export default function ParcelDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [parcel, setParcel] = useState<ParcelWithOwner | null>(null);
  const [history, setHistory] = useState<ParcelStateHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchParcel() {
      try {
        const [parcelRes, historyRes] = await Promise.all([
          parcelsApi.getParcelById(params.id as string),
          parcelsApi.getParcelHistory(params.id as string),
        ]);

        if (parcelRes.success && parcelRes.data) {
          setParcel(parcelRes.data);
        } else {
          setError('Parcel not found');
        }

        if (historyRes.success && historyRes.data) {
          setHistory(historyRes.data);
        }
      } catch (err) {
        setError('Failed to load parcel');
      } finally {
        setIsLoading(false);
      }
    }

    fetchParcel();
  }, [params.id]);

  const getStateBadgeVariant = (state: ParcelState) => {
    switch (state) {
      case ParcelState.EXPECTED:
        return 'gray';
      case ParcelState.ARRIVED:
        return 'warning';
      case ParcelState.STORED:
        return 'info';
      case ParcelState.DELIVERY_REQUESTED:
        return 'purple';
      case ParcelState.OUT_FOR_DELIVERY:
        return 'orange';
      case ParcelState.DELIVERED:
        return 'success';
      default:
        return 'secondary';
    }
  };

  const canRequestDelivery = parcel?.state === ParcelState.STORED;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !parcel) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link href="/parcels">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to parcels
          </Link>
        </Button>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">{error || 'Parcel not found'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/parcels">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Parcel Details</h1>
          <p className="font-mono text-muted-foreground">{parcel.trackingNumber}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Info */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Parcel Information
                </CardTitle>
                <Badge variant={getStateBadgeVariant(parcel.state)}>
                  {PARCEL_STATE_LABELS[parcel.state]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Tracking Number</p>
                  <p className="font-mono">{parcel.trackingNumber}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Weight</p>
                  <p>{parcel.weight} kg</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Received At</p>
                  <p>{new Date(parcel.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                  <p>{new Date(parcel.updatedAt).toLocaleString()}</p>
                </div>
              </div>
              {parcel.description && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Description</p>
                  <p>{parcel.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* State Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>State Timeline</CardTitle>
              <CardDescription>Track your parcel&apos;s journey</CardDescription>
            </CardHeader>
            <CardContent>
              <ParcelStateTimeline currentState={parcel.state} history={history} />
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {canRequestDelivery ? (
                <Button className="w-full" asChild>
                  <Link href={`/deliveries?request=${parcel.id}`}>
                    <Truck className="mr-2 h-4 w-4" />
                    Request Delivery
                  </Link>
                </Button>
              ) : (
                <div className="rounded-lg bg-muted p-4 text-center text-sm text-muted-foreground">
                  {parcel.state === ParcelState.DELIVERED
                    ? 'This parcel has been delivered.'
                    : parcel.state === ParcelState.DELIVERY_REQUESTED ||
                      parcel.state === ParcelState.OUT_FOR_DELIVERY
                    ? 'Delivery is already in progress.'
                    : 'Parcel must be stored before requesting delivery.'}
                </div>
              )}
            </CardContent>
          </Card>

          {/* State History */}
          <Card>
            <CardHeader>
              <CardTitle>State History</CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No history available</p>
              ) : (
                <div className="space-y-3">
                  {history.map((entry, index) => (
                    <div key={index} className="flex items-start gap-3 text-sm">
                      <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
                      <div>
                        <p className="font-medium">
                          {PARCEL_STATE_LABELS[entry.toState as ParcelState]}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(entry.createdAt).toLocaleString()}
                        </p>
                        {entry.notes && (
                          <p className="mt-1 text-muted-foreground">{entry.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
