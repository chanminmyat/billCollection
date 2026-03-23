'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Search,
  DollarSign,
  FileText,
  Users,
  Calendar,
  Eye,
  Phone,
  MapPin
} from 'lucide-react';
import { useAuth } from '../contexts/auth-context';
import Layout from '../components/layout';
import { useToast } from '@/hooks/use-toast';
import { isInvoiceReleased } from '@/lib/invoice-visibility';
import { formatDisplayDate, formatDisplayDateRange } from '@/lib/date-format';
import { appendActivityLog } from '@/lib/activity-log';
import {
  CollectionWorkflowEvent,
  CollectionWorkflowMap,
  CollectionWorkflowRecord,
  CollectionWorkflowStatus,
  COLLECTION_WORKFLOW_STORAGE_KEY,
  COLLECTION_WORKFLOW_UPDATED_EVENT,
  getCollectionWorkflowStatusClassName,
  getCollectionWorkflowStatusLabel,
  readCollectionWorkflowMap,
} from '@/lib/collection-workflow';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
const INVOICE_FORCE_RELEASED_STORAGE_KEY = 'billing_force_released_invoice_ids_v1';

type InvoiceStatus = 'paid' | 'unpaid' | 'overdue' | 'cancelled';

type CollectorCustomer = {
  id: string;
  customerCode?: string;
  billingCycle?: string | null;
  firstInvoiceMode?: string | null;
  personalName?: string | null;
  companyName?: string | null;
  primaryPhone?: string | null;
  installationAddress?: string | null;
  status?: string | null;
  collectorCode?: string | null;
  collectorId?: string | null;
  collector?: {
    id?: string | null;
    collectorCode?: string | null;
  } | null;
  subscription?: {
    plan?: {
      planName?: string | null;
      planCode?: string | null;
      monthlyFee?: string | number | null;
      currency?: string | null;
    } | null;
  } | null;
};

type InvoiceRecord = {
  id: string;
  invoiceNo?: string | null;
  customerId?: string | null;
  customerCode?: string | null;
  invoiceDate?: string | null;
  issuedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  billingPeriodFrom?: string | null;
  billingPeriodTo?: string | null;
  dueDate?: string | null;
  paidAt?: string | null;
  status: InvoiceStatus;
  collectionStatus?: CollectionWorkflowStatus | null;
  collectionUpdatedAt?: string | null;
  collectionEvents?: CollectionWorkflowEvent[] | null;
  totalAmount?: string | number | null;
  currency?: string | null;
  paymentMethod?: string | null;
  receiptNo?: string | null;
  customer?: {
    id?: string | null;
    customerCode?: string | null;
    personalName?: string | null;
    companyName?: string | null;
    primaryPhone?: string | null;
    installationAddress?: string | null;
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

const normalizeInvoiceStatus = (status: string | null | undefined): InvoiceStatus => {
  const normalized = String(status ?? '').trim().toLowerCase();
  if (normalized === 'paid') return 'paid';
  if (normalized === 'overdue') return 'overdue';
  if (normalized === 'cancelled' || normalized === 'canceled') return 'cancelled';
  return 'unpaid';
};

const getCustomerDisplayName = (customer: {
  personalName?: string | null;
  companyName?: string | null;
}) => customer.personalName || customer.companyName || 'Unknown Customer';

const getInvoicePeriodLabel = (invoice: InvoiceRecord) => {
  if (invoice.billingPeriodFrom && invoice.billingPeriodTo) {
    return formatDisplayDateRange(invoice.billingPeriodFrom, invoice.billingPeriodTo);
  }
  return invoice.invoiceNo || invoice.id;
};

const getCustomerInvoiceDate = (invoice: InvoiceRecord) => {
  const candidate =
    invoice.updatedAt ||
    invoice.createdAt ||
    invoice.issuedAt ||
    invoice.invoiceDate ||
    invoice.dueDate ||
    invoice.paidAt;
  if (!candidate) return 0;
  const parsed = Date.parse(candidate);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getInvoiceSequence = (invoice: InvoiceRecord) => {
  const source = invoice.invoiceNo || invoice.id || '';
  const digits = source.replace(/\D/g, '');
  if (!digits) return 0;
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getInvoiceCustomerId = (invoice: InvoiceRecord) =>
  normalizeKey(invoice.customer?.id ?? invoice.customerId ?? null);

const getInvoiceCustomerCode = (invoice: InvoiceRecord) =>
  normalizeKey(invoice.customer?.customerCode ?? invoice.customerCode ?? null);

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

export default function CollectorDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCollectionInvoice, setSelectedCollectionInvoice] = useState<InvoiceRecord | null>(null);
  const [selectedBillDetails, setSelectedBillDetails] = useState<InvoiceRecord | null>(null);
  const [selectedCustomerDetails, setSelectedCustomerDetails] = useState<{
    customer: CollectorCustomer;
    lastInvoice?: InvoiceRecord;
  } | null>(null);
  const [collectionNote, setCollectionNote] = useState('');

  const [customers, setCustomers] = useState<CollectorCustomer[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [collectionMap, setCollectionMap] = useState<CollectionWorkflowMap>({});
  const [forceReleasedInvoiceIds, setForceReleasedInvoiceIds] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [isUpdatingCollection, setIsUpdatingCollection] = useState(false);

  const collectorIdentityKeys = useMemo(() => {
    const keys = new Set<string>();
    const add = (value?: string | null) => {
      const key = normalizeKey(value);
      if (key) keys.add(key);
    };

    add(user?.id);
    add(user?.username);
    add(user?.collectorProfile?.id);
    add(user?.collectorProfile?.collectorCode);

    return keys;
  }, [user?.id, user?.username, user?.collectorProfile?.id, user?.collectorProfile?.collectorCode]);

  useEffect(() => {
    if (!user || user.role !== 'collector') {
      return;
    }

    let mounted = true;

    const fetchData = async () => {
      setIsLoading(true);
      setLoadError('');

      try {
        const [customersResponse, invoicesResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/customers`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          }),
          fetch(`${API_BASE_URL}/billing/invoices`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          })
        ]);

        if (!customersResponse.ok) {
          const data = await customersResponse.json().catch(() => null);
          throw new Error(data?.message ?? 'Failed to load customers');
        }

        if (!invoicesResponse.ok) {
          const data = await invoicesResponse.json().catch(() => null);
          throw new Error(data?.message ?? 'Failed to load invoices');
        }

        const customersData = await customersResponse.json().catch(() => []);
        const invoicesData = await invoicesResponse.json().catch(() => []);

        const customerList = Array.isArray(customersData)
          ? customersData
          : Array.isArray(customersData?.customers)
            ? customersData.customers
            : [];
        const invoiceList = Array.isArray(invoicesData)
          ? invoicesData
          : Array.isArray(invoicesData?.invoices)
            ? invoicesData.invoices
            : [];

        if (!mounted) return;

        const normalizedInvoices = (invoiceList as InvoiceRecord[]).map((invoice) => ({
          ...invoice,
          status: normalizeInvoiceStatus(invoice.status),
        }));

        setCustomers(customerList);
        setInvoices(normalizedInvoices);
      } catch (error) {
        if (!mounted) return;
        setLoadError(error instanceof Error ? error.message : 'Failed to load dashboard data');
        setCustomers([]);
        setInvoices([]);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchData();
    const intervalId = window.setInterval(fetchData, 30_000);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
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

    try {
      const raw = window.localStorage.getItem(INVOICE_FORCE_RELEASED_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      if (parsed && typeof parsed === 'object') {
        setForceReleasedInvoiceIds(parsed);
      }
    } catch {
      // ignore malformed local storage
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (event: StorageEvent) => {
      if (event.key === COLLECTION_WORKFLOW_STORAGE_KEY) {
        refreshCollectionMap();
      }
      if (event.key === INVOICE_FORCE_RELEASED_STORAGE_KEY) {
        try {
          const parsed = event.newValue ? (JSON.parse(event.newValue) as Record<string, boolean>) : {};
          if (parsed && typeof parsed === 'object') {
            setForceReleasedInvoiceIds(parsed);
          }
        } catch {
          // ignore malformed storage payload
        }
      }
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(COLLECTION_WORKFLOW_UPDATED_EVENT, refreshCollectionMap);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(COLLECTION_WORKFLOW_UPDATED_EVENT, refreshCollectionMap);
    };
  }, [refreshCollectionMap]);

  const customerBelongsToCollector = (customer: CollectorCustomer) => {
    const assignmentKeys = [
      customer.collectorCode,
      customer.collectorId,
      customer.collector?.id,
      customer.collector?.collectorCode
    ]
      .map((value) => normalizeKey(value))
      .filter(Boolean);

    if (assignmentKeys.length === 0) return false;
    return assignmentKeys.some((key) => collectorIdentityKeys.has(key));
  };

  const myCustomers = customers.filter(customerBelongsToCollector);
  const myCustomerIdKeys = new Set(myCustomers.map((customer) => normalizeKey(customer.id)).filter(Boolean));
  const myCustomerCodeKeys = new Set(
    myCustomers.map((customer) => normalizeKey(customer.customerCode)).filter(Boolean)
  );

  const invoiceBelongsToCollector = (invoice: InvoiceRecord) => {
    const invoiceCustomerId = getInvoiceCustomerId(invoice);
    const invoiceCustomerCode = getInvoiceCustomerCode(invoice);
    return (
      (invoiceCustomerId && myCustomerIdKeys.has(invoiceCustomerId)) ||
      (invoiceCustomerCode && myCustomerCodeKeys.has(invoiceCustomerCode))
    );
  };

  const releasedInvoices = useMemo(
    () =>
      invoices.filter(
        (invoice) =>
          Boolean(invoice.id && forceReleasedInvoiceIds[invoice.id]) || isInvoiceReleased(invoice),
      ),
    [forceReleasedInvoiceIds, invoices],
  );
  const myInvoicesRaw = releasedInvoices.filter(invoiceBelongsToCollector);
  const myInvoices = useMemo(() => {
    const latestByRevisionKey = new Map<string, InvoiceRecord>();

    for (const invoice of myInvoicesRaw) {
      const normalizedStatus = String(invoice.status ?? '').trim().toLowerCase();
      if (normalizedStatus === 'cancelled' || normalizedStatus === 'canceled') {
        continue;
      }

      const customerKey =
        getInvoiceCustomerId(invoice) || getInvoiceCustomerCode(invoice) || 'unknown-customer';
      const periodKey =
        invoice.billingPeriodFrom && invoice.billingPeriodTo
          ? `${invoice.billingPeriodFrom}::${invoice.billingPeriodTo}`
          : normalizeKey(invoice.invoiceNo) || invoice.id;
      const revisionKey = `${customerKey}::${periodKey}`;

      const existing = latestByRevisionKey.get(revisionKey);
      const currentTimestamp = getCustomerInvoiceDate(invoice);
      const existingTimestamp = existing ? getCustomerInvoiceDate(existing) : -1;
      const currentSequence = getInvoiceSequence(invoice);
      const existingSequence = existing ? getInvoiceSequence(existing) : -1;
      if (
        !existing ||
        currentTimestamp > existingTimestamp ||
        (currentTimestamp === existingTimestamp && currentSequence > existingSequence)
      ) {
        latestByRevisionKey.set(revisionKey, invoice);
      }
    }

    return Array.from(latestByRevisionKey.values()).sort(
      (a, b) => getCustomerInvoiceDate(b) - getCustomerInvoiceDate(a),
    );
  }, [myInvoicesRaw]);
  const dueBills = myInvoices.filter((bill) => bill.status === 'unpaid' || bill.status === 'overdue');

  const filteredCustomers = myCustomers.filter((customer) => {
    const name = getCustomerDisplayName(customer).toLowerCase();
    const phone = customer.primaryPhone?.toLowerCase() || '';
    const code = customer.customerCode?.toLowerCase() || '';
    const query = searchTerm.toLowerCase();
    return name.includes(query) || phone.includes(query) || code.includes(query);
  });

  const todayIso = new Date().toISOString().slice(0, 10);
  const totalAssigned = myCustomers.length;
  const todayCollection = myInvoices
    .filter((invoice) => invoice.status === 'paid' && invoice.paidAt?.slice(0, 10) === todayIso)
    .reduce((sum, invoice) => sum + toNumber(invoice.totalAmount), 0);
  const pendingBills = dueBills.length;
  const overdueBills = myInvoices.filter((bill) => bill.status === 'overdue').length;

  const findCustomerForInvoice = (invoice: InvoiceRecord) => {
    const invoiceCustomerId = getInvoiceCustomerId(invoice);
    const invoiceCustomerCode = getInvoiceCustomerCode(invoice);
    return myCustomers.find((customer) => {
      const customerId = normalizeKey(customer.id);
      const customerCode = normalizeKey(customer.customerCode);
      return (
        (invoiceCustomerId && customerId === invoiceCustomerId) ||
        (invoiceCustomerCode && customerCode === invoiceCustomerCode)
      );
    });
  };

  const getCollectionStatusForInvoice = (invoice: InvoiceRecord): CollectionWorkflowStatus => {
    if (invoice.status === 'paid') return 'completed';
    if (invoice.collectionStatus) return invoice.collectionStatus;
    return collectionMap[invoice.id]?.status ?? 'idle';
  };

  const selectedCollectionStatus: CollectionWorkflowStatus = selectedCollectionInvoice
    ? getCollectionStatusForInvoice(selectedCollectionInvoice)
    : 'idle';
  const selectedCollectionRecord: CollectionWorkflowRecord | null = selectedCollectionInvoice
    ? collectionMap[selectedCollectionInvoice.id] ?? null
    : null;
  const selectedCollectionTimeline =
    selectedCollectionInvoice && Array.isArray(selectedCollectionInvoice.collectionEvents)
      ? selectedCollectionInvoice.collectionEvents
      : selectedCollectionRecord?.events ?? [];

  const applyCollectionAction = async (
    invoice: InvoiceRecord,
    payload: {
      status: CollectionWorkflowStatus;
      type:
        | 'en_route'
        | 'arrived'
        | 'rescheduled'
        | 'office_transfer'
        | 'collector_collected'
        | 'admin_confirmed';
      label: string;
      title: string;
    },
  ) => {
    if (isUpdatingCollection) return;
    setIsUpdatingCollection(true);

    try {
      const response = await fetch(`${API_BASE_URL}/billing/invoices/${invoice.id}/collection-workflow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: payload.status,
          type: payload.type,
          label: payload.label,
          note: collectionNote || undefined,
          actorName: user?.name || undefined,
          actorRole: user?.role || undefined,
        }),
      });

      const updatedData = await response.json().catch(() => null);
      if (!response.ok) {
        const message = Array.isArray(updatedData?.message)
          ? updatedData.message.join(', ')
          : updatedData?.message ?? 'Failed to update collection workflow';
        throw new Error(message);
      }

      const updatedInvoice: InvoiceRecord = {
        ...(updatedData as InvoiceRecord),
        status: normalizeInvoiceStatus((updatedData as InvoiceRecord)?.status),
      };

      setInvoices((prev) =>
        prev.map((item) => (item.id === updatedInvoice.id ? updatedInvoice : item)),
      );

      setSelectedCollectionInvoice((prev) =>
        prev && prev.id === updatedInvoice.id ? updatedInvoice : prev,
      );

      const updatedEvents = Array.isArray(updatedInvoice.collectionEvents)
        ? updatedInvoice.collectionEvents
        : [];
      setCollectionMap((prev) => ({
        ...prev,
        [updatedInvoice.id]: {
          invoiceId: updatedInvoice.id,
          invoiceNo: updatedInvoice.invoiceNo || undefined,
          customerId: updatedInvoice.customer?.id || undefined,
          customerCode: updatedInvoice.customer?.customerCode || undefined,
          status: updatedInvoice.collectionStatus || payload.status,
          updatedAt:
            updatedInvoice.collectionUpdatedAt ||
            updatedEvents[updatedEvents.length - 1]?.timestamp ||
            new Date().toISOString(),
          events: updatedEvents,
        },
      }));

      appendActivityLog({
        module: 'collector',
        action: `collection_${payload.type}`,
        description: payload.label,
        actorId: user?.id,
        actorName: user?.name,
        actorRole: user?.role,
        targetType: 'invoice',
        targetId: invoice.id,
        targetName: invoice.invoiceNo || invoice.id,
        metadata: {
          customerId: invoice.customer?.id,
          customerCode: invoice.customer?.customerCode,
          status: payload.status,
          note: collectionNote || undefined,
        },
      });

      setCollectionNote('');

      toast({
        title: payload.title,
        description: 'Collection log updated successfully.',
      });
    } catch (error) {
      toast({
        title: 'Collection update failed',
        description:
          error instanceof Error ? error.message : 'Failed to update collection workflow.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingCollection(false);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  if (!user || user.role !== 'collector') {
    return <div>Access denied</div>;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Collector Dashboard</h1>
          <p className="text-gray-600">Welcome back, {user.name}</p>
        </div>

        {isLoading && (
          <Card>
            <CardContent className="pt-6 text-sm text-slate-600">Loading invoices and customers...</CardContent>
          </Card>
        )}
        {!!loadError && (
          <Card>
            <CardContent className="pt-6 text-sm text-rose-600">{loadError}</CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assigned Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAssigned}</div>
              <p className="text-xs text-muted-foreground">Total customers assigned</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Collection</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatMoney(todayCollection)}</div>
              <p className="text-xs text-muted-foreground">Collected today</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Bills</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingBills}</div>
              <p className="text-xs text-muted-foreground">Bills to collect</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue Bills</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{overdueBills}</div>
              <p className="text-xs text-muted-foreground">Requires immediate attention</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search customers by name, phone, or code..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Due Bills ({dueBills.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {dueBills.length === 0 ? (
              <p className="text-sm text-slate-500">No unpaid invoices for your assigned customers.</p>
            ) : (
              <div className="space-y-4">
                {dueBills.map((bill) => {
                  const linkedCustomer = findCustomerForInvoice(bill);
                  const collectionStatus = getCollectionStatusForInvoice(bill);
                  const displayName = linkedCustomer
                    ? getCustomerDisplayName(linkedCustomer)
                    : getCustomerDisplayName({
                        personalName: bill.customer?.personalName,
                        companyName: bill.customer?.companyName
                      });

                  return (
                    <div key={bill.id} className="space-y-3 rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-medium">{displayName}</h3>
                          <p className="text-sm text-gray-500">Invoice: {getInvoicePeriodLabel(bill)}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge variant={bill.status === 'overdue' ? 'destructive' : 'secondary'}>
                            {bill.status}
                          </Badge>
                          <Badge
                            variant="secondary"
                            className={getCollectionWorkflowStatusClassName(collectionStatus)}
                          >
                            {getCollectionWorkflowStatusLabel(collectionStatus)}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-2xl font-bold text-green-600">
                          {formatMoney(bill.totalAmount, bill.currency || 'MMK')}
                        </div>
                        <div className="text-sm text-gray-500">Due: {formatDisplayDate(bill.dueDate, '-')}</div>
                      </div>

                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => setSelectedBillDetails(bill)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Details
                        </Button>
                        <Button size="sm" className="flex-1" onClick={() => setSelectedCollectionInvoice(bill)}>
                          Collection Flow
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assigned Customers ({filteredCustomers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredCustomers.length === 0 ? (
              <p className="text-sm text-slate-500">No customers assigned.</p>
            ) : (
              <div className="space-y-4">
                {filteredCustomers.map((customer) => {
                  const customerInvoices = myInvoices
                    .filter((invoice) => {
                      const invoiceCustomerId = normalizeKey(invoice.customer?.id);
                      const invoiceCustomerCode = normalizeKey(invoice.customer?.customerCode);
                      const customerId = normalizeKey(customer.id);
                      const customerCode = normalizeKey(customer.customerCode);
                      return (
                        (invoiceCustomerId && invoiceCustomerId === customerId) ||
                        (invoiceCustomerCode && invoiceCustomerCode === customerCode)
                      );
                    })
                    .sort((a, b) => getCustomerInvoiceDate(b) - getCustomerInvoiceDate(a));

                  const lastInvoice = customerInvoices[0];
                  const packageName =
                    customer.subscription?.plan?.planName ||
                    customer.subscription?.plan?.planCode ||
                    'N/A';
                  const monthlyFee = customer.subscription?.plan?.monthlyFee;

                  return (
                    <div key={customer.id} className="space-y-3 rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-medium">{getCustomerDisplayName(customer)}</h3>
                          <p className="text-sm text-gray-500">{packageName}</p>
                        </div>
                        <Badge variant={customer.status === 'enable' ? 'default' : 'secondary'}>
                          {customer.status || 'unknown'}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-lg font-bold">
                          {formatMoney(monthlyFee, customer.subscription?.plan?.currency || 'MMK')}/month
                        </div>
                        <div className="text-sm text-gray-500">
                          Last Payment: {lastInvoice?.paidAt ? formatDisplayDate(lastInvoice.paidAt, '-') : 'None'}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => setSelectedCustomerDetails({ customer, lastInvoice })}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog
          open={!!selectedCollectionInvoice}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedCollectionInvoice(null);
              setCollectionNote('');
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Collection Workflow</DialogTitle>
            </DialogHeader>
            {selectedCollectionInvoice && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Customer</Label>
                    <p className="font-medium">
                      {getCustomerDisplayName({
                        personalName: selectedCollectionInvoice.customer?.personalName,
                        companyName: selectedCollectionInvoice.customer?.companyName
                      })}
                    </p>
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <p>{selectedCollectionInvoice.customer?.primaryPhone || '-'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Invoice</Label>
                    <p>{getInvoicePeriodLabel(selectedCollectionInvoice)}</p>
                  </div>
                  <div>
                    <Label>Amount</Label>
                    <p className="text-lg font-bold">
                      {formatMoney(selectedCollectionInvoice.totalAmount, selectedCollectionInvoice.currency || 'MMK')}
                    </p>
                  </div>
                </div>

                <div className="rounded-md border bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Current Collection Status</p>
                  <Badge
                    variant="secondary"
                    className={`mt-1 ${getCollectionWorkflowStatusClassName(selectedCollectionStatus)}`}
                  >
                    {getCollectionWorkflowStatusLabel(selectedCollectionStatus)}
                  </Badge>
                </div>

                <div>
                  <Label>Note (optional)</Label>
                  <Input
                    value={collectionNote}
                    onChange={(event) => setCollectionNote(event.target.value)}
                    placeholder="Add optional note for this action"
                  />
                </div>

                <div className="space-y-2">
                  {(selectedCollectionStatus === 'idle' ||
                    selectedCollectionStatus === 'rescheduled') && (
                    <Button
                      className="w-full"
                      disabled={isUpdatingCollection || selectedCollectionInvoice.status === 'paid'}
                      onClick={() =>
                        applyCollectionAction(selectedCollectionInvoice, {
                          status: 'en_route',
                          type: 'en_route',
                          label: 'Collector is on the way to collect payment.',
                          title: 'Collection started',
                        })
                      }
                    >
                      Start Collection
                    </Button>
                  )}

                  {selectedCollectionStatus === 'en_route' && (
                    <Button
                      className="w-full"
                      disabled={isUpdatingCollection || selectedCollectionInvoice.status === 'paid'}
                      onClick={() =>
                        applyCollectionAction(selectedCollectionInvoice, {
                          status: 'arrived',
                          type: 'arrived',
                          label: 'Collector arrived at customer location.',
                          title: 'Arrival recorded',
                        })
                      }
                    >
                      Mark Arrived
                    </Button>
                  )}

                  {selectedCollectionStatus === 'arrived' && (
                    <div className="grid gap-2 md:grid-cols-3">
                      <Button
                        variant="outline"
                        disabled={isUpdatingCollection}
                        onClick={() =>
                          applyCollectionAction(selectedCollectionInvoice, {
                            status: 'rescheduled',
                            type: 'rescheduled',
                            label: 'Collection rescheduled by collector.',
                            title: 'Collection rescheduled',
                          })
                        }
                      >
                        Reschedule
                      </Button>
                      <Button
                        variant="outline"
                        disabled={isUpdatingCollection}
                        onClick={() =>
                          applyCollectionAction(selectedCollectionInvoice, {
                            status: 'office_transfer',
                            type: 'office_transfer',
                            label: 'Customer will transfer payment directly to office.',
                            title: 'Transferred to office flow',
                          })
                        }
                      >
                        Customer Pays Office
                      </Button>
                      <Button
                        disabled={isUpdatingCollection}
                        onClick={() =>
                          applyCollectionAction(selectedCollectionInvoice, {
                            status: 'collected_pending_admin',
                            type: 'collector_collected',
                            label: 'Collector collected payment and handed for admin confirmation.',
                            title: 'Marked as collected',
                          })
                        }
                      >
                        Collected
                      </Button>
                    </div>
                  )}

                  {selectedCollectionStatus === 'collected_pending_admin' && (
                    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      Cash is collected and waiting for admin confirmation.
                    </p>
                  )}

                  {selectedCollectionStatus === 'office_transfer' && (
                    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      Customer chose to pay at office. Waiting for admin payment confirmation.
                    </p>
                  )}

                  {(selectedCollectionStatus === 'completed' || selectedCollectionInvoice.status === 'paid') && (
                    <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                      This invoice is completed.
                    </p>
                  )}
                </div>

                <div className="space-y-2 rounded-md border p-3">
                  <p className="text-sm font-medium text-slate-700">Collection Timeline</p>
                  {selectedCollectionTimeline.length === 0 ? (
                    <p className="text-sm text-slate-500">No collection updates yet.</p>
                  ) : (
                    <div className="max-h-44 space-y-2 overflow-y-auto">
                      {selectedCollectionTimeline
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
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!selectedBillDetails} onOpenChange={(open) => !open && setSelectedBillDetails(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invoice Details</DialogTitle>
            </DialogHeader>
            {selectedBillDetails && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Customer Name</Label>
                    <p className="font-medium">
                      {getCustomerDisplayName({
                        personalName: selectedBillDetails.customer?.personalName,
                        companyName: selectedBillDetails.customer?.companyName
                      })}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Invoice ID</Label>
                    <p className="font-mono text-sm">{selectedBillDetails.invoiceNo || selectedBillDetails.id}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Billing Period</Label>
                    <p>{getInvoicePeriodLabel(selectedBillDetails)}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Due Date</Label>
                    <p>{formatDisplayDate(selectedBillDetails.dueDate, '-')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Amount</Label>
                    <p className="text-2xl font-bold text-green-600">
                      {formatMoney(selectedBillDetails.totalAmount, selectedBillDetails.currency || 'MMK')}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Status</Label>
                    <Badge variant={selectedBillDetails.status === 'overdue' ? 'destructive' : 'secondary'}>
                      {selectedBillDetails.status}
                    </Badge>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-500">Customer Contact</Label>
                  <div className="mt-1 flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span>{selectedBillDetails.customer?.primaryPhone || '-'}</span>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-500">Address</Label>
                  <div className="mt-1 flex items-start space-x-2">
                    <MapPin className="mt-0.5 h-4 w-4 text-gray-400" />
                    <span className="text-sm">{selectedBillDetails.customer?.installationAddress || '-'}</span>
                  </div>
                </div>

                {selectedBillDetails.status !== 'paid' && (
                  <Button
                    onClick={() => {
                      setSelectedCollectionInvoice(selectedBillDetails);
                      setSelectedBillDetails(null);
                    }}
                    className="w-full"
                  >
                    Open Collection Workflow
                  </Button>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog
          open={!!selectedCustomerDetails}
          onOpenChange={(open) => !open && setSelectedCustomerDetails(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Customer Details</DialogTitle>
            </DialogHeader>
            {selectedCustomerDetails && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Customer Name</Label>
                    <p className="font-medium">{getCustomerDisplayName(selectedCustomerDetails.customer)}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Customer Code</Label>
                    <p className="font-mono text-sm">
                      {selectedCustomerDetails.customer.customerCode || selectedCustomerDetails.customer.id}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Package</Label>
                    <p>
                      {selectedCustomerDetails.customer.subscription?.plan?.planName ||
                        selectedCustomerDetails.customer.subscription?.plan?.planCode ||
                        'N/A'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Monthly Fee</Label>
                    <p className="text-lg font-bold">
                      {formatMoney(
                        selectedCustomerDetails.customer.subscription?.plan?.monthlyFee,
                        selectedCustomerDetails.customer.subscription?.plan?.currency || 'MMK'
                      )}
                    </p>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-500">Phone Number</Label>
                  <div className="mt-1 flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span>{selectedCustomerDetails.customer.primaryPhone || '-'}</span>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-500">Address</Label>
                  <div className="mt-1 flex items-start space-x-2">
                    <MapPin className="mt-0.5 h-4 w-4 text-gray-400" />
                    <span className="text-sm">{selectedCustomerDetails.customer.installationAddress || '-'}</span>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-500">Last Payment</Label>
                  <p className="text-sm">
                    {selectedCustomerDetails.lastInvoice?.paidAt
                      ? `${formatDisplayDate(selectedCustomerDetails.lastInvoice.paidAt, '-')} - ${formatMoney(
                          selectedCustomerDetails.lastInvoice.totalAmount,
                          selectedCustomerDetails.lastInvoice.currency || 'MMK'
                        )}`
                      : 'No payment yet'}
                  </p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
