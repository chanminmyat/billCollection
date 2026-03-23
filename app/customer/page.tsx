'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Download, DollarSign, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/auth-context';
import Layout from '../components/layout';
import { filterReleasedInvoices } from '@/lib/invoice-visibility';
import { formatDisplayDate, formatDisplayDateRange } from '@/lib/date-format';
import {
  CollectionWorkflowEvent,
  COLLECTION_WORKFLOW_STORAGE_KEY,
  COLLECTION_WORKFLOW_UPDATED_EVENT,
  CollectionWorkflowMap,
  CollectionWorkflowStatus,
  getCollectionWorkflowStatusClassName,
  getCollectionWorkflowStatusLabel,
  readCollectionWorkflowMap,
} from '@/lib/collection-workflow';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

type InvoiceStatus = 'paid' | 'unpaid' | 'overdue' | 'cancelled';

type InvoiceRecord = {
  id: string;
  invoiceNo?: string | null;
  invoiceDate?: string | null;
  billingPeriodFrom?: string | null;
  billingPeriodTo?: string | null;
  dueDate?: string | null;
  paidAt?: string | null;
  status: InvoiceStatus;
  totalAmount?: string | number | null;
  currency?: string | null;
  paymentMethod?: string | null;
  receiptNo?: string | null;
  collectionStatus?: CollectionWorkflowStatus | null;
  collectionUpdatedAt?: string | null;
  collectionEvents?: CollectionWorkflowEvent[] | null;
  customer?: {
    id?: string | null;
    customerCode?: string | null;
    personalName?: string | null;
    companyName?: string | null;
    primaryPhone?: string | null;
    installationAddress?: string | null;
  } | null;
  subscription?: {
    plan?: {
      planCode?: string | null;
      planName?: string | null;
      monthlyFee?: string | number | null;
      currency?: string | null;
    } | null;
  } | null;
};

const normalizeKey = (value?: string | null) => (value ? value.trim().toLowerCase() : '');

const toNumber = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatMoney = (value: string | number | null | undefined, currency = 'MMK') =>
  `${toNumber(value).toLocaleString()} ${currency}`;

const statusBadgeVariant = (status: InvoiceStatus) => {
  if (status === 'paid') return 'default';
  if (status === 'unpaid') return 'secondary';
  return 'destructive';
};

const getInvoiceSortDate = (invoice: InvoiceRecord) => {
  const candidate = invoice.invoiceDate || invoice.dueDate || invoice.paidAt;
  if (!candidate) return 0;
  const parsed = Date.parse(candidate);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getBillingPeriod = (invoice: InvoiceRecord) => {
  if (invoice.billingPeriodFrom && invoice.billingPeriodTo) {
    return formatDisplayDateRange(invoice.billingPeriodFrom, invoice.billingPeriodTo);
  }
  return invoice.invoiceNo || invoice.id;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return '-';
  return new Date(parsed).toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

export default function CustomerDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [collectionMap, setCollectionMap] = useState<CollectionWorkflowMap>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!user || user.role !== 'customer') {
      return;
    }

    let mounted = true;

    const fetchInvoices = async () => {
      setIsLoading(true);
      setLoadError('');
      try {
        const response = await fetch(`${API_BASE_URL}/billing/invoices`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.message ?? 'Failed to load invoices');
        }

        const data = await response.json().catch(() => []);
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.invoices)
            ? data.invoices
            : [];

        if (!mounted) return;
        setInvoices(list);
      } catch (error) {
        if (!mounted) return;
        setLoadError(error instanceof Error ? error.message : 'Failed to load invoices');
        setInvoices([]);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchInvoices();

    return () => {
      mounted = false;
    };
  }, [user?.id, user?.role]);

  const refreshCollectionMap = useCallback(() => {
    setCollectionMap(readCollectionWorkflowMap());
  }, []);

  useEffect(() => {
    refreshCollectionMap();
  }, [refreshCollectionMap]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (event: StorageEvent) => {
      if (event.key === COLLECTION_WORKFLOW_STORAGE_KEY) {
        refreshCollectionMap();
      }
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(COLLECTION_WORKFLOW_UPDATED_EVENT, refreshCollectionMap);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(COLLECTION_WORKFLOW_UPDATED_EVENT, refreshCollectionMap);
    };
  }, [refreshCollectionMap]);

  const customerIdentityKeys = new Set<string>(
    [
      normalizeKey(user?.id),
      normalizeKey(user?.username),
      normalizeKey(user?.customerProfile?.id),
      normalizeKey(user?.customerProfile?.customerCode),
      normalizeKey(user?.customerProfile?.accountNumber)
    ].filter(Boolean)
  );

  const releasedInvoices = useMemo(() => filterReleasedInvoices(invoices), [invoices]);

  const customerInvoices = releasedInvoices
    .filter((invoice) => {
      const invoiceCustomerId = normalizeKey(invoice.customer?.id);
      const invoiceCustomerCode = normalizeKey(invoice.customer?.customerCode);
      return (
        (invoiceCustomerId && customerIdentityKeys.has(invoiceCustomerId)) ||
        (invoiceCustomerCode && customerIdentityKeys.has(invoiceCustomerCode))
      );
    })
    .sort((a, b) => getInvoiceSortDate(b) - getInvoiceSortDate(a));

  const latestInvoice = customerInvoices[0];
  const customerName =
    latestInvoice?.customer?.personalName ||
    latestInvoice?.customer?.companyName ||
    user?.name ||
    'Customer';
  const customerCode =
    latestInvoice?.customer?.customerCode || user?.customerProfile?.customerCode || user?.username || '-';
  const packageName =
    latestInvoice?.subscription?.plan?.planName ||
    latestInvoice?.subscription?.plan?.planCode ||
    '-';
  const monthlyFee = latestInvoice?.subscription?.plan?.monthlyFee;
  const packageCurrency = latestInvoice?.subscription?.plan?.currency || latestInvoice?.currency || 'MMK';
  const customerPhone = latestInvoice?.customer?.primaryPhone || user?.phone || '-';
  const customerAddress = latestInvoice?.customer?.installationAddress || user?.customerProfile?.address || '-';

  const totalBills = customerInvoices.length;
  const paidBills = customerInvoices.filter((bill) => bill.status === 'paid').length;
  const unpaidBills = customerInvoices.filter((bill) => bill.status === 'unpaid').length;
  const overdueBills = customerInvoices.filter((bill) => bill.status === 'overdue').length;
  const totalPaid = customerInvoices
    .filter((bill) => bill.status === 'paid')
    .reduce((sum, bill) => sum + toNumber(bill.totalAmount), 0);
  const totalOutstanding = customerInvoices
    .filter((bill) => bill.status !== 'paid')
    .reduce((sum, bill) => sum + toNumber(bill.totalAmount), 0);
  const paymentHistory = customerInvoices.filter((bill) => bill.status === 'paid');

  const getCollectionStatusForInvoice = (invoice: InvoiceRecord): CollectionWorkflowStatus => {
    if (invoice.status === 'paid') return 'completed';
    if (invoice.collectionStatus) return invoice.collectionStatus;
    return collectionMap[invoice.id]?.status ?? 'idle';
  };

  const collectionFeed = useMemo(
    () =>
      customerInvoices.map((invoice) => ({
        invoice,
        status: getCollectionStatusForInvoice(invoice),
        events:
          Array.isArray(invoice.collectionEvents) && invoice.collectionEvents.length > 0
            ? invoice.collectionEvents
            : collectionMap[invoice.id]?.events ?? [],
      })),
    [collectionMap, customerInvoices],
  );

  const handleDownloadReceipt = (invoice: InvoiceRecord) => {
    const receiptNo = invoice.receiptNo || invoice.invoiceNo || invoice.id;
    alert(`Receipt downloaded: ${receiptNo}`);
  };

  if (authLoading) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  if (!user || user.role !== 'customer') {
    return <div>Access denied</div>;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customer Portal</h1>
          <p className="text-gray-600">Welcome, {customerName}</p>
        </div>

        {isLoading && (
          <Card>
            <CardContent className="pt-6 text-sm text-slate-600">Loading invoices...</CardContent>
          </Card>
        )}
        {!!loadError && (
          <Card>
            <CardContent className="pt-6 text-sm text-rose-600">{loadError}</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <Label className="text-sm text-gray-500">Customer Code</Label>
                <p className="font-mono">{customerCode}</p>
              </div>
              <div>
                <Label className="text-sm text-gray-500">Package</Label>
                <p className="font-medium">{packageName}</p>
              </div>
              <div>
                <Label className="text-sm text-gray-500">Monthly Fee</Label>
                <p className="font-bold">{formatMoney(monthlyFee, packageCurrency)}</p>
              </div>
              <div>
                <Label className="text-sm text-gray-500">Status</Label>
                <Badge variant={overdueBills > 0 ? 'destructive' : 'default'}>
                  {overdueBills > 0 ? 'overdue' : 'active'}
                </Badge>
              </div>
            </div>
            <div className="mt-4">
              <Label className="text-sm text-gray-500">Address</Label>
              <p>{customerAddress}</p>
            </div>
            <div className="mt-2">
              <Label className="text-sm text-gray-500">Phone</Label>
              <p>{customerPhone}</p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Bills</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalBills}</div>
              <p className="text-xs text-muted-foreground">All bills generated</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatMoney(totalPaid)}</div>
              <p className="text-xs text-muted-foreground">{paidBills} invoices paid</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
              <DollarSign className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{formatMoney(totalOutstanding)}</div>
              <p className="text-xs text-muted-foreground">{unpaidBills} unpaid invoices</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{overdueBills}</div>
              <p className="text-xs text-muted-foreground">Invoices past due date</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice No</TableHead>
                  <TableHead>Billing Period</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Collection</TableHead>
                  <TableHead>Paid Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customerInvoices.slice(0, 10).map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono">{invoice.invoiceNo || invoice.id}</TableCell>
                    <TableCell>{getBillingPeriod(invoice)}</TableCell>
                    <TableCell>{formatMoney(invoice.totalAmount, invoice.currency || 'MMK')}</TableCell>
                    <TableCell>{formatDisplayDate(invoice.dueDate, '-')}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(invoice.status)}>{invoice.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={getCollectionWorkflowStatusClassName(getCollectionStatusForInvoice(invoice))}
                      >
                        {getCollectionWorkflowStatusLabel(getCollectionStatusForInvoice(invoice))}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDisplayDate(invoice.paidAt, '-')}</TableCell>
                  </TableRow>
                ))}
                {customerInvoices.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-slate-500">
                      No invoices found for this customer account.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Collection Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {collectionFeed.length === 0 ? (
              <p className="text-sm text-slate-500">No invoices to track yet.</p>
            ) : (
              <div className="space-y-4">
                {collectionFeed.map(({ invoice, status, events }) => (
                  <div key={invoice.id} className="rounded-md border p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {invoice.invoiceNo || invoice.id}
                        </p>
                        <p className="text-xs text-slate-500">
                          {getBillingPeriod(invoice)}
                        </p>
                      </div>
                      <Badge variant="secondary" className={getCollectionWorkflowStatusClassName(status)}>
                        {getCollectionWorkflowStatusLabel(status)}
                      </Badge>
                    </div>

                    {events.length === 0 ? (
                      <p className="text-sm text-slate-500">No collection updates yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {events
                          .slice()
                          .reverse()
                          .map((event) => (
                            <div key={event.id} className="rounded border bg-slate-50 p-2">
                              <p className="text-sm font-medium text-slate-800">{event.label}</p>
                              {event.note && <p className="text-xs text-slate-600">Note: {event.note}</p>}
                              <p className="text-xs text-slate-500">
                                {formatDateTime(event.timestamp)}
                                {event.actorName ? ` • ${event.actorName}` : ''}
                              </p>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt Number</TableHead>
                  <TableHead>Payment Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentHistory.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono">{invoice.receiptNo || invoice.invoiceNo || invoice.id}</TableCell>
                    <TableCell>{formatDisplayDate(invoice.paidAt, '-')}</TableCell>
                    <TableCell>{formatMoney(invoice.totalAmount, invoice.currency || 'MMK')}</TableCell>
                    <TableCell className="capitalize">{invoice.paymentMethod || '-'}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => handleDownloadReceipt(invoice)}>
                        <Download className="mr-1 h-3 w-3" />
                        Download
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {paymentHistory.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-slate-500">
                      No paid invoices yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}
