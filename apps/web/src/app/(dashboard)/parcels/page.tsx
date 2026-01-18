'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Package, Filter } from 'lucide-react';
import { ParcelState, PARCEL_STATE_LABELS } from '@warehouse/shared';
import * as parcelsApi from '@/lib/api/parcels';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@/components/ui';
import type { ParcelWithOwner } from '@warehouse/shared';

export default function ParcelsPage() {
  const [parcels, setParcels] = useState<ParcelWithOwner[]>([]);
  const [selectedState, setSelectedState] = useState<ParcelState | 'ALL'>('ALL');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchParcels() {
      setIsLoading(true);
      try {
        const params = selectedState !== 'ALL' ? { state: selectedState } : {};
        const response = await parcelsApi.getMyParcels(params);
        if (response.success && response.data) {
          setParcels(response.data.data);
        }
      } catch (error) {
        console.error('Failed to fetch parcels:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchParcels();
  }, [selectedState]);

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

  const stateOptions = [
    { value: 'ALL', label: 'All States' },
    ...Object.values(ParcelState).map((state) => ({
      value: state,
      label: PARCEL_STATE_LABELS[state],
    })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Parcels</h1>
          <p className="text-muted-foreground">
            Track and manage all your parcels
          </p>
        </div>
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="flex items-center gap-4 py-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filter by state:</span>
          <div className="flex flex-wrap gap-2">
            {stateOptions.map((option) => (
              <Button
                key={option.value}
                variant={selectedState === option.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedState(option.value as ParcelState | 'ALL')}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Parcels List */}
      <Card>
        <CardHeader>
          <CardTitle>Parcels ({parcels.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : parcels.length === 0 ? (
            <div className="py-8 text-center">
              <Package className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">
                {selectedState === 'ALL'
                  ? 'No parcels yet. Your parcels will appear here.'
                  : `No parcels with status "${PARCEL_STATE_LABELS[selectedState as ParcelState]}"`}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {parcels.map((parcel) => (
                <Link
                  key={parcel.id}
                  href={`/parcels/${parcel.id}`}
                  className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-4">
                    <Package className="h-10 w-10 text-muted-foreground" />
                    <div>
                      <p className="font-medium font-mono">{parcel.trackingNumber}</p>
                      <p className="text-sm text-muted-foreground">
                        Weight: {parcel.weight}kg
                        {parcel.description && ` | ${parcel.description}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Received: {new Date(parcel.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Badge variant={getStateBadgeVariant(parcel.state)}>
                    {PARCEL_STATE_LABELS[parcel.state]}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
