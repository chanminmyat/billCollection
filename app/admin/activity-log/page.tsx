'use client';

import { useEffect, useMemo, useState } from 'react';
import Layout from '@/app/components/layout';
import { useAuth } from '@/app/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Activity, RefreshCw, Search, Trash2 } from 'lucide-react';
import {
  ACTIVITY_LOG_STORAGE_KEY,
  ACTIVITY_LOG_UPDATED_EVENT,
  ActivityLogEntry,
  clearActivityLogs,
  readActivityLogs,
} from '@/lib/activity-log';
import { formatDisplayDate } from '@/lib/date-format';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

export default function ActivityLogPage() {
  const { user, isLoading } = useAuth();
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [statusHistoryLogs, setStatusHistoryLogs] = useState<ActivityLogEntry[]>([]);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string>('all');

  const refreshLogs = () => {
    setLogs(readActivityLogs());
  };

  const refreshStatusHistory = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/system-settings/status-history`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return;
      const entries = await response.json().catch(() => []);
      if (!Array.isArray(entries)) return;
      setStatusHistoryLogs(entries.map((entry: any) => ({
        id: `status-${String(entry.id ?? '')}`,
        timestamp: String(entry.changedAt ?? ''),
        module: entry.entityType === 'collector' ? 'collector' : 'customer',
        action: `${entry.entityType}_status_changed`,
        description: `Status changed from ${entry.previousStatus} to ${entry.status}. Reason: ${entry.reason}`,
        actorName: String(entry.actorName ?? 'System'),
        actorRole: entry.source === 'automatic' ? 'system' : 'admin',
        targetType: entry.entityType,
        targetId: String(entry.entityId ?? ''),
        targetName: String(entry.entityName ?? entry.entityCode ?? ''),
        metadata: {
          previousStatus: entry.previousStatus,
          status: entry.status,
          reason: entry.reason,
          source: entry.source,
        },
      })));
    } catch {
      // Local activity entries remain available if status history cannot be reached.
    }
  };

  useEffect(() => {
    refreshLogs();
    void refreshStatusHistory();

    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === ACTIVITY_LOG_STORAGE_KEY) {
        refreshLogs();
      }
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener(ACTIVITY_LOG_UPDATED_EVENT, refreshLogs);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(ACTIVITY_LOG_UPDATED_EVENT, refreshLogs);
    };
  }, []);

  const filteredLogs = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return [...logs, ...statusHistoryLogs]
      .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
      .filter((log) => {
      const moduleMatches = moduleFilter === 'all' || log.module === moduleFilter;
      if (!moduleMatches) return false;
      if (!keyword) return true;
      return (
        log.action.toLowerCase().includes(keyword) ||
        log.module.toLowerCase().includes(keyword) ||
        log.description.toLowerCase().includes(keyword) ||
        (log.actorName || '').toLowerCase().includes(keyword) ||
        (log.targetName || '').toLowerCase().includes(keyword) ||
        (log.targetId || '').toLowerCase().includes(keyword)
      );
      });
  }, [logs, moduleFilter, search, statusHistoryLogs]);

  if (isLoading) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  if (!user || user.role !== 'admin') {
    return <div>Access denied</div>;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Activity Log</h1>
                <p className="text-slate-600">Admin activity and saved customer/collector status history</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                refreshLogs();
                void refreshStatusHistory();
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!window.confirm('Clear local activity logs? Saved status history will be kept.')) return;
                clearActivityLogs();
                refreshLogs();
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Clear Local Logs
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search action, actor, target, description"
                  className="pl-10"
                />
              </div>
              <Select value={moduleFilter} onValueChange={setModuleFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="All modules" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modules</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="collector">Collector</SelectItem>
                  <SelectItem value="billing">Billing</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Logs ({filteredLogs.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredLogs.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">
                <Activity className="mx-auto mb-2 h-5 w-5 text-slate-400" />
                No activity logs yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Module</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{formatDisplayDate(log.timestamp)}</TableCell>
                        <TableCell className="capitalize">{log.module}</TableCell>
                        <TableCell>{log.action}</TableCell>
                        <TableCell>
                          <div className="font-medium">{log.actorName || 'System'}</div>
                          <div className="text-xs text-slate-500 capitalize">{log.actorRole || 'system'}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{log.targetName || '-'}</div>
                          <div className="text-xs text-slate-500">{log.targetId || '-'}</div>
                        </TableCell>
                        <TableCell>{log.description}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
