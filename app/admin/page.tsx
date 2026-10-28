'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users,
  Wallet,
  AlertCircle,
  Clock3,
  ArrowUpRight,
  ArrowRight,
  Plus,
  CalendarDays,
  Receipt,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '../contexts/auth-context';
import Layout from '../components/layout';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { formatDisplayDate } from '@/lib/date-format';
import ViewOnlyModulePage from './view-only-module-page';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

type CustomerRecord = {
  id: string;
  status?: string | null;
  personalName?: string | null;
  companyName?: string | null;
};

type InvoiceRecord = {
  id: string;
  invoiceNo?: string | null;
  status?: string | null;
  totalAmount?: string | number | null;
  currency?: string | null;
  paidAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  customer?: {
    personalName?: string | null;
    companyName?: string | null;
  } | null;
};

type ReceiptRecord = {
  id: string;
  receiptNo?: string | null;
  totalAmount?: string | number | null;
  currency?: string | null;
  paidAt?: string | null;
  paymentMethod?: string | null;
  customer?: {
    personalName?: string | null;
    companyName?: string | null;
  } | null;
};

type RecentPaymentActivity = {
  id: string;
  customerName: string;
  amount: number;
  currency: string;
  paidAt: string | null;
  receiptNo: string;
  paymentMethod: string;
};

const toNumber = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatMoney = (value: number, currency = 'MMK') =>
  `${value.toLocaleString()} ${currency}`;

const normalizeInvoiceStatus = (
  status: string | null | undefined,
): 'paid' | 'unpaid' | 'overdue' | 'cancelled' => {
  const normalized = String(status ?? '')
    .trim()
    .toLowerCase();
  if (normalized === 'paid') return 'paid';
  if (normalized === 'overdue') return 'overdue';
  if (normalized === 'cancelled' || normalized === 'canceled')
    return 'cancelled';
  return 'unpaid';
};

const isActiveCustomer = (status: string | null | undefined) => {
  const normalized = String(status ?? '')
    .trim()
    .toLowerCase();
  return normalized === 'enable' || normalized === 'active';
};

const getCustomerName = (
  record:
    | { personalName?: string | null; companyName?: string | null }
    | null
    | undefined,
) => record?.personalName || record?.companyName || 'Unknown Customer';

const isSameDay = (value: string | null | undefined, now = new Date()) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
};

const normalizeList = <T,>(payload: unknown, key: string): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const value = (payload as Record<string, unknown>)[key];
    if (Array.isArray(value)) return value as T[];
  }
  return [];
};

const parseErrorMessage = (payload: unknown, fallback: string) => {
  if (!payload || typeof payload !== 'object') return fallback;
  const data = payload as { message?: string | string[]; error?: string };
  if (Array.isArray(data.message) && data.message.length > 0)
    return data.message.join(', ');
  if (typeof data.message === 'string' && data.message.trim())
    return data.message;
  if (typeof data.error === 'string' && data.error.trim()) return data.error;
  return fallback;
};

export default function AdminDashboard() {
  const { user, isLoading } = useAuth();
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState('');

  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    let active = true;

    const loadDashboardData = async () => {
      setDashboardLoading(true);
      setDashboardError('');
      try {
        const [customersResponse, invoicesResponse, receiptsResponse] =
          await Promise.all([
            fetch(`${API_BASE_URL}/customers`, {
              headers: { Accept: 'application/json' },
            }),
            fetch(`${API_BASE_URL}/billing/invoices`, {
              headers: { Accept: 'application/json' },
            }),
            fetch(`${API_BASE_URL}/billing/receipts`, {
              headers: { Accept: 'application/json' },
            }),
          ]);

        const customersPayload = await customersResponse
          .json()
          .catch(() => null);
        const invoicesPayload = await invoicesResponse.json().catch(() => null);
        const receiptsPayload = await receiptsResponse.json().catch(() => null);

        if (!customersResponse.ok) {
          throw new Error(
            parseErrorMessage(customersPayload, 'Failed to load customers'),
          );
        }
        if (!invoicesResponse.ok) {
          throw new Error(
            parseErrorMessage(invoicesPayload, 'Failed to load invoices'),
          );
        }

        const nextCustomers = normalizeList<CustomerRecord>(
          customersPayload,
          'customers',
        )
          .map((item) => ({
            id: String(item?.id ?? ''),
            status: item?.status ?? null,
            personalName: item?.personalName ?? null,
            companyName: item?.companyName ?? null,
          }))
          .filter((item) => item.id);

        const nextInvoices = normalizeList<InvoiceRecord>(
          invoicesPayload,
          'invoices',
        )
          .map((item) => ({
            id: String(item?.id ?? ''),
            invoiceNo: item?.invoiceNo ?? null,
            status: item?.status ?? null,
            totalAmount: item?.totalAmount ?? null,
            currency: item?.currency ?? 'MMK',
            paidAt: item?.paidAt ?? null,
            createdAt: item?.createdAt ?? null,
            updatedAt: item?.updatedAt ?? null,
            customer: item?.customer ?? null,
          }))
          .filter((item) => item.id);

        const nextReceipts = receiptsResponse.ok
          ? normalizeList<ReceiptRecord>(receiptsPayload, 'receipts')
              .map((item) => ({
                id: String(item?.id ?? ''),
                receiptNo: item?.receiptNo ?? null,
                totalAmount: item?.totalAmount ?? null,
                currency: item?.currency ?? 'MMK',
                paidAt: item?.paidAt ?? null,
                paymentMethod: item?.paymentMethod ?? null,
                customer: item?.customer ?? null,
              }))
              .filter((item) => item.id)
          : [];

        if (!active) return;
        setCustomers(nextCustomers);
        setInvoices(nextInvoices);
        setReceipts(nextReceipts);
      } catch (error) {
        if (!active) return;
        setDashboardError(
          error instanceof Error
            ? error.message
            : 'Failed to load dashboard data.',
        );
      } finally {
        if (active) {
          setDashboardLoading(false);
        }
      }
    };

    void loadDashboardData();
    return () => {
      active = false;
    };
  }, [user]);

  const {
    totalCustomers,
    activeCustomers,
    totalCollectedToday,
    pendingPayments,
    overdueBills,
    collectionTrendData,
    paymentStatusData,
    recentActivities,
    currency,
  } = useMemo(() => {
    const totalCustomersCount = customers.length;
    const activeCustomersCount = customers.filter((customer) =>
      isActiveCustomer(customer.status),
    ).length;

    const normalizedInvoices = invoices
      .map((invoice) => ({
        ...invoice,
        status: normalizeInvoiceStatus(invoice.status),
        numericTotal: toNumber(invoice.totalAmount),
      }))
      .filter((invoice) => invoice.status !== 'cancelled');

    const paidInvoices = normalizedInvoices.filter(
      (invoice) => invoice.status === 'paid',
    );
    const unpaidCount = normalizedInvoices.filter(
      (invoice) => invoice.status === 'unpaid',
    ).length;
    const overdueCount = normalizedInvoices.filter(
      (invoice) => invoice.status === 'overdue',
    ).length;

    const primaryCurrency =
      normalizedInvoices.find((item) => item.currency)?.currency || 'MMK';
    const todayCollected = paidInvoices
      .filter((invoice) =>
        isSameDay(invoice.paidAt || invoice.updatedAt || invoice.createdAt),
      )
      .reduce((sum, invoice) => sum + invoice.numericTotal, 0);

    const now = new Date();
    const monthBuckets = Array.from({ length: 6 }).map((_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('en-US', { month: 'short' });
      return { key, label, collected: 0 };
    });
    const monthMap = new Map(monthBuckets.map((item) => [item.key, item]));

    paidInvoices.forEach((invoice) => {
      const sourceDate =
        invoice.paidAt || invoice.updatedAt || invoice.createdAt;
      if (!sourceDate) return;
      const parsed = new Date(sourceDate);
      if (Number.isNaN(parsed.getTime())) return;
      const key = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
      const bucket = monthMap.get(key);
      if (!bucket) return;
      bucket.collected += invoice.numericTotal;
    });

    const trend = monthBuckets.map((item) => ({
      month: item.label,
      collected: Number(item.collected.toFixed(2)),
    }));

    const statusData = [
      { name: 'Paid', value: paidInvoices.length, color: '#16845b' },
      { name: 'Unpaid', value: unpaidCount, color: '#e4a12b' },
      { name: 'Overdue', value: overdueCount, color: '#d75b54' },
    ];

    const activities: RecentPaymentActivity[] = receipts.length
      ? receipts
          .map((receipt) => ({
            id: receipt.id,
            customerName: getCustomerName(receipt.customer),
            amount: toNumber(receipt.totalAmount),
            currency: receipt.currency || primaryCurrency,
            paidAt: receipt.paidAt || null,
            receiptNo: receipt.receiptNo || `RC-${receipt.id}`,
            paymentMethod: receipt.paymentMethod || 'N/A',
          }))
          .sort((a, b) => {
            const aTime = a.paidAt ? Date.parse(a.paidAt) : 0;
            const bTime = b.paidAt ? Date.parse(b.paidAt) : 0;
            return bTime - aTime;
          })
      : paidInvoices
          .map((invoice) => ({
            id: invoice.id,
            customerName: getCustomerName(invoice.customer),
            amount: invoice.numericTotal,
            currency: invoice.currency || primaryCurrency,
            paidAt:
              invoice.paidAt || invoice.updatedAt || invoice.createdAt || null,
            receiptNo: invoice.invoiceNo || invoice.id,
            paymentMethod: 'Paid',
          }))
          .sort((a, b) => {
            const aTime = a.paidAt ? Date.parse(a.paidAt) : 0;
            const bTime = b.paidAt ? Date.parse(b.paidAt) : 0;
            return bTime - aTime;
          });

    return {
      totalCustomers: totalCustomersCount,
      activeCustomers: activeCustomersCount,
      totalCollectedToday: todayCollected,
      pendingPayments: unpaidCount,
      overdueBills: overdueCount,
      collectionTrendData: trend,
      paymentStatusData: statusData,
      recentActivities: activities.slice(0, 5),
      currency: primaryCurrency,
    };
  }, [customers, invoices, receipts]);

  if (isLoading) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  if (user?.role === 'viewer') return <ViewOnlyModulePage module="dashboard" />;
  if (!user || user.role !== 'admin') {
    return <div>Access denied</div>;
  }

  const invoiceCount = paymentStatusData.reduce(
    (sum, status) => sum + status.value,
    0,
  );
  const currentMonth = collectionTrendData[collectionTrendData.length - 1];
  const unavailable = dashboardLoading || Boolean(dashboardError);
  const metrics = [
    {
      title: 'Total customers',
      value: totalCustomers.toLocaleString(),
      detail: `${activeCustomers} active ${activeCustomers === 1 ? 'account' : 'accounts'}`,
      icon: Users,
      tone: 'bg-emerald-50 text-emerald-700',
      href: '/admin/customers/customer-list',
    },
    {
      title: 'Collected today',
      value: formatMoney(totalCollectedToday, currency),
      detail: 'From paid invoices today',
      icon: Wallet,
      tone: 'bg-emerald-50 text-emerald-700',
      href: '/admin/billing/receipt/list',
    },
    {
      title: 'Pending payments',
      value: pendingPayments.toLocaleString(),
      detail: 'Invoices awaiting payment',
      icon: Clock3,
      tone: 'bg-amber-50 text-amber-700',
      href: '/admin/billing',
    },
    {
      title: 'Overdue bills',
      value: overdueBills.toLocaleString(),
      detail:
        overdueBills > 0 ? 'Requires your attention' : 'No overdue invoices',
      icon: AlertCircle,
      tone: 'bg-rose-50 text-rose-700',
      href: '/admin/billing',
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="page-eyebrow">Your workspace, at a glance</p>
            <h1>Business overview</h1>
            <p>
              Welcome back, {user.name}. Here&apos;s where your billing stands.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2.5 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              {new Date().toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              })}
            </span>
            <Button asChild>
              <Link href="/admin/billing/receipt/create">
                <Plus className="h-4 w-4" />
                Record payment
              </Link>
            </Button>
          </div>
        </div>

        {dashboardError && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{dashboardError}</span>
          </div>
        )}
        {dashboardLoading && (
          <div
            role="status"
            className="flex items-center gap-2 text-xs text-muted-foreground"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading your billing overview...
          </div>
        )}

        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
          aria-busy={dashboardLoading}
        >
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <Link
                key={metric.title}
                href={metric.href}
                className="group min-w-0 rounded-xl focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Card className="h-full transition-colors group-hover:border-emerald-800/30">
                  <CardContent className="flex items-start gap-3 p-5">
                    <div className={`metric-icon ${metric.tone}`}>
                      <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-medium text-muted-foreground">
                          {metric.title}
                        </p>
                        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/40 transition-colors group-hover:text-primary" />
                      </div>
                      <p className="mt-2 break-words text-[26px] font-semibold leading-tight tracking-tight tabular-nums">
                        {unavailable ? '—' : metric.value}
                      </p>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                        {unavailable
                          ? 'Waiting for billing data'
                          : metric.detail}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[1.5fr_1fr]">
          <Card className="min-w-0">
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
              <div>
                <CardTitle>Collections</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Paid invoices over the last six months
                </p>
              </div>
              <span className="shrink-0 rounded-md border px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground">
                Last 6 months
              </span>
            </CardHeader>
            <CardContent>
              <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="text-2xl font-semibold tracking-tight tabular-nums">
                  {unavailable
                    ? '—'
                    : formatMoney(currentMonth?.collected || 0, currency)}
                </p>
                <span className="text-xs text-muted-foreground">
                  collected in {currentMonth?.month}
                </span>
              </div>
              <div
                role="img"
                aria-label={`Collections by month: ${collectionTrendData.map((month) => `${month.month}: ${unavailable ? 'unavailable' : formatMoney(month.collected, currency)}`).join(', ')}`}
              >
                <ResponsiveContainer width="100%" height={230}>
                  <AreaChart
                    data={unavailable ? [] : collectionTrendData}
                    margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="collections-fill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#16845b"
                          stopOpacity={0.16}
                        />
                        <stop
                          offset="100%"
                          stopColor="#16845b"
                          stopOpacity={0.01}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 5"
                      vertical={false}
                      stroke="#e7ece8"
                    />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#738077', fontSize: 11 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#738077', fontSize: 10 }}
                      width={52}
                      tickFormatter={(value: number) =>
                        new Intl.NumberFormat('en', {
                          notation: 'compact',
                        }).format(value)
                      }
                    />
                    <Tooltip
                      formatter={(value: number) => [
                        formatMoney(toNumber(value), currency),
                        'Collected',
                      ]}
                      contentStyle={{
                        borderRadius: 10,
                        borderColor: '#e1e7e2',
                        fontSize: 12,
                        boxShadow: '0 8px 24px rgba(24,34,31,0.08)',
                      }}
                    />
                    <Area
                      type="linear"
                      dataKey="collected"
                      stroke="#16845b"
                      strokeWidth={2.5}
                      fill="url(#collections-fill)"
                      dot={{
                        r: 3,
                        fill: '#16845b',
                        stroke: '#fff',
                        strokeWidth: 2,
                      }}
                      activeDot={{ r: 5 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Invoice status</CardTitle>
              <p className="text-xs text-muted-foreground">
                A snapshot of your payment pipeline
              </p>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-3 sm:flex-row">
              <div
                className="relative w-full max-w-[180px] shrink-0"
                role="img"
                aria-label={
                  unavailable
                    ? 'Invoice status unavailable'
                    : paymentStatusData
                        .map((item) => `${item.name}: ${item.value}`)
                        .join(', ')
                }
              >
                <ResponsiveContainer width="100%" height={215}>
                  <PieChart>
                    <Pie
                      data={
                        invoiceCount > 0 && !unavailable
                          ? paymentStatusData
                          : [
                              {
                                name: 'No invoices',
                                value: 1,
                                color: '#e9eeea',
                              },
                            ]
                      }
                      cx="50%"
                      cy="50%"
                      innerRadius={62}
                      outerRadius={80}
                      paddingAngle={invoiceCount > 0 ? 3 : 0}
                      dataKey="value"
                      stroke="none"
                      startAngle={90}
                      endAngle={-270}
                    >
                      {(invoiceCount > 0 && !unavailable
                        ? paymentStatusData
                        : [{ name: 'No invoices', color: '#e9eeea' }]
                      ).map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    {invoiceCount > 0 && !unavailable && <Tooltip />}
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-semibold tracking-tight tabular-nums">
                    {unavailable ? '—' : invoiceCount}
                  </span>
                  <span className="mt-1 text-[11px] text-muted-foreground">
                    total invoices
                  </span>
                </div>
              </div>
              <div className="w-full space-y-4">
                {paymentStatusData.map((status) => (
                  <div
                    key={status.name}
                    className="flex items-center gap-2.5 text-xs"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: status.color }}
                    />
                    <span className="flex-1 text-muted-foreground">
                      {status.name}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {unavailable ? '—' : status.value}
                    </span>
                    <span className="w-9 text-right tabular-nums text-muted-foreground">
                      {unavailable
                        ? '—'
                        : `${invoiceCount ? Math.round((status.value / invoiceCount) * 100) : 0}%`}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {!unavailable && overdueBills > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200/70 bg-rose-50/60 px-4 py-3">
            <div className="flex items-center gap-2.5 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4" />
              <span>
                {overdueBills} overdue{' '}
                {overdueBills === 1 ? 'bill needs' : 'bills need'} a follow-up.
              </span>
            </div>
            <Link
              href="/admin/billing"
              className="inline-flex items-center gap-2 text-xs font-semibold text-rose-800 hover:underline"
            >
              Review invoices
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle>Recent payments</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Your latest recorded collections
              </p>
            </div>
            <Link className="panel-link" href="/admin/billing/receipt/list">
              View receipts
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="px-0 pb-2 sm:px-3">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Customer</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unavailable || recentActivities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center">
                      <Receipt className="mx-auto mb-3 h-7 w-7 text-muted-foreground/40" />
                      <p className="text-sm font-medium">
                        {dashboardLoading
                          ? 'Loading payments'
                          : dashboardError
                            ? 'Payments could not be loaded'
                            : 'No payments recorded yet'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {dashboardError
                          ? 'Try reloading this page to reconnect.'
                          : 'Recorded payments will appear here.'}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  recentActivities.map((activity) => (
                    <TableRow key={activity.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-secondary-foreground">
                            {activity.customerName
                              .split(' ')
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((word) => word[0])
                              .join('')
                              .toUpperCase()}
                          </span>
                          <span className="whitespace-nowrap text-xs font-medium">
                            {activity.customerName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {activity.receiptNo}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDisplayDate(activity.paidAt, '—')}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {activity.paymentMethod}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs font-semibold">
                        {formatMoney(activity.amount, activity.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="status-paid">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                          Paid
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
