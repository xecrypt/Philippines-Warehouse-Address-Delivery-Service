'use client';

import { useEffect, useState, useCallback } from 'react';
import { FileText, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import * as auditApi from '@/lib/api/audit';
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
import type { AuditLog } from '@warehouse/shared';

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    entityType: '',
    action: '',
    actorId: '',
  });
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: any = { page, limit: 20 };
      if (filters.entityType) params.entityType = filters.entityType;
      if (filters.action) params.action = filters.action;
      if (filters.actorId) params.actorId = filters.actorId;

      const response = await auditApi.queryAuditLogs(params);
      if (response.success && response.data) {
        setLogs(response.data.data);
        setTotalPages(response.data.meta.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const getActionBadgeVariant = (action: string) => {
    if (action.includes('CREATE') || action.includes('INTAKE')) return 'success';
    if (action.includes('UPDATE') || action.includes('CHANGE')) return 'info';
    if (action.includes('DELETE') || action.includes('DEACTIVATE')) return 'destructive';
    return 'secondary';
  };

  const formatData = (data: any) => {
    if (!data) return null;
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold lg:text-2xl">Audit Logs</h1>
        <p className="text-sm text-muted-foreground lg:text-base">
          View system activity and changes
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <Input
              placeholder="Entity Type"
              className="w-[150px]"
              value={filters.entityType}
              onChange={(e) => handleFilterChange('entityType', e.target.value)}
            />
            <Input
              placeholder="Action"
              className="w-[150px]"
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
            />
            <Input
              placeholder="Actor ID"
              className="w-[200px]"
              value={filters.actorId}
              onChange={(e) => handleFilterChange('actorId', e.target.value)}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFilters({ entityType: '', action: '', actorId: '' });
                setPage(1);
              }}
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Audit Logs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : logs.length === 0 ? (
            <div className="py-8 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">No audit logs found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Actor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <>
                      <TableRow
                        key={log.id}
                        className="cursor-pointer"
                        onClick={() =>
                          setExpandedLog(expandedLog === log.id ? null : log.id)
                        }
                      >
                        <TableCell>
                          {expandedLog === log.id ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(log.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getActionBadgeVariant(log.action)}>
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium">{log.entityType}</p>
                            <p className="font-mono text-xs text-muted-foreground">
                              {log.entityId.slice(0, 8)}...
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {log.actor ? (
                            <div>
                              <p className="text-sm">
                                {log.actor.firstName} {log.actor.lastName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {log.actor.email}
                              </p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">System</span>
                          )}
                        </TableCell>
                      </TableRow>
                      {expandedLog === log.id && (
                        <TableRow>
                          <TableCell colSpan={5} className="bg-muted/50 p-4">
                            <div className="grid gap-4 md:grid-cols-2">
                              {log.previousData && (
                                <div>
                                  <p className="mb-2 text-sm font-medium">Previous Data</p>
                                  <pre className="max-h-[200px] overflow-auto rounded-lg bg-background p-3 text-xs">
                                    {formatData(log.previousData)}
                                  </pre>
                                </div>
                              )}
                              {log.newData && (
                                <div>
                                  <p className="mb-2 text-sm font-medium">New Data</p>
                                  <pre className="max-h-[200px] overflow-auto rounded-lg bg-background p-3 text-xs">
                                    {formatData(log.newData)}
                                  </pre>
                                </div>
                              )}
                              {!log.previousData && !log.newData && (
                                <p className="text-sm text-muted-foreground">
                                  No additional data recorded
                                </p>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
