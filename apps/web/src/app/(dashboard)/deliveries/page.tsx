'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Truck, Package, MapPin } from 'lucide-react';
import { PaymentStatus } from '@warehouse/shared';
import * as deliveriesApi from '@/lib/api/deliveries';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, Button, Badge } from '@/components/ui';
import { RequestDeliveryDialog } from '@/components/deliveries/request-delivery-dialog';
import type { Delivery } from '@warehouse/shared';

export default function DeliveriesPage() {
  const searchParams = useSearchParams();
  const requestParcelId = searchParams.get('request');
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showRequestDialog, setShowRequestDialog] = useState(false);

  useEffect(() => {
    fetchDeliveries();
  }, []);

  useEffect(() => {
    if (requestParcelId) {
      setShowRequestDialog(true);
    }
  }, [requestParcelId]);

  async function fetchDeliveries() {
    setIsLoading(true);
    try {
      const response = await deliveriesApi.getMyDeliveries({});
      if (response.success && response.data) {
        setDeliveries(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch deliveries:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const getPaymentBadgeVariant = (status: PaymentStatus) => {
    switch (status) {
      case PaymentStatus.PENDING:
        return 'warning';
      case PaymentStatus.CONFIRMED:
        return 'success';
      case PaymentStatus.FAILED:
        return 'destructive';
      case PaymentStatus.REFUNDED:
        return 'gray';
      default:
        return 'secondary';
    }
  };

  const handleDeliveryRequested = () => {
    setShowRequestDialog(false);
    fetchDeliveries();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Deliveries</h1>
          <p className="text-muted-foreground">
            Track and manage your delivery requests
          </p>
        </div>
        <Button onClick={() => setShowRequestDialog(true)}>
          <Truck className="mr-2 h-4 w-4" />
          Request Delivery
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Delivery History</CardTitle>
          <CardDescription>All your delivery requests</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : deliveries.length === 0 ? (
            <div className="py-8 text-center">
              <Truck className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">
                No deliveries yet. Request a delivery for your stored parcels.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {deliveries.map((delivery) => (
                <div
                  key={delivery.id}
                  className="rounded-lg border p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <Package className="mt-1 h-8 w-8 text-muted-foreground" />
                      <div>
                        <p className="font-medium">
                          Delivery #{delivery.id.slice(0, 8)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Requested: {new Date(delivery.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Badge variant={getPaymentBadgeVariant(delivery.paymentStatus)}>
                      {delivery.paymentStatus}
                    </Badge>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-lg bg-muted/50 p-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <MapPin className="h-4 w-4" />
                        Delivery Address
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {delivery.deliveryAddress.street}
                        <br />
                        {delivery.deliveryAddress.city}, {delivery.deliveryAddress.province}{' '}
                        {delivery.deliveryAddress.zipCode}
                      </p>
                    </div>

                    <div className="rounded-lg bg-muted/50 p-3">
                      <div className="text-sm font-medium">Fee Breakdown</div>
                      <div className="mt-1 space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Base Fee</span>
                          <span>${delivery.feeBreakdown.baseFee.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Weight Fee</span>
                          <span>${delivery.feeBreakdown.weightFee.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between border-t pt-1 font-medium">
                          <span>Total</span>
                          <span>${delivery.totalFee.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <RequestDeliveryDialog
        open={showRequestDialog}
        onOpenChange={setShowRequestDialog}
        preselectedParcelId={requestParcelId}
        onSuccess={handleDeliveryRequested}
      />
    </div>
  );
}
