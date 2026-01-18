'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, AlertTriangle, FileText, Package, ArrowRight } from 'lucide-react';
import { ExceptionStatus } from '@warehouse/shared';
import * as usersApi from '@/lib/api/users';
import * as exceptionsApi from '@/lib/api/exceptions';
import * as parcelsApi from '@/lib/api/parcels';
import * as auditApi from '@/lib/api/audit';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, Button } from '@/components/ui';
import type { AuditLog } from '@warehouse/shared';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalParcels: 0,
    openExceptions: 0,
    recentAuditCount: 0,
  });
  const [recentAudit, setRecentAudit] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [usersRes, parcelsRes, exceptionsRes, auditRes] = await Promise.all([
          usersApi.getAllUsers({ limit: 1 }),
          parcelsApi.getAllParcels({ limit: 1 }),
          exceptionsApi.getOpenExceptions({}),
          auditApi.queryAuditLogs({ limit: 5 }),
        ]);

        let totalUsers = 0;
        if (usersRes.success && usersRes.data) {
          totalUsers = usersRes.data.meta.total;
        }

        let totalParcels = 0;
        if (parcelsRes.success && parcelsRes.data) {
          totalParcels = parcelsRes.data.meta.total;
        }

        let openExceptions = 0;
        if (exceptionsRes.success && exceptionsRes.data) {
          openExceptions = exceptionsRes.data.meta.total;
        }

        let recentAuditCount = 0;
        if (auditRes.success && auditRes.data) {
          recentAuditCount = auditRes.data.meta.total;
          setRecentAudit(auditRes.data.data);
        }

        setStats({ totalUsers, totalParcels, openExceptions, recentAuditCount });
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
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          System overview and management
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              Registered accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Parcels</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalParcels}</div>
            <p className="text-xs text-muted-foreground">
              In the system
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Audit Logs</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recentAuditCount}</div>
            <p className="text-xs text-muted-foreground">
              Total audit entries
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Management
            </CardTitle>
            <CardDescription>
              Manage user accounts and permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/admin/users">
                Manage Users <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Exception Queue
            </CardTitle>
            <CardDescription>
              Review and resolve parcel exceptions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/admin/exceptions">
                View Exceptions <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Audit Logs
            </CardTitle>
            <CardDescription>
              View system activity and changes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/admin/audit">
                View Logs <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest audit log entries</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/audit">
              View all <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentAudit.length === 0 ? (
            <p className="py-4 text-center text-muted-foreground">
              No recent activity
            </p>
          ) : (
            <div className="space-y-4">
              {recentAudit.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{log.action}</p>
                    <p className="text-sm text-muted-foreground">
                      {log.entityType} - {log.entityId.slice(0, 8)}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
