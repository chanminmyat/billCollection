'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Layout from '@/app/components/layout';
import { useAuth } from '@/app/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VIEW_ONLY_MODULES, ViewOnlyModule, hasViewOnlyAccess } from '@/lib/view-only-access';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
const ENDPOINTS: Partial<Record<ViewOnlyModule, string>> = {
  customers: '/customers', collectors: '/collectors', invoices: '/billing/invoices',
  billing_rules: '/billing/rules', receipts: '/billing/receipts', payment_config: '/billing/payment-accounts',
};

const unwrapRows = (payload: unknown): Record<string, unknown>[] => {
  if (Array.isArray(payload)) return payload.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object');
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as Record<string, unknown>;
  for (const key of ['data', 'items', 'results', 'customers', 'collectors', 'invoices', 'receipts', 'accounts']) {
    if (Array.isArray(record[key])) return unwrapRows(record[key]);
  }
  return [record];
};
const readable = (value: unknown) => {
  if (value == null || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const invoiceFields = [
  { key: 'invoiceNo', label: 'Invoice No.', get: (row: Record<string, unknown>) => row.invoiceNo },
  { key: 'customerName', label: 'Customer', get: (row: Record<string, unknown>) => {
    const customer = row.customer as Record<string, unknown> | null | undefined;
    return customer?.personalName ?? customer?.companyName ?? customer?.name ?? '—';
  } },
  { key: 'customerCode', label: 'Customer Code', get: (row: Record<string, unknown>) => (row.customer as Record<string, unknown> | null | undefined)?.customerCode },
  { key: 'invoiceDate', label: 'Invoice Date', get: (row: Record<string, unknown>) => row.invoiceDate },
  { key: 'billingPeriod', label: 'Billing Period', get: (row: Record<string, unknown>) => [row.billingPeriodFrom, row.billingPeriodTo].filter(Boolean).join(' – ') },
  { key: 'dueDate', label: 'Due Date', get: (row: Record<string, unknown>) => row.dueDate },
  { key: 'invoiceType', label: 'Invoice Type', get: (row: Record<string, unknown>) => row.invoiceType },
  { key: 'planName', label: 'Plan', get: (row: Record<string, unknown>) => (row.customer as Record<string, unknown> | null | undefined)?.planName ?? (row.plan as Record<string, unknown> | null | undefined)?.planName ?? row.planName },
  { key: 'subtotalAmount', label: 'Subtotal (MMK)', get: (row: Record<string, unknown>) => row.subtotalAmount },
  { key: 'totalAmount', label: 'Total (MMK)', get: (row: Record<string, unknown>) => row.totalAmount },
  { key: 'status', label: 'Status', get: (row: Record<string, unknown>) => row.status },
];

export default function ViewOnlyModulePage({ module }: { module: ViewOnlyModule | 'dashboard' }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(module !== 'dashboard');
  const [error, setError] = useState('');
  const selected = VIEW_ONLY_MODULES.find((item) => item.id === module);

  useEffect(() => {
    if (module === 'dashboard' || !selected || !hasViewOnlyAccess(user, module)) return;
    const endpoint = ENDPOINTS[module];
    if (!endpoint) return;
    let active = true;
    setLoading(true); setError('');
    fetch(`${API_BASE_URL}${endpoint}`, { headers: { Accept: 'application/json' } })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(typeof payload?.message === 'string' ? payload.message : 'Unable to load this module.');
        return payload;
      })
      .then((payload) => { if (active) setRows(unwrapRows(payload)); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Unable to load this module.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [module, selected, user]);

  const columns = useMemo(() => {
    if (module === 'invoices') return invoiceFields.filter((field) => rows.some((row) => field.get(row) !== undefined && field.get(row) !== null && field.get(row) !== ''));
    const priority = ['customerCode', 'collectorCode', 'invoiceNo', 'receiptNo', 'name', 'personalName', 'companyName', 'email', 'primaryPhone', 'phone', 'status', 'plan', 'totalAmount', 'currency', 'createdAt'];
    const keys = new Set(rows.flatMap((row) => Object.keys(row)));
    return [...priority.filter((key) => keys.has(key)), ...Array.from(keys).filter((key) => !priority.includes(key) && !['id', 'createdAt', 'updatedAt', 'metadata', 'meta'].includes(key))].slice(0, 12).map((key) => ({ key, label: key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase()), get: (row: Record<string, unknown>) => row[key] }));
  }, [module, rows]);

  if (module !== 'dashboard' && !hasViewOnlyAccess(user, module)) return <div>Access denied</div>;
  const visibleModules = VIEW_ONLY_MODULES.filter((item) => user?.role === 'admin' || user?.permissions?.includes(item.id));

  return <Layout><main className="mx-auto w-full max-w-screen-2xl space-y-6 p-4 md:p-6">
    <header><p className="text-sm font-medium text-blue-700">{user?.role === 'viewer' ? 'Read-only access' : 'View-only account'}</p><h1 className="mt-1 text-2xl font-bold text-slate-900">{module === 'dashboard' ? 'Available modules' : selected?.label}</h1><p className="mt-1 text-sm text-slate-500">{module === 'dashboard' ? 'Open a module assigned to your account.' : `Read-only ${selected?.label.toLowerCase()} records.`}</p></header>
    {module === 'dashboard' ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{visibleModules.map((item) => <Card key={item.id}><CardHeader><CardTitle>{item.label}</CardTitle></CardHeader><CardContent><Button asChild variant="outline"><Link href={item.href}>View {item.label}</Link></Button></CardContent></Card>)}</div> : <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle>{selected?.label} records</CardTitle><span className="text-sm text-slate-500">{loading ? 'Loading…' : `${rows.length} records`}</span></CardHeader><CardContent className="overflow-x-auto">
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : loading ? <p className="text-sm text-slate-500">Loading records…</p> : rows.length === 0 ? <p className="text-sm text-slate-500">No records found.</p> : <table className="w-full min-w-[760px] border-collapse text-left text-sm"><thead><tr>{columns.map((column) => <th key={column.key} className="border-b bg-slate-50 px-3 py-3 font-semibold text-slate-600">{column.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={String(row.invoiceNo ?? row.id ?? index)} className="border-b last:border-0">{columns.map((column) => <td key={column.key} className="max-w-64 truncate px-3 py-3 text-slate-700" title={readable(column.get(row))}>{readable(column.get(row))}</td>)}</tr>)}</tbody></table>}
    </CardContent></Card>}
  </main></Layout>;
}
