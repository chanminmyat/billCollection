'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, DollarSign, AlertCircle, TrendingUp } from 'lucide-react';
import { useAuth } from '../contexts/auth-context';
import Layout from '../components/layout';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { formatDisplayDate } from '@/lib/date-format';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

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

const formatMoney = (value: number, currency = 'MMK') => `${value.toLocaleString()} ${currency}`;

const normalizeInvoiceStatus = (status: string | null | undefined): 'paid' | 'unpaid' | 'overdue' | 'cancelled' => {
  const normalized = String(status ?? '')
    .trim()
    .toLowerCase();
  if (normalized === 'paid') return 'paid';
  if (normalized === 'overdue') return 'overdue';
  if (normalized === 'cancelled' || normalized === 'canceled') return 'cancelled';
  return 'unpaid';
};

const isActiveCustomer = (status: string | null | undefined) => {
  const normalized = String(status ?? '')
    .trim()
    .toLowerCase();
  return normalized === 'enable' || normalized === 'active';
};

const getCustomerName = (record: { personalName?: string | null; companyName?: string | null } | null | undefined) =>
  record?.personalName || record?.companyName || 'Unknown Customer';

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
  if (Array.isArray(data.message) && data.message.length > 0) return data.message.join(', ');
  if (typeof data.message === 'string' && data.message.trim()) return data.message;
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
        const [customersResponse, invoicesResponse, receiptsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/customers`, { headers: { Accept: 'application/json' } }),
          fetch(`${API_BASE_URL}/billing/invoices`, { headers: { Accept: 'application/json' } }),
          fetch(`${API_BASE_URL}/billing/receipts`, { headers: { Accept: 'application/json' } }),
        ]);

        const customersPayload = await customersResponse.json().catch(() => null);
        const invoicesPayload = await invoicesResponse.json().catch(() => null);
        const receiptsPayload = await receiptsResponse.json().catch(() => null);

        if (!customersResponse.ok) {
          throw new Error(parseErrorMessage(customersPayload, 'Failed to load customers'));
        }
        if (!invoicesResponse.ok) {
          throw new Error(parseErrorMessage(invoicesPayload, 'Failed to load invoices'));
        }

        const nextCustomers = normalizeList<CustomerRecord>(customersPayload, 'customers')
          .map((item) => ({
            id: String(item?.id ?? ''),
            status: item?.status ?? null,
            personalName: item?.personalName ?? null,
            companyName: item?.companyName ?? null
          }))
          .filter((item) => item.id);

        const nextInvoices = normalizeList<InvoiceRecord>(invoicesPayload, 'invoices')
          .map((item) => ({
            id: String(item?.id ?? ''),
            invoiceNo: item?.invoiceNo ?? null,
            status: item?.status ?? null,
            totalAmount: item?.totalAmount ?? null,
            currency: item?.currency ?? 'MMK',
            paidAt: item?.paidAt ?? null,
            createdAt: item?.createdAt ?? null,
            updatedAt: item?.updatedAt ?? null,
            customer: item?.customer ?? null
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
                customer: item?.customer ?? null
              }))
              .filter((item) => item.id)
          : [];

        if (!active) return;
        setCustomers(nextCustomers);
        setInvoices(nextInvoices);
        setReceipts(nextReceipts);
      } catch (error) {
        if (!active) return;
        setDashboardError(error instanceof Error ? error.message : 'Failed to load dashboard data.');
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
    currency
  } = useMemo(() => {
    const totalCustomersCount = customers.length;
    const activeCustomersCount = customers.filter((customer) => isActiveCustomer(customer.status)).length;

    const normalizedInvoices = invoices
      .map((invoice) => ({
        ...invoice,
        status: normalizeInvoiceStatus(invoice.status),
        numericTotal: toNumber(invoice.totalAmount),
      }))
      .filter((invoice) => invoice.status !== 'cancelled');

    const paidInvoices = normalizedInvoices.filter((invoice) => invoice.status === 'paid');
    const unpaidCount = normalizedInvoices.filter((invoice) => invoice.status === 'unpaid').length;
    const overdueCount = normalizedInvoices.filter((invoice) => invoice.status === 'overdue').length;

    const primaryCurrency = normalizedInvoices.find((item) => item.currency)?.currency || 'MMK';
    const todayCollected = paidInvoices
      .filter((invoice) => isSameDay(invoice.paidAt || invoice.updatedAt || invoice.createdAt))
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
      const sourceDate = invoice.paidAt || invoice.updatedAt || invoice.createdAt;
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
      collected: Number(item.collected.toFixed(2))
    }));

    const statusData = [
      { name: 'Paid', value: paidInvoices.length, color: '#10B981' },
      { name: 'Unpaid', value: unpaidCount, color: '#F59E0B' },
      { name: 'Overdue', value: overdueCount, color: '#EF4444' },
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
            paymentMethod: receipt.paymentMethod || 'N/A'
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
            paidAt: invoice.paidAt || invoice.updatedAt || invoice.createdAt || null,
            receiptNo: invoice.invoiceNo || invoice.id,
            paymentMethod: 'Paid'
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
      currency: primaryCurrency
    };
  }, [customers, invoices, receipts]);

  if (isLoading) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  if (!user || user.role !== 'admin') {
    return <div>Access denied</div>;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600">Welcome back, {user.name}</p>
        </div>

        {dashboardError && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {dashboardError}
          </div>
        )}
        {dashboardLoading && (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Loading dashboard data...
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCustomers}</div>
              <p className="text-xs text-muted-foreground">{activeCustomers} active customers</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Collection</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatMoney(totalCollectedToday, currency)}</div>
              <p className="text-xs text-muted-foreground">From paid invoices today</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingPayments}</div>
              <p className="text-xs text-muted-foreground">Bills awaiting payment</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue Bills</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overdueBills}</div>
              <p className="text-xs text-muted-foreground">Requires immediate attention</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Collection Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={collectionTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => formatMoney(toNumber(value), currency)} />
                  <Line type="monotone" dataKey="collected" stroke="#3B82F6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={paymentStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {paymentStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivities.length === 0 ? (
                <p className="text-sm text-gray-500">No recent payment activity found.</p>
              ) : (
                recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-center space-x-4">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Payment received from {activity.customerName}</p>
                      <p className="text-xs text-gray-500">
                        {formatMoney(activity.amount, activity.currency)} - {formatDisplayDate(activity.paidAt, '-')}
                        {activity.paymentMethod && activity.paymentMethod !== 'N/A'
                          ? ` • ${activity.paymentMethod}`
                          : ''}
                      </p>
                    </div>
                    <div className="text-sm text-gray-500">{activity.receiptNo}</div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
