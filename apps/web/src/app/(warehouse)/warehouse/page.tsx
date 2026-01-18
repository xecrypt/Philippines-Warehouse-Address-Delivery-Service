'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Package, PackagePlus, AlertTriangle, Truck, ArrowRight } from 'lucide-react';
import { ParcelState, ExceptionStatus } from '@warehouse/shared';
import * as parcelsApi from '@/lib/api/parcels';
import * as exceptionsApi from '@/lib/api/exceptions';
import * as deliveriesApi from '@/lib/api/deliveries';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, Button } from '@/components/ui';

export default function WarehouseDashboardPage() {
  const [stats, setStats] = useState({
    arrivedParcels: 0,
    storedParcels: 0,
    pendingDeliveries: 0,
    openExceptions: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [parcelsRes, exceptionsRes, deliveriesRes] = await Promise.all([
          parcelsApi.getAllParcels({ limit: 100 }),
          exceptionsApi.getOpenExceptions({}),
          deliveriesApi.getAllDeliveries({ limit: 100 }),
        ]);

        let arrivedParcels = 0;
        let storedParcels = 0;

        if (parcelsRes.success && parcelsRes.data) {
          const parcels = parcelsRes.data.data;
          arrivedParcels = parcels.filter((p) => p.state === ParcelState.ARRIVED).length;
          storedParcels = parcels.filter((p) => p.state === ParcelState.STORED).length;
        }

        let openExceptions = 0;
        if (exceptionsRes.success && exceptionsRes.data) {
          openExceptions = exceptionsRes.data.data.length;
        }

        let pendingDeliveries = 0;
        if (deliveriesRes.success && deliveriesRes.data) {
          pendingDeliveries = deliveriesRes.data.data.filter(
            (d) => d.paymentStatus === 'CONFIRMED' && !d.dispatchedAt
          ).length;
        }

        setStats({ arrivedParcels, storedParcels, pendingDeliveries, openExceptions });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();
  }, []);

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
        <h1 className="text-2xl font-bold">Warehouse Dashboard</h1>
        <p className="text-muted-foreground">
          Manage parcels, deliveries, and exceptions
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Arrived Parcels</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.arrivedParcels}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting processing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Stored Parcels</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.storedParcels}</div>
            <p className="text-xs text-muted-foreground">
              Ready for delivery
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Dispatch</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingDeliveries}</div>
            <p className="text-xs text-muted-foreground">
              Payment confirmed, ready to dispatch
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Open Exceptions</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.openExceptions}</div>
            <p className="text-xs text-muted-foreground">
              Requiring attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackagePlus className="h-5 w-5" />
              Parcel Intake
            </CardTitle>
            <CardDescription>
              Register new parcels arriving at the warehouse
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/warehouse/intake">
                Go to Intake <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Parcel Management
            </CardTitle>
            <CardDescription>
              View and manage all parcels in the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/warehouse/parcels">
                Manage Parcels <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
