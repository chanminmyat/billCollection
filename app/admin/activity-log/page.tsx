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

export default function ActivityLogPage() {
  const { user, isLoading } = useAuth();
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string>('all');

  const refreshLogs = () => {
    setLogs(readActivityLogs());
  };

  useEffect(() => {
    refreshLogs();

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
    return logs.filter((log) => {
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
  }, [logs, moduleFilter, search]);

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
            <p className="text-slate-600">System activities created from admin actions</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={refreshLogs}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!window.confirm('Clear all activity logs?')) return;
                clearActivityLogs();
                refreshLogs();
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Clear Logs
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
