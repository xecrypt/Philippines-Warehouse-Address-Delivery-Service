'use client';

import { useEffect, useState, useCallback } from 'react';
import { Search, Filter, Package, AlertTriangle } from 'lucide-react';
import {
  ParcelState,
  PARCEL_STATE_LABELS,
  PARCEL_STATE_TRANSITIONS,
  PaymentStatus,
} from '@warehouse/shared';
import * as parcelsApi from '@/lib/api/parcels';
import * as deliveriesApi from '@/lib/api/deliveries';
import * as exceptionsApi from '@/lib/api/exceptions';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui';
import { CreateExceptionDialog } from '@/components/exceptions/create-exception-dialog';
import type { ParcelWithOwner, Delivery } from '@warehouse/shared';

export default function WarehouseParcelsPage() {
  const [parcels, setParcels] = useState<ParcelWithOwner[]>([]);
  const [deliveries, setDeliveries] = useState<Map<string, Delivery>>(new Map());
  const [selectedState, setSelectedState] = useState<ParcelState | 'ALL'>('ALL');
  const [hasException, setHasException] = useState<boolean | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [exceptionParcel, setExceptionParcel] = useState<ParcelWithOwner | null>(null);

  const fetchParcels = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: any = { limit: 100 };
      if (selectedState !== 'ALL') params.state = selectedState;
      if (hasException !== undefined) params.hasException = hasException;

      const response = await parcelsApi.getAllParcels(params);
      if (response.success && response.data) {
        setParcels(response.data.data);

        // Fetch deliveries for parcels with delivery_requested or out_for_delivery state
        const deliveryParcels = response.data.data.filter(
          (p) =>
            p.state === ParcelState.DELIVERY_REQUESTED ||
            p.state === ParcelState.OUT_FOR_DELIVERY
        );

        if (deliveryParcels.length > 0) {
          const deliveriesRes = await deliveriesApi.getAllDeliveries({ limit: 100 });
          if (deliveriesRes.success && deliveriesRes.data) {
            const deliveryMap = new Map<string, Delivery>();
            deliveriesRes.data.data.forEach((d) => {
              deliveryMap.set(d.parcelId, d);
            });
            setDeliveries(deliveryMap);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch parcels:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedState, hasException]);

  useEffect(() => {
    fetchParcels();
  }, [fetchParcels]);

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

  const getValidTransitions = (state: ParcelState): ParcelState[] => {
    const transitions = PARCEL_STATE_TRANSITIONS[state] || [];
    // Filter out transitions that are handled through other workflows
    // DELIVERY_REQUESTED is set when user requests delivery, not by staff
    // OUT_FOR_DELIVERY is set via Dispatch button
    // DELIVERED is set via Complete button
    return transitions.filter(
      (t) =>
        t !== ParcelState.DELIVERY_REQUESTED &&
        t !== ParcelState.OUT_FOR_DELIVERY &&
        t !== ParcelState.DELIVERED
    );
  };

  const handleStateUpdate = async (parcelId: string, newState: ParcelState) => {
    setActionLoading(parcelId);
    try {
      const response = await parcelsApi.updateParcelState(parcelId, { newState });
      if (response.success) {
        fetchParcels();
      }
    } catch (error) {
      console.error('Failed to update state:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmPayment = async (deliveryId: string) => {
    setActionLoading(deliveryId);
    try {
      const response = await deliveriesApi.confirmPayment(deliveryId);
      if (response.success) {
        fetchParcels();
      }
    } catch (error) {
      console.error('Failed to confirm payment:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDispatch = async (deliveryId: string) => {
    setActionLoading(deliveryId);
    try {
      const response = await deliveriesApi.dispatchDelivery(deliveryId);
      if (response.success) {
        fetchParcels();
      }
    } catch (error) {
      console.error('Failed to dispatch:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleComplete = async (deliveryId: string) => {
    setActionLoading(deliveryId);
    try {
      const response = await deliveriesApi.completeDelivery(deliveryId);
      if (response.success) {
        fetchParcels();
      }
    } catch (error) {
      console.error('Failed to complete:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredParcels = parcels.filter((parcel) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      parcel.trackingNumber.toLowerCase().includes(query) ||
      parcel.owner?.memberCode?.toLowerCase().includes(query) ||
      parcel.owner?.email?.toLowerCase().includes(query)
    );
  });

  const stateOptions = [
    { value: 'ALL', label: 'All States' },
    ...Object.values(ParcelState).map((state) => ({
      value: state,
      label: PARCEL_STATE_LABELS[state],
    })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold lg:text-2xl">Parcel Management</h1>
        <p className="text-sm text-muted-foreground lg:text-base">
          View and manage all parcels in the warehouse
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by tracking # or member code..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">State:</span>
              <div className="flex flex-wrap gap-1">
                {stateOptions.slice(0, 4).map((option) => (
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
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={hasException === true ? 'default' : 'outline'}
                size="sm"
                onClick={() => setHasException(hasException === true ? undefined : true)}
              >
                <AlertTriangle className="mr-1 h-3 w-3" />
                Has Exception
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Parcels Table */}
      <Card>
        <CardHeader>
          <CardTitle>Parcels ({filteredParcels.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filteredParcels.length === 0 ? (
            <div className="py-8 text-center">
              <Package className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">No parcels found</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Tracking #</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Weight</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredParcels.map((parcel) => {
                  const delivery = deliveries.get(parcel.id);
                  const validTransitions = getValidTransitions(parcel.state);

                  return (
                    <TableRow key={parcel.id}>
                      <TableCell className="font-mono">{parcel.trackingNumber}</TableCell>
                      <TableCell>
                        {parcel.owner ? (
                          <div>
                            <p className="text-sm font-medium">
                              {parcel.owner.firstName} {parcel.owner.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {parcel.owner.memberCode}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Unknown</span>
                        )}
                      </TableCell>
                      <TableCell>{parcel.weight}kg</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant={getStateBadgeVariant(parcel.state)}>
                            {PARCEL_STATE_LABELS[parcel.state]}
                          </Badge>
                          {parcel.hasException && (
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {delivery ? (
                          <Badge
                            variant={
                              delivery.paymentStatus === PaymentStatus.CONFIRMED
                                ? 'success'
                                : delivery.paymentStatus === PaymentStatus.PENDING
                                ? 'warning'
                                : 'destructive'
                            }
                          >
                            {delivery.paymentStatus}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {/* State transition buttons */}
                          {validTransitions.map((nextState) => (
                            <Button
                              key={nextState}
                              size="sm"
                              variant="outline"
                              disabled={actionLoading === parcel.id}
                              onClick={() => handleStateUpdate(parcel.id, nextState)}
                            >
                              {PARCEL_STATE_LABELS[nextState]}
                            </Button>
                          ))}

                          {/* Delivery actions */}
                          {delivery && parcel.state === ParcelState.DELIVERY_REQUESTED && (
                            <>
                              {delivery.paymentStatus === PaymentStatus.PENDING && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={actionLoading === delivery.id}
                                  onClick={() => handleConfirmPayment(delivery.id)}
                                >
                                  Confirm Payment
                                </Button>
                              )}
                              {delivery.paymentStatus === PaymentStatus.CONFIRMED && (
                                <Button
                                  size="sm"
                                  disabled={actionLoading === delivery.id}
                                  onClick={() => handleDispatch(delivery.id)}
                                >
                                  Dispatch
                                </Button>
                              )}
                            </>
                          )}

                          {delivery && parcel.state === ParcelState.OUT_FOR_DELIVERY && (
                            <Button
                              size="sm"
                              disabled={actionLoading === delivery.id}
                              onClick={() => handleComplete(delivery.id)}
                            >
                              Complete
                            </Button>
                          )}

                          {/* Create exception */}
                          {!parcel.hasException && parcel.state !== ParcelState.DELIVERED && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setExceptionParcel(parcel)}
                            >
                              <AlertTriangle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateExceptionDialog
        open={!!exceptionParcel}
        onOpenChange={(open) => !open && setExceptionParcel(null)}
        parcel={exceptionParcel}
        onSuccess={() => {
          setExceptionParcel(null);
          fetchParcels();
        }}
      />
    </div>
  );
}
