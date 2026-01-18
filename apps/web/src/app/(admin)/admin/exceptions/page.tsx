'use client';

import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, Filter, User, Package, Check, X } from 'lucide-react';
import {
  ExceptionStatus,
  ExceptionType,
  EXCEPTION_TYPE_LABELS,
} from '@warehouse/shared';
import * as exceptionsApi from '@/lib/api/exceptions';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  Button,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Input,
  Label,
} from '@/components/ui';
import type { ExceptionWithDetails } from '@warehouse/shared';

export default function AdminExceptionsPage() {
  const [exceptions, setExceptions] = useState<ExceptionWithDetails[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<ExceptionStatus | 'ALL'>('ALL');
  const [selectedType, setSelectedType] = useState<ExceptionType | 'ALL'>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [resolveException, setResolveException] = useState<ExceptionWithDetails | null>(null);
  const [resolution, setResolution] = useState('');

  const fetchExceptions = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: any = { limit: 100 };
      if (selectedStatus !== 'ALL') params.status = selectedStatus;
      if (selectedType !== 'ALL') params.type = selectedType;

      const response =
        selectedStatus === 'ALL' || selectedStatus === ExceptionStatus.OPEN
          ? await exceptionsApi.getOpenExceptions(params)
          : await exceptionsApi.getAllExceptions(params);

      if (response.success && response.data) {
        setExceptions(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch exceptions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedStatus, selectedType]);

  useEffect(() => {
    fetchExceptions();
  }, [fetchExceptions]);

  const handleAssign = async (exceptionId: string) => {
    setActionLoading(exceptionId);
    try {
      const response = await exceptionsApi.assignException(exceptionId);
      if (response.success) {
        fetchExceptions();
      }
    } catch (error) {
      console.error('Failed to assign exception:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolve = async () => {
    if (!resolveException || !resolution) return;

    setActionLoading(resolveException.id);
    try {
      const response = await exceptionsApi.resolveException(resolveException.id, resolution);
      if (response.success) {
        setResolveException(null);
        setResolution('');
        fetchExceptions();
      }
    } catch (error) {
      console.error('Failed to resolve exception:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (exceptionId: string) => {
    if (!confirm('Are you sure you want to cancel this exception?')) return;

    setActionLoading(exceptionId);
    try {
      const response = await exceptionsApi.cancelException(exceptionId);
      if (response.success) {
        fetchExceptions();
      }
    } catch (error) {
      console.error('Failed to cancel exception:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadgeVariant = (status: ExceptionStatus) => {
    switch (status) {
      case ExceptionStatus.OPEN:
        return 'warning';
      case ExceptionStatus.IN_PROGRESS:
        return 'info';
      case ExceptionStatus.RESOLVED:
        return 'success';
      case ExceptionStatus.CANCELLED:
        return 'gray';
      default:
        return 'secondary';
    }
  };

  const statusOptions = [
    { value: 'ALL', label: 'All Statuses' },
    { value: ExceptionStatus.OPEN, label: 'Open' },
    { value: ExceptionStatus.IN_PROGRESS, label: 'In Progress' },
    { value: ExceptionStatus.RESOLVED, label: 'Resolved' },
    { value: ExceptionStatus.CANCELLED, label: 'Cancelled' },
  ];

  const typeOptions = [
    { value: 'ALL', label: 'All Types' },
    ...Object.values(ExceptionType).map((type) => ({
      value: type,
      label: EXCEPTION_TYPE_LABELS[type],
    })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Exception Queue</h1>
        <p className="text-muted-foreground">
          Review and resolve parcel exceptions
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Status:</span>
              <div className="flex flex-wrap gap-1">
                {statusOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant={selectedStatus === option.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedStatus(option.value as ExceptionStatus | 'ALL')}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Type:</span>
              <div className="flex flex-wrap gap-1">
                {typeOptions.slice(0, 4).map((option) => (
                  <Button
                    key={option.value}
                    variant={selectedType === option.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedType(option.value as ExceptionType | 'ALL')}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Exceptions List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Exceptions ({exceptions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : exceptions.length === 0 ? (
            <div className="py-8 text-center">
              <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">No exceptions found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {exceptions.map((exception) => (
                <div
                  key={exception.id}
                  className="rounded-lg border p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <AlertTriangle className="mt-1 h-8 w-8 text-yellow-500" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {EXCEPTION_TYPE_LABELS[exception.type]}
                          </p>
                          <Badge variant={getStatusBadgeVariant(exception.status)}>
                            {exception.status}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {exception.description}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Created: {new Date(exception.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {/* Parcel Info */}
                    {exception.parcel && (
                      <div className="rounded-lg bg-muted/50 p-3">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Package className="h-4 w-4" />
                          Parcel
                        </div>
                        <p className="mt-1 font-mono text-sm">
                          {exception.parcel.trackingNumber}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {exception.parcel.weight}kg
                        </p>
                      </div>
                    )}

                    {/* Assignee Info */}
                    {exception.assignee && (
                      <div className="rounded-lg bg-muted/50 p-3">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <User className="h-4 w-4" />
                          Assigned To
                        </div>
                        <p className="mt-1 text-sm">
                          {exception.assignee.firstName} {exception.assignee.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {exception.assignee.email}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Resolution */}
                  {exception.resolution && (
                    <div className="mt-4 rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
                      <p className="text-sm font-medium text-green-800 dark:text-green-200">
                        Resolution
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        {exception.resolution}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  {(exception.status === ExceptionStatus.OPEN ||
                    exception.status === ExceptionStatus.IN_PROGRESS) && (
                    <div className="mt-4 flex justify-end gap-2">
                      {exception.status === ExceptionStatus.OPEN && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actionLoading === exception.id}
                          onClick={() => handleAssign(exception.id)}
                        >
                          Assign to me
                        </Button>
                      )}
                      {exception.status === ExceptionStatus.IN_PROGRESS && (
                        <Button
                          size="sm"
                          disabled={actionLoading === exception.id}
                          onClick={() => setResolveException(exception)}
                        >
                          <Check className="mr-2 h-4 w-4" />
                          Resolve
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={actionLoading === exception.id}
                        onClick={() => handleCancel(exception.id)}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resolve Dialog */}
      <Dialog open={!!resolveException} onOpenChange={(open) => !open && setResolveException(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Exception</DialogTitle>
            <DialogDescription>
              Provide a resolution for this exception
            </DialogDescription>
          </DialogHeader>

          {resolveException && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-3">
                <p className="text-sm font-medium">
                  {EXCEPTION_TYPE_LABELS[resolveException.type]}
                </p>
                <p className="text-sm text-muted-foreground">
                  {resolveException.description}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="resolution">Resolution</Label>
                <Input
                  id="resolution"
                  placeholder="Describe how the issue was resolved..."
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setResolveException(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleResolve}
                  disabled={!resolution || actionLoading === resolveException.id}
                >
                  {actionLoading === resolveException.id ? 'Resolving...' : 'Resolve'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
