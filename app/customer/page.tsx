'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download, DollarSign, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/auth-context';
import Layout from '../components/layout';
import { filterReleasedInvoices } from '@/lib/invoice-visibility';
import { formatDisplayDate, formatDisplayDateRange } from '@/lib/date-format';
import { useToast } from '@/hooks/use-toast';
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

type InvoiceStatus = 'paid' | 'unpaid' | 'overdue' | 'cancelled' | 'carried_forward';

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

type PaymentAccount = {
  id: string;
  kind: 'wallet' | 'account';
  walletType?: string | null;
  bankType?: string | null;
  accountName: string;
  accountNumber: string;
  qrCodeDataUrl?: string | null;
  isActive?: boolean;
};

const normalizeCollectionServiceValue = (value: unknown): 'yes' | 'no' | null => {
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (['yes', 'true', '1', 'enable', 'enabled', 'active', 'on'].includes(normalized)) return 'yes';
  if (['no', 'false', '0', 'disable', 'disabled', 'off'].includes(normalized)) return 'no';
  return null;
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
  if (status === 'carried_forward') return 'outline';
  return 'destructive';
};

const formatInvoiceStatus = (status: InvoiceStatus) =>
  status === 'carried_forward' ? 'carried forward' : status;

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
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [collectionMap, setCollectionMap] = useState<CollectionWorkflowMap>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [customerCollectionService, setCustomerCollectionService] = useState<'yes' | 'no' | null>(null);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<InvoiceRecord | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'account'>('wallet');
  const [selectedPaymentAccountId, setSelectedPaymentAccountId] = useState('');
  const [paymentSlipFile, setPaymentSlipFile] = useState<File | null>(null);
  const [paymentSlipFileName, setPaymentSlipFileName] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

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

  useEffect(() => {
    if (!user || user.role !== 'customer') return;
    let mounted = true;

    const fetchCustomerProfile = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/customers`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) return;
        const data = await response.json().catch(() => []);
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.customers)
            ? data.customers
            : [];

        const identityKeys = new Set<string>(
          [
            normalizeKey(user?.id),
            normalizeKey(user?.username),
            normalizeKey(user?.customerProfile?.id),
            normalizeKey(user?.customerProfile?.customerCode)
          ].filter(Boolean)
        );

        const matched = list.find((item: any) => {
          const keys = [
            normalizeKey(item?.id),
            normalizeKey(item?.customerCode),
            normalizeKey(item?.user?.id),
            normalizeKey(item?.user?.username),
            normalizeKey(item?.account?.id),
            normalizeKey(item?.account?.username)
          ].filter(Boolean);
          return keys.some((key: string) => identityKeys.has(key));
        });

        const collectionService = normalizeCollectionServiceValue(
          matched?.collectionService ??
            matched?.collectionServiceEnabled ??
            matched?.billingInformation?.collectionService
        );

        if (mounted) {
          setCustomerCollectionService(collectionService);
        }
      } catch {
        if (mounted) {
          setCustomerCollectionService(null);
        }
      }
    };

    const fetchPaymentAccounts = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/billing/payment-accounts`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) {
          setPaymentAccounts([]);
          return;
        }
        const data = await response.json().catch(() => []);
        const list = Array.isArray(data) ? data : [];
        const normalized = list
          .map((item: any) => {
            const kind: 'wallet' | 'account' =
              String(item?.kind ?? '').toLowerCase() === 'account' ? 'account' : 'wallet';
            return {
              id: String(item?.id ?? ''),
              kind,
              walletType: item?.walletType ?? null,
              bankType: item?.bankType ?? null,
              accountName: String(item?.accountName ?? ''),
              accountNumber: String(item?.accountNumber ?? ''),
              qrCodeDataUrl: item?.qrCodeDataUrl ?? null,
              isActive: item?.isActive ?? true
            } as PaymentAccount;
          })
          .filter((item) => Boolean(item.id && item.accountName && item.isActive !== false));
        setPaymentAccounts(normalized);
      } catch {
        setPaymentAccounts([]);
      }
    };

    void fetchCustomerProfile();
    void fetchPaymentAccounts();

    return () => {
      mounted = false;
    };
  }, [user?.id, user?.role, user?.username, user?.customerProfile?.id, user?.customerProfile?.customerCode]);

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
    .filter((bill) => bill.status === 'unpaid' || bill.status === 'overdue')
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

  const availablePaymentAccounts = useMemo(
    () => paymentAccounts.filter((account) => account.kind === paymentMethod),
    [paymentAccounts, paymentMethod]
  );

  const selectedPaymentAccount = useMemo(
    () => availablePaymentAccounts.find((account) => account.id === selectedPaymentAccountId) ?? null,
    [availablePaymentAccounts, selectedPaymentAccountId]
  );

  const canCustomerSelfPay = customerCollectionService === 'no';

  const handleDownloadReceipt = (invoice: InvoiceRecord) => {
    const receiptNo = invoice.receiptNo || invoice.invoiceNo || invoice.id;
    alert(`Receipt downloaded: ${receiptNo}`);
  };

  const openPayBillDialog = (invoice: InvoiceRecord) => {
    setSelectedInvoiceForPayment(invoice);
    setPaymentMethod('wallet');
    setSelectedPaymentAccountId('');
    setPaymentSlipFile(null);
    setPaymentSlipFileName('');
    setPayDialogOpen(true);
  };

  const handleSubmitCustomerPayment = async () => {
    if (!selectedInvoiceForPayment) return;
    if (!selectedPaymentAccount) {
      toast({
        title: 'Select payment account',
        description: 'Please choose wallet/bank account to continue.',
        variant: 'destructive'
      });
      return;
    }
    if (!paymentSlipFile) {
      toast({
        title: 'Upload payment slip',
        description: 'Please upload payment slip image before submit.',
        variant: 'destructive'
      });
      return;
    }
    if (isSubmittingPayment) return;
    setIsSubmittingPayment(true);

    try {
      const paymentMethodName = paymentMethod === 'wallet' ? 'Wallet' : 'Bank Account';
      const paymentAccountInfo = `${selectedPaymentAccount.accountName} (${selectedPaymentAccount.accountNumber})`;
      const note = [
        'Customer paid from customer dashboard.',
        `Payment Method: ${paymentMethodName}`,
        `Payment Account: ${paymentAccountInfo}`
      ].join(' | ');

      const formData = new FormData();
      formData.append('status', 'collected_pending_admin');
      formData.append('type', 'collector_collected');
      formData.append('label', 'Payment submitted by customer');
      formData.append('note', note);
      formData.append('paymentMethod', paymentMethodName);
      if (user?.name) formData.append('actorName', user.name);
      if (user?.role) formData.append('actorRole', user.role);
      formData.append('paymentSlip', paymentSlipFile);

      const response = await fetch(
        `${API_BASE_URL}/billing/invoices/${selectedInvoiceForPayment.id}/collection-workflow`,
        {
          method: 'POST',
          body: formData
        }
      );

      const updatedData = await response.json().catch(() => null);
      if (!response.ok) {
        const message = Array.isArray(updatedData?.message)
          ? updatedData.message.join(', ')
          : updatedData?.message ?? 'Failed to submit payment';
        throw new Error(message);
      }

      const updatedInvoice: InvoiceRecord = {
        ...(updatedData as InvoiceRecord),
        status: String((updatedData as InvoiceRecord)?.status ?? 'unpaid').toLowerCase() as InvoiceStatus
      };

      setInvoices((prev) =>
        prev.map((invoice) => (invoice.id === updatedInvoice.id ? updatedInvoice : invoice))
      );
      setPayDialogOpen(false);
      setSelectedInvoiceForPayment(null);
      setPaymentSlipFile(null);
      setPaymentSlipFileName('');
      toast({
        title: 'Payment submitted',
        description: 'Status is now Requires Confirmation. Admin will confirm and generate receipt.'
      });
    } catch (error) {
      toast({
        title: 'Submit failed',
        description: error instanceof Error ? error.message : 'Failed to submit payment.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmittingPayment(false);
    }
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
                  <TableHead>Action</TableHead>
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
                      <Badge variant={statusBadgeVariant(invoice.status)}>
                        {formatInvoiceStatus(invoice.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {getCollectionStatusForInvoice(invoice) === 'collected_pending_admin' ? (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                          Requires Confirmation
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className={getCollectionWorkflowStatusClassName(getCollectionStatusForInvoice(invoice))}
                        >
                          {getCollectionWorkflowStatusLabel(getCollectionStatusForInvoice(invoice))}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatDisplayDate(invoice.paidAt, '-')}</TableCell>
                    <TableCell>
                      {canCustomerSelfPay &&
                      (invoice.status === 'unpaid' || invoice.status === 'overdue') &&
                      getCollectionStatusForInvoice(invoice) !== 'collected_pending_admin' ? (
                        <Button size="sm" onClick={() => openPayBillDialog(invoice)}>
                          Pay Bill
                        </Button>
                      ) : invoice.status === 'paid' && (invoice.receiptNo || '').trim() ? (
                        <Button size="sm" variant="outline" onClick={() => handleDownloadReceipt(invoice)}>
                          <Download className="mr-1 h-3 w-3" />
                          Receipt
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-500">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {customerInvoices.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm text-slate-500">
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

        <Dialog
          open={payDialogOpen}
          onOpenChange={(open) => {
            setPayDialogOpen(open);
            if (!open) {
              setSelectedInvoiceForPayment(null);
              setSelectedPaymentAccountId('');
              setPaymentSlipFile(null);
              setPaymentSlipFileName('');
            }
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                Pay Bill {selectedInvoiceForPayment ? `• ${selectedInvoiceForPayment.invoiceNo || selectedInvoiceForPayment.id}` : ''}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-md border bg-slate-50 p-3 text-sm">
                <p>
                  Invoice No:{' '}
                  <span className="font-semibold">
                    {selectedInvoiceForPayment?.invoiceNo || selectedInvoiceForPayment?.id || '-'}
                  </span>
                </p>
                <p className="mt-1">
                  Billing Period:{' '}
                  <span className="font-semibold">
                    {selectedInvoiceForPayment ? getBillingPeriod(selectedInvoiceForPayment) : '-'}
                  </span>
                </p>
                <p className="mt-1">
                  Due Date:{' '}
                  <span className="font-semibold">
                    {formatDisplayDate(selectedInvoiceForPayment?.dueDate, '-')}
                  </span>
                </p>
                <p>
                  Amount:{' '}
                  <span className="font-semibold">
                    {formatMoney(
                      selectedInvoiceForPayment?.totalAmount,
                      selectedInvoiceForPayment?.currency || 'MMK'
                    )}
                  </span>
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  After submit, invoice will be marked as Requires Confirmation until admin confirms.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Payment Type</Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(value: 'wallet' | 'account') => {
                    setPaymentMethod(value);
                    setSelectedPaymentAccountId('');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose payment type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wallet">Wallet</SelectItem>
                    <SelectItem value="account">Bank Account</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{paymentMethod === 'wallet' ? 'Wallet Account' : 'Bank Account'}</Label>
                <Select value={selectedPaymentAccountId} onValueChange={setSelectedPaymentAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose account" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePaymentAccounts.length === 0 ? (
                      <SelectItem value="__none__" disabled>
                        No active {paymentMethod === 'wallet' ? 'wallets' : 'bank accounts'}
                      </SelectItem>
                    ) : (
                      availablePaymentAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.kind === 'wallet'
                            ? `${account.walletType || 'Wallet'} • ${account.accountName} (${account.accountNumber})`
                            : `${account.bankType || 'Bank'} • ${account.accountName} (${account.accountNumber})`}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedPaymentAccount?.qrCodeDataUrl ? (
                <div className="rounded-md border bg-slate-50 p-3">
                  <p className="mb-2 text-xs text-slate-500">Scan QR to pay:</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedPaymentAccount.qrCodeDataUrl}
                    alt="Payment QR"
                    className="mx-auto max-h-56 rounded border bg-white object-contain"
                  />
                </div>
              ) : null}

              <div className="space-y-2">
                <Label>Payment Slip (Image)</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setPaymentSlipFile(file);
                    setPaymentSlipFileName(file?.name ?? '');
                  }}
                />
                {paymentSlipFileName ? (
                  <p className="text-xs text-slate-500">Selected: {paymentSlipFileName}</p>
                ) : (
                  <p className="text-xs text-slate-500">Upload screenshot/photo of completed payment.</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPayDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmitCustomerPayment} disabled={isSubmittingPayment}>
                {isSubmittingPayment ? 'Submitting...' : 'Submit Payment'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
