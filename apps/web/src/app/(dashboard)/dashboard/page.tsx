'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Package, Truck, MapPin, ArrowRight } from 'lucide-react';
import { ParcelState } from '@warehouse/shared';
import { useAuth } from '@/lib/auth';
import * as parcelsApi from '@/lib/api/parcels';
import * as deliveriesApi from '@/lib/api/deliveries';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, Button, Badge } from '@/components/ui';
import type { ParcelWithOwner, Delivery } from '@warehouse/shared';

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    inWarehouse: 0,
    outForDelivery: 0,
    pendingDeliveries: 0,
  });
  const [recentParcels, setRecentParcels] = useState<ParcelWithOwner[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [parcelsRes, deliveriesRes] = await Promise.all([
          parcelsApi.getMyParcels({ limit: 5 }),
          deliveriesApi.getMyDeliveries({ limit: 10 }),
        ]);

        if (parcelsRes.success && parcelsRes.data) {
          const parcels = parcelsRes.data.data;
          setRecentParcels(parcels);

          const inWarehouse = parcels.filter(
            (p) => p.state === ParcelState.STORED || p.state === ParcelState.ARRIVED
          ).length;
          const outForDelivery = parcels.filter(
            (p) => p.state === ParcelState.OUT_FOR_DELIVERY
          ).length;

          setStats((prev) => ({ ...prev, inWarehouse, outForDelivery }));
        }

        if (deliveriesRes.success && deliveriesRes.data) {
          const pendingDeliveries = deliveriesRes.data.data.filter(
            (d: Delivery) => d.paymentStatus === 'PENDING'
          ).length;
          setStats((prev) => ({ ...prev, pendingDeliveries }));
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold lg:text-2xl">Dashboard</h1>
        <p className="text-sm text-muted-foreground lg:text-base">
          Welcome back, {user?.firstName}. Here&apos;s your parcel overview.
        </p>
      </div>

      {/* Warehouse Address Card */}
      {user?.warehouseAddress && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="h-5 w-5 text-primary" />
              Your Warehouse Address
            </CardTitle>
            <CardDescription>
              Use this address when shipping packages
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-muted p-4">
              <p className="font-medium">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-sm text-muted-foreground">
                Member Code: <span className="font-mono font-medium text-foreground">{user.memberCode}</span>
              </p>
              <p className="mt-2 text-sm">
                {user.warehouseAddress.street}
                <br />
                {user.warehouseAddress.city}, {user.warehouseAddress.province} {user.warehouseAddress.zipCode}
                <br />
                {user.warehouseAddress.country}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">In Warehouse</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inWarehouse}</div>
            <p className="text-xs text-muted-foreground">
              Parcels ready for delivery request
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Out for Delivery</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.outForDelivery}</div>
            <p className="text-xs text-muted-foreground">
              Parcels on their way to you
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingDeliveries}</div>
            <p className="text-xs text-muted-foreground">
              Deliveries awaiting payment
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Parcels */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Parcels</CardTitle>
            <CardDescription>Your latest parcel activity</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/parcels">
              View all <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentParcels.length === 0 ? (
            <p className="py-4 text-center text-muted-foreground">
              No parcels yet. Your parcels will appear here once they arrive.
            </p>
          ) : (
            <div className="space-y-4">
              {recentParcels.map((parcel) => (
                <Link
                  key={parcel.id}
                  href={`/parcels/${parcel.id}`}
                  className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-4">
                    <Package className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{parcel.trackingNumber}</p>
                      <p className="text-sm text-muted-foreground">
                        {parcel.weight}kg
                        {parcel.description && ` - ${parcel.description}`}
                      </p>
                    </div>
                  </div>
                  <Badge variant={getStateBadgeVariant(parcel.state)}>
                    {parcel.state.replace(/_/g, ' ')}
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
