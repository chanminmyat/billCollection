'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Layout from '@/app/components/layout';
import { useAuth } from '@/app/contexts/auth-context';
import { appendActivityLog } from '@/lib/activity-log';
import { formatDisplayDate, formatDisplayDateRange } from '@/lib/date-format';
import {
  fetchSystemBranding,
  readSystemBranding,
  SYSTEM_BRANDING_STORAGE_KEY,
  SYSTEM_BRANDING_UPDATED_EVENT,
} from '@/lib/system-branding';
import type { SystemBranding } from '@/lib/system-branding';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Copy, Download, Eye, Landmark, RefreshCw, Wallet } from 'lucide-react';

type ReceiptPageProps = {
  mode: 'create' | 'list';
};

type ReceiptInvoice = {
  id: string;
  sourceInvoiceId?: string;
  isHistoryRow?: boolean;
  invoiceNo?: string | null;
  invoiceDate?: string | null;
  billingPeriodFrom?: string | null;
  billingPeriodTo?: string | null;
  dueDate?: string | null;
  receiptNo?: string | null;
  receiptStatus?: 'none' | 'issued' | 'cancelled' | string | null;
  paymentMethod?: string | null;
  paidAt?: string | null;
  status?: string | null;
  collectionStatus?: string | null;
  monthlyFee?: string | number | null;
  installationFee?: string | number | null;
  additionalFees?: string | number | null;
  collectionFee?: string | number | null;
  subtotalAmount?: string | number | null;
  plusAmount?: string | number | null;
  minusAmount?: string | number | null;
  totalAmount?: string | number | null;
  currency?: string | null;
  collectionEvents?: Array<{ note?: string | null; label?: string | null; timestamp?: string | null }> | null;
  adjustments?: Array<{
    id?: string | null;
    description?: string | null;
    type?: string | null;
    valueType?: string | null;
    value?: string | number | null;
    amount?: string | number | null;
  }> | null;
  customer?: {
    id?: string | null;
    customerCode?: string | null;
    personalName?: string | null;
    companyName?: string | null;
    primaryPhone?: string | null;
    installationAddress?: string | null;
  } | null;
};

type PaymentAccountKind = 'wallet' | 'account';
type ReceiptPaymentMethodType = 'cash' | PaymentAccountKind | '';

type PaymentAccount = {
  id: string;
  kind: PaymentAccountKind;
  walletType?: string | null;
  bankType?: string | null;
  accountName: string;
  accountNumber: string;
  qrCodeDataUrl?: string | null;
  isActive?: boolean;
};

const amountsMatch = (left: string | number | null | undefined, right: string | number | null | undefined) =>
  Math.abs(toNumber(left) - toNumber(right)) < 0.01;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

const toNumber = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatMoney = (value: string | number | null | undefined, currency = 'MMK') =>
  `${toNumber(value).toLocaleString()} ${currency}`;

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const formatStatus = (value?: string | null) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return 'unpaid';
  if (normalized === 'canceled') return 'cancelled';
  return normalized;
};

const normalizeReceiptStatus = (value?: string | null) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized || normalized === 'none') return 'none';
  if (normalized === 'issued' || normalized === 'active') return 'issued';
  if (normalized === 'canceled' || normalized === 'cancelled' || normalized === 'void') return 'cancelled';
  return normalized;
};

const getCancelledReceiptNosFromEvents = (
  events?: Array<{ note?: string | null; label?: string | null }> | null,
) =>
  (Array.isArray(events) ? events : []).reduce((set, event) => {
    const text = `${String(event?.note ?? '')} ${String(event?.label ?? '')}`;
    const match = text.match(/cancelled\s+receipt\s*:\s*([A-Z0-9-]+)/i);
    const cancelledNo = String(match?.[1] ?? '').trim().toUpperCase();
    if (cancelledNo) set.add(cancelledNo);
    return set;
  }, new Set<string>());

const isReceiptCurrentlyCancelled = (
  invoice: Pick<ReceiptInvoice, 'receiptStatus' | 'receiptNo' | 'collectionEvents'>,
) => {
  const receiptStatus = normalizeReceiptStatus(invoice.receiptStatus);
  if (receiptStatus === 'cancelled') return true;
  if (receiptStatus === 'issued') return false;

  const currentReceiptNo = String(invoice.receiptNo ?? '').trim().toUpperCase();
  const cancelledNos = getCancelledReceiptNosFromEvents(invoice.collectionEvents ?? []);
  if (currentReceiptNo) {
    return cancelledNos.has(currentReceiptNo);
  }
  return cancelledNos.size > 0;
};

const getReceiptStatusLabel = (invoice: Pick<ReceiptInvoice, 'status' | 'receiptStatus' | 'receiptNo'>) => {
  const receiptStatus = normalizeReceiptStatus(invoice.receiptStatus);
  if (receiptStatus === 'cancelled') return 'cancelled receipt';
  if (receiptStatus === 'issued') return 'issued';
  const invoiceStatus = formatStatus(invoice.status);
  if (invoiceStatus === 'cancelled' && Boolean(invoice.receiptNo?.trim())) return 'cancelled receipt';
  if (invoiceStatus === 'paid' && Boolean(invoice.receiptNo?.trim())) return 'issued';
  return invoiceStatus;
};

const formatCollectionStatus = (value?: string | null) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) return '—';
  return normalized
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const isInvoiceEffectivelyPaid = (
  invoice?: Pick<ReceiptInvoice, 'status' | 'receiptStatus'> | null,
) =>
  Boolean(
    invoice &&
      formatStatus(invoice.status) === 'paid' &&
      normalizeReceiptStatus(invoice.receiptStatus) !== 'cancelled',
  );

const statusBadgeClassName = (invoice: Pick<ReceiptInvoice, 'status' | 'receiptStatus' | 'receiptNo'>) => {
  const status = getReceiptStatusLabel(invoice);
  if (status === 'issued') return 'bg-emerald-100 text-emerald-700';
  if (status === 'cancelled receipt') return 'bg-slate-200 text-slate-700';
  if (status === 'paid') return 'bg-emerald-100 text-emerald-700';
  if (status === 'overdue') return 'bg-rose-100 text-rose-700';
  if (status === 'cancelled') return 'bg-slate-200 text-slate-700';
  return 'bg-amber-100 text-amber-700';
};

const formatInvoiceNo = (invoiceNo?: string | null, fallbackId?: string | null) => {
  const rawInvoiceNo = (invoiceNo ?? '').trim();
  if (rawInvoiceNo) {
    if (/^inv-/i.test(rawInvoiceNo)) return rawInvoiceNo.toUpperCase();
    if (/^\d+$/.test(rawInvoiceNo)) return `INV-${rawInvoiceNo}`;
    return rawInvoiceNo;
  }
  return fallbackId ?? '—';
};

const getCustomerName = (invoice: ReceiptInvoice) =>
  invoice.customer?.personalName || invoice.customer?.companyName || 'Unknown Customer';

const resolveInvoiceId = (invoice: Pick<ReceiptInvoice, 'id' | 'sourceInvoiceId'>) =>
  invoice.sourceInvoiceId?.trim() || invoice.id;

const extractErrorMessage = (payload: unknown, fallback: string): string => {
  if (!payload || typeof payload !== 'object') return fallback;
  const data = payload as { message?: string | string[]; error?: string };
  if (Array.isArray(data.message) && data.message.length > 0) return data.message.join(', ');
  if (typeof data.message === 'string' && data.message.trim()) return data.message;
  if (typeof data.error === 'string' && data.error.trim()) return data.error;
  return fallback;
};

const formatPaymentMethodLabel = (account: PaymentAccount) => {
  const provider =
    account.kind === 'wallet'
      ? account.walletType?.trim() || 'Wallet'
      : account.bankType?.trim() || 'Bank';
  const accountName = account.accountName.trim();
  const accountNumber = account.accountNumber.trim();
  return accountNumber
    ? `${provider} - ${accountName} (${accountNumber})`
    : `${provider} - ${accountName}`;
};

const parseCollectionPaymentSummary = (note?: string | null) => {
  const raw = String(note ?? '').trim();
  if (!raw) return null;

  const parts = raw
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);

  const paymentMethodPart = parts.find((part) => part.toLowerCase().startsWith('payment method:'));
  const paymentAccountPart = parts.find((part) => part.toLowerCase().startsWith('payment account:'));

  return {
    paymentMethod: paymentMethodPart ? paymentMethodPart.replace(/^payment method:\s*/i, '').trim() : '',
    paymentAccount: paymentAccountPart ? paymentAccountPart.replace(/^payment account:\s*/i, '').trim() : '',
  };
};

const getLatestCollectionPaymentSummary = (invoice: Pick<ReceiptInvoice, 'collectionEvents'>) => {
  const events = Array.isArray(invoice.collectionEvents) ? invoice.collectionEvents : [];
  for (const event of events.slice().reverse()) {
    const summary = parseCollectionPaymentSummary(event?.note ?? null);
    if (summary?.paymentMethod || summary?.paymentAccount) {
      return summary;
    }
  }
  return null;
};

export default function ReceiptPage({ mode }: ReceiptPageProps) {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [invoiceCandidates, setInvoiceCandidates] = useState<ReceiptInvoice[]>([]);
  const [receipts, setReceipts] = useState<ReceiptInvoice[]>([]);
  const [latestGenerated, setLatestGenerated] = useState<ReceiptInvoice | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [paymentMethodType, setPaymentMethodType] = useState<ReceiptPaymentMethodType>('');
  const [selectedPaymentAccountId, setSelectedPaymentAccountId] = useState('');
  const [confirmAmountInput, setConfirmAmountInput] = useState('');
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  const [isLoadingPaymentAccounts, setIsLoadingPaymentAccounts] = useState(false);
  const [paidAtInput, setPaidAtInput] = useState('');
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptInvoice | null>(null);
  const [isLoadingReceiptDetail, setIsLoadingReceiptDetail] = useState(false);
  const [isDownloadingReceipt, setIsDownloadingReceipt] = useState(false);
  const [isPaymentDetailsOpen, setIsPaymentDetailsOpen] = useState(false);
  const [isCancellingReceiptById, setIsCancellingReceiptById] = useState<Record<string, boolean>>({});
  const [pendingCancelReceipt, setPendingCancelReceipt] = useState<ReceiptInvoice | null>(null);
  const [branding, setBranding] = useState<SystemBranding>(() => readSystemBranding());
  const listInvoiceFilterId = searchParams.get('invoiceId')?.trim() ?? '';
  const confirmCollected = searchParams.get('confirmCollected') === '1';
  const prefilledCollectedPaymentMethod = searchParams.get('paymentMethod')?.trim() ?? '';

  const fetchInvoiceCandidates = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/billing/invoices`, {
      headers: { Accept: 'application/json' },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(extractErrorMessage(payload, 'Failed to load invoices'));
    }
    const list = Array.isArray(payload) ? payload : [];
    return list
      .map((item) => ({
        id: String(item?.id ?? ''),
        invoiceNo: item?.invoiceNo ?? null,
        invoiceDate: item?.invoiceDate ?? null,
        billingPeriodFrom: item?.billingPeriodFrom ?? null,
        billingPeriodTo: item?.billingPeriodTo ?? null,
        dueDate: item?.dueDate ?? null,
        receiptNo: item?.receiptNo ?? null,
        receiptStatus: isReceiptCurrentlyCancelled({
          receiptStatus: item?.receiptStatus,
          receiptNo: item?.receiptNo,
          collectionEvents: item?.collectionEvents,
        })
          ? 'cancelled'
          : normalizeReceiptStatus(item?.receiptStatus),
        paymentMethod: item?.paymentMethod ?? null,
        paidAt: item?.paidAt ?? null,
        status: item?.status ?? null,
        collectionStatus: item?.collectionStatus ?? null,
        monthlyFee: item?.monthlyFee ?? null,
        installationFee: item?.installationFee ?? null,
        additionalFees: item?.additionalFees ?? null,
        collectionFee: item?.collectionFee ?? null,
        subtotalAmount: item?.subtotalAmount ?? null,
        plusAmount: item?.plusAmount ?? null,
        minusAmount: item?.minusAmount ?? null,
        totalAmount: item?.totalAmount ?? null,
        currency: item?.currency ?? 'MMK',
        adjustments: Array.isArray(item?.adjustments) ? item.adjustments : [],
        customer: item?.customer ?? null,
      }))
      .filter(
        (item) =>
          item.id &&
          (() => {
            const invoiceStatus = formatStatus(item.status);
            if (invoiceStatus === 'paid' || invoiceStatus === 'cancelled') return false;
            return true;
          })(),
      );
  }, []);

  const fetchReceipts = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/billing/receipts`, {
      headers: { Accept: 'application/json' },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(extractErrorMessage(payload, 'Failed to load receipt list'));
    }
    const list = Array.isArray(payload) ? payload : [];
    return list
      .flatMap((item) => {
        const base: ReceiptInvoice = {
          id: String(item?.id ?? ''),
          invoiceNo: item?.invoiceNo ?? null,
          invoiceDate: item?.invoiceDate ?? null,
          billingPeriodFrom: item?.billingPeriodFrom ?? null,
          billingPeriodTo: item?.billingPeriodTo ?? null,
          dueDate: item?.dueDate ?? null,
          receiptNo: item?.receiptNo ?? null,
          receiptStatus: normalizeReceiptStatus(item?.receiptStatus),
          paymentMethod: item?.paymentMethod ?? null,
          paidAt: item?.paidAt ?? null,
          status: item?.status ?? null,
          collectionStatus: item?.collectionStatus ?? null,
          monthlyFee: item?.monthlyFee ?? null,
          installationFee: item?.installationFee ?? null,
          additionalFees: item?.additionalFees ?? null,
          collectionFee: item?.collectionFee ?? null,
          subtotalAmount: item?.subtotalAmount ?? null,
          plusAmount: item?.plusAmount ?? null,
          minusAmount: item?.minusAmount ?? null,
          totalAmount: item?.totalAmount ?? null,
          currency: item?.currency ?? 'MMK',
          collectionEvents: Array.isArray(item?.collectionEvents) ? item.collectionEvents : [],
          adjustments: Array.isArray(item?.adjustments) ? item.adjustments : [],
          customer: item?.customer ?? null,
        };
        if (!base.id) return [];

        const historyRows: ReceiptInvoice[] = [];
        const seenCancelledReceiptNos = new Set<string>();
        const currentReceiptNo = String(base.receiptNo ?? '').trim().toUpperCase();
        const events = base.collectionEvents ?? [];
        for (let index = 0; index < events.length; index += 1) {
          const event = events[index];
          const sourceText = `${String(event?.note ?? '')} ${String(event?.label ?? '')}`;
          const match = sourceText.match(/cancelled\s+receipt\s*:\s*([A-Z0-9-]+)/i);
          if (!match?.[1]) continue;
          const cancelledReceiptNo = match[1].toUpperCase();
          if (
            !cancelledReceiptNo ||
            cancelledReceiptNo === currentReceiptNo ||
            seenCancelledReceiptNos.has(cancelledReceiptNo)
          ) {
            continue;
          }
          seenCancelledReceiptNos.add(cancelledReceiptNo);
          historyRows.push({
            ...base,
            id: `${base.id}::cancelled::${cancelledReceiptNo}::${index}`,
            sourceInvoiceId: base.id,
            isHistoryRow: true,
            receiptNo: cancelledReceiptNo,
            receiptStatus: 'cancelled',
            paidAt: event?.timestamp ?? base.paidAt ?? null,
          });
        }
        return [base, ...historyRows];
      })
      .filter((item) => item.id);
  }, []);

  const fetchReceiptDetail = useCallback(async (invoiceId: string) => {
    const response = await fetch(`${API_BASE_URL}/billing/invoices/${invoiceId}`, {
      headers: { Accept: 'application/json' },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(extractErrorMessage(payload, 'Failed to load receipt detail'));
    }

    return {
      id: String(payload?.id ?? invoiceId),
      invoiceNo: payload?.invoiceNo ?? null,
      invoiceDate: payload?.invoiceDate ?? null,
      billingPeriodFrom: payload?.billingPeriodFrom ?? null,
      billingPeriodTo: payload?.billingPeriodTo ?? null,
      dueDate: payload?.dueDate ?? null,
      receiptNo: payload?.receiptNo ?? null,
      receiptStatus: normalizeReceiptStatus(payload?.receiptStatus),
      paymentMethod: payload?.paymentMethod ?? null,
      paidAt: payload?.paidAt ?? null,
      status: payload?.status ?? null,
      collectionStatus: payload?.collectionStatus ?? null,
      monthlyFee: payload?.monthlyFee ?? null,
      installationFee: payload?.installationFee ?? null,
      additionalFees: payload?.additionalFees ?? null,
      collectionFee: payload?.collectionFee ?? null,
      subtotalAmount: payload?.subtotalAmount ?? null,
      plusAmount: payload?.plusAmount ?? null,
      minusAmount: payload?.minusAmount ?? null,
      totalAmount: payload?.totalAmount ?? null,
      currency: payload?.currency ?? 'MMK',
      collectionEvents: Array.isArray(payload?.collectionEvents) ? payload.collectionEvents : [],
      adjustments: Array.isArray(payload?.adjustments) ? payload.adjustments : [],
      customer: payload?.customer ?? null,
    } as ReceiptInvoice;
  }, []);

  const fetchPaymentAccounts = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/billing/payment-accounts`, {
      headers: { Accept: 'application/json' },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(extractErrorMessage(payload, 'Failed to load payment accounts'));
    }

    const list = Array.isArray(payload) ? payload : [];
    return list
      .map((item) => {
        const kindValue: PaymentAccountKind =
          String(item?.kind ?? '').toLowerCase() === 'account' ? 'account' : 'wallet';
        return {
          id: String(item?.id ?? ''),
          kind: kindValue,
          walletType: item?.walletType ?? null,
          bankType: item?.bankType ?? null,
          accountName: String(item?.accountName ?? ''),
          accountNumber: String(item?.accountNumber ?? ''),
          qrCodeDataUrl: item?.qrCodeDataUrl ?? null,
          isActive: Boolean(item?.isActive ?? true),
        } as PaymentAccount;
      })
      .filter((item) => item.id && item.accountName);
  }, []);

  const refreshAll = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const [nextInvoices, nextReceipts] = await Promise.all([fetchInvoiceCandidates(), fetchReceipts()]);
      setInvoiceCandidates(nextInvoices);
      setReceipts(nextReceipts);
      if (selectedInvoiceId && !nextInvoices.some((invoice) => invoice.id === selectedInvoiceId)) {
        setSelectedInvoiceId('');
      }
    } catch (error) {
      toast({
        title: 'Failed to load receipt data',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingData(false);
    }
  }, [fetchInvoiceCandidates, fetchReceipts, selectedInvoiceId, toast]);

  const cancelReceiptInBackend = useCallback(async (invoiceId: string) => {
    const candidates: Array<{ method: 'PATCH' | 'POST'; path: string; body?: Record<string, unknown> }> = [
      { method: 'POST', path: `${API_BASE_URL}/billing/invoices/${invoiceId}/receipt/cancel` },
      { method: 'PATCH', path: `${API_BASE_URL}/billing/invoices/${invoiceId}/receipt/cancel` },
      { method: 'POST', path: `${API_BASE_URL}/billing/receipts/${invoiceId}/cancel` },
      { method: 'PATCH', path: `${API_BASE_URL}/billing/receipts/${invoiceId}/cancel` },
      {
        method: 'PATCH',
        path: `${API_BASE_URL}/billing/invoices/${invoiceId}`,
        body: { status: 'cancelled', receiptStatus: 'cancelled' },
      },
      {
        method: 'PATCH',
        path: `${API_BASE_URL}/billing/invoices/${invoiceId}`,
        body: { status: 'canceled', receiptStatus: 'cancelled' },
      },
      {
        method: 'PATCH',
        path: `${API_BASE_URL}/billing/invoices/${invoiceId}`,
        body: { status: 'cancelled' },
      },
      {
        method: 'PATCH',
        path: `${API_BASE_URL}/billing/invoices/${invoiceId}`,
        body: { status: 'canceled' },
      },
    ];

    let errorMessage = 'Failed to cancel receipt.';
    for (const candidate of candidates) {
      try {
        const response = await fetch(candidate.path, {
          method: candidate.method,
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: candidate.body ? JSON.stringify(candidate.body) : undefined,
        });
        const payload = await response.json().catch(() => null);
        if (response.ok) return true;
        errorMessage = extractErrorMessage(payload, errorMessage);
      } catch {
        // try next endpoint
      }
    }

    throw new Error(errorMessage);
  }, []);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncBranding = () => setBranding(readSystemBranding());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === SYSTEM_BRANDING_STORAGE_KEY) syncBranding();
    };

    fetchSystemBranding()
      .then(setBranding)
      .catch(() => {
        syncBranding();
      });
    window.addEventListener('storage', handleStorage);
    window.addEventListener(SYSTEM_BRANDING_UPDATED_EVENT, syncBranding as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(SYSTEM_BRANDING_UPDATED_EVENT, syncBranding as EventListener);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadPaymentAccounts = async () => {
      setIsLoadingPaymentAccounts(true);
      try {
        const nextAccounts = await fetchPaymentAccounts();
        if (!active) return;
        setPaymentAccounts(nextAccounts);
      } catch {
        if (!active) return;
        setPaymentAccounts([]);
      } finally {
        if (active) {
          setIsLoadingPaymentAccounts(false);
        }
      }
    };

    void loadPaymentAccounts();
    return () => {
      active = false;
    };
  }, [fetchPaymentAccounts]);

  useEffect(() => {
    const querySearch = searchParams.get('q')?.trim() ?? '';
    if (mode === 'list' && querySearch) {
      setSearch(querySearch);
    }
  }, [mode, searchParams]);

  useEffect(() => {
    if (mode !== 'create') return;
    const invoiceId = searchParams.get('invoiceId')?.trim() ?? '';
    if (!invoiceId) return;
    if (invoiceCandidates.some((invoice) => invoice.id === invoiceId)) {
      setSelectedInvoiceId(invoiceId);
    }
  }, [invoiceCandidates, mode, searchParams]);

  const selectedInvoice = useMemo(
    () => invoiceCandidates.find((invoice) => invoice.id === selectedInvoiceId) ?? null,
    [invoiceCandidates, selectedInvoiceId],
  );
  const isConfirmAmountMatched = useMemo(() => {
    if (!confirmCollected || !selectedInvoice || isInvoiceEffectivelyPaid(selectedInvoice)) {
      return true;
    }
    if (!confirmAmountInput.trim()) return false;
    return amountsMatch(confirmAmountInput, selectedInvoice.totalAmount);
  }, [confirmAmountInput, confirmCollected, selectedInvoice]);
  const selectedInvoiceReceiptLabel = selectedInvoice
    ? getReceiptStatusLabel(selectedInvoice)
    : '';
  const isSelectedInvoiceReceiptIssued = selectedInvoiceReceiptLabel === 'issued';

  const activePaymentAccounts = useMemo(
    () => paymentAccounts.filter((account) => account.isActive !== false),
    [paymentAccounts],
  );
  const availablePaymentAccounts = useMemo(() => {
    if (paymentMethodType !== 'wallet' && paymentMethodType !== 'account') return [];
    return activePaymentAccounts.filter((account) => account.kind === paymentMethodType);
  }, [activePaymentAccounts, paymentMethodType]);
  const selectedPaymentAccount = useMemo(
    () => availablePaymentAccounts.find((account) => account.id === selectedPaymentAccountId) ?? null,
    [availablePaymentAccounts, selectedPaymentAccountId],
  );
  const hasSelectedPaymentMethod =
    paymentMethodType === 'cash' || paymentMethodType === 'wallet' || paymentMethodType === 'account';
  const requiresPaymentAccount = paymentMethodType === 'wallet' || paymentMethodType === 'account';
  const resolvedPaymentMethod = useMemo(() => {
    if (paymentMethodType === 'cash') return 'Cash';
    if (requiresPaymentAccount && selectedPaymentAccount) {
      return formatPaymentMethodLabel(selectedPaymentAccount);
    }
    return '';
  }, [paymentMethodType, requiresPaymentAccount, selectedPaymentAccount]);

  useEffect(() => {
    if (!selectedInvoice) {
      setPaymentMethodType('');
      setSelectedPaymentAccountId('');
      setPaidAtInput('');
      setConfirmAmountInput('');
      setIsPaymentDetailsOpen(false);
      return;
    }
    const matchedAccount = activePaymentAccounts.find(
      (account) => formatPaymentMethodLabel(account) === prefilledCollectedPaymentMethod,
    );
    if (confirmCollected && prefilledCollectedPaymentMethod) {
      if (matchedAccount) {
        setPaymentMethodType(matchedAccount.kind);
        setSelectedPaymentAccountId(matchedAccount.id);
      } else if (prefilledCollectedPaymentMethod.toLowerCase() === 'cash') {
        setPaymentMethodType('cash');
        setSelectedPaymentAccountId('');
      } else {
        setPaymentMethodType('');
        setSelectedPaymentAccountId('');
      }
    } else {
      setPaymentMethodType('');
      setSelectedPaymentAccountId('');
    }
    setPaidAtInput(selectedInvoice.paidAt ? selectedInvoice.paidAt.slice(0, 16) : '');
    setConfirmAmountInput('');
    setIsPaymentDetailsOpen(false);
  }, [activePaymentAccounts, confirmCollected, prefilledCollectedPaymentMethod, selectedInvoice]);

  useEffect(() => {
    if (paymentMethodType === 'cash' || !selectedPaymentAccount) {
      setIsPaymentDetailsOpen(false);
    }
  }, [paymentMethodType, selectedPaymentAccount]);

  const filteredReceipts = useMemo(() => {
    const byInvoice =
      listInvoiceFilterId.length > 0
        ? receipts.filter(
            (item) =>
              String(item.id ?? '').trim() === listInvoiceFilterId ||
              String(item.sourceInvoiceId ?? '').trim() === listInvoiceFilterId,
          )
        : receipts;
    const keyword = search.trim().toLowerCase();
    if (!keyword) return byInvoice;
    return byInvoice.filter((item) => {
      const customerName = getCustomerName(item).toLowerCase();
      const customerCode = String(item.customer?.customerCode ?? '').toLowerCase();
      const receiptNo = String(item.receiptNo ?? '').toLowerCase();
      const invoiceNo = formatInvoiceNo(item.invoiceNo, item.id).toLowerCase();
      const paymentMethod = String(item.paymentMethod ?? '').toLowerCase();
      return (
        customerName.includes(keyword) ||
        customerCode.includes(keyword) ||
        receiptNo.includes(keyword) ||
        invoiceNo.includes(keyword) ||
        paymentMethod.includes(keyword)
      );
    });
  }, [listInvoiceFilterId, receipts, search]);

  const generateReceipt = async () => {
    if (!selectedInvoiceId) {
      toast({
        title: 'Please select an invoice',
        variant: 'destructive',
      });
      return;
    }
    if (
      selectedInvoice &&
      formatStatus(selectedInvoice.status) === 'cancelled' &&
      getReceiptStatusLabel(selectedInvoice) !== 'cancelled receipt'
    ) {
      toast({
        title: 'Cannot create receipt',
        description: 'Cancelled invoices cannot create receipt.',
        variant: 'destructive',
      });
      return;
    }
    const effectiveCollectedPaymentMethod =
      confirmCollected && prefilledCollectedPaymentMethod
        ? prefilledCollectedPaymentMethod
        : resolvedPaymentMethod.trim();

    if (selectedInvoice && !isInvoiceEffectivelyPaid(selectedInvoice) && !effectiveCollectedPaymentMethod) {
      toast({
        title: 'Payment method is required',
        description: confirmCollected
          ? 'Collected payment method is missing. Please go back and collect again.'
          : 'Please choose cash, wallet, or account.',
        variant: 'destructive',
      });
      return;
    }
    if (
      selectedInvoice &&
      !isInvoiceEffectivelyPaid(selectedInvoice) &&
      requiresPaymentAccount &&
      !selectedPaymentAccount
    ) {
      toast({
        title: 'Payment method is required',
        description: 'Please select payment account for selected payment method.',
        variant: 'destructive',
      });
      return;
    }
    if (selectedInvoice && !isInvoiceEffectivelyPaid(selectedInvoice) && !effectiveCollectedPaymentMethod) {
      toast({
        title: 'Payment method is required',
        description: 'Please complete payment method step.',
        variant: 'destructive',
      });
      return;
    }
    setIsGenerating(true);
    try {
      const requestBody: Record<string, string> = {};
      if (effectiveCollectedPaymentMethod.trim()) requestBody.paymentMethod = effectiveCollectedPaymentMethod.trim();
      if (paidAtInput.trim()) requestBody.paidAt = new Date(paidAtInput).toISOString();

      const response = await fetch(`${API_BASE_URL}/billing/invoices/${selectedInvoiceId}/receipt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(extractErrorMessage(payload, 'Failed to generate receipt'));
      }

      const generated: ReceiptInvoice = {
        id: String(payload?.id ?? selectedInvoiceId),
        invoiceNo: payload?.invoiceNo ?? selectedInvoice?.invoiceNo ?? null,
        receiptNo: payload?.receiptNo ?? null,
        paymentMethod:
          payload?.paymentMethod ?? effectiveCollectedPaymentMethod ?? selectedInvoice?.paymentMethod ?? null,
        paidAt: payload?.paidAt ?? selectedInvoice?.paidAt ?? null,
        status: payload?.status ?? selectedInvoice?.status ?? 'paid',
        totalAmount: payload?.totalAmount ?? selectedInvoice?.totalAmount ?? null,
        currency: payload?.currency ?? selectedInvoice?.currency ?? 'MMK',
        customer: payload?.customer ?? selectedInvoice?.customer ?? null,
      };

      setLatestGenerated(generated);
      await refreshAll();

      appendActivityLog({
        module: 'billing',
        action: 'receipt_generated',
        description: `Generated receipt ${generated.receiptNo ?? '—'}`,
        actorId: user?.id,
        actorName: user?.name,
        actorRole: user?.role,
        targetType: 'invoice',
        targetId: selectedInvoiceId,
        targetName: formatInvoiceNo(generated.invoiceNo, generated.id),
        metadata: {
          receiptNo: generated.receiptNo ?? null,
          paymentMethod: generated.paymentMethod ?? null,
        },
      });

      toast({
        title: 'Receipt generated',
        description: generated.receiptNo
          ? `Receipt ID: ${generated.receiptNo}`
          : 'Receipt created successfully.',
      });
    } catch (error) {
      toast({
        title: 'Generate receipt failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const cancelReceipt = async (receipt: ReceiptInvoice) => {
    if (isCancellingReceiptById[receipt.id]) return;
    if (receipt.isHistoryRow) {
      toast({
        title: 'History row',
        description: 'Cancelled history receipt cannot be cancelled again.',
      });
      return;
    }
    const status = formatStatus(receipt.status);
    const receiptStatusLabel = getReceiptStatusLabel(receipt);
    if (status === 'cancelled' || receiptStatusLabel === 'cancelled receipt') {
      toast({
        title: 'Already cancelled',
        description: 'This receipt is already cancelled.',
      });
      return;
    }

    setIsCancellingReceiptById((prev) => ({ ...prev, [receipt.id]: true }));
    try {
      const invoiceId = resolveInvoiceId(receipt);
      await cancelReceiptInBackend(invoiceId);

      setReceipts((prev) =>
        prev.map((item) =>
          item.id === receipt.id ? { ...item, status: 'unpaid', receiptStatus: 'cancelled' } : item,
        ),
      );
      setInvoiceCandidates((prev) =>
        prev.map((item) =>
          item.id === receipt.id ? { ...item, status: 'unpaid', receiptStatus: 'cancelled' } : item,
        ),
      );
      setSelectedReceipt((prev) =>
        prev && prev.id === receipt.id
          ? { ...prev, status: 'unpaid', receiptStatus: 'cancelled' }
          : prev,
      );

      appendActivityLog({
        module: 'billing',
        action: 'receipt_cancelled',
        description: `Cancelled receipt ${receipt.receiptNo || '—'}`,
        actorId: user?.id,
        actorName: user?.name,
        actorRole: user?.role,
        targetType: 'invoice',
        targetId: invoiceId,
        targetName: formatInvoiceNo(receipt.invoiceNo, invoiceId),
        metadata: {
          receiptNo: receipt.receiptNo ?? null,
          receiptStatus: 'cancelled',
        },
      });

      toast({
        title: 'Receipt cancelled',
        description: 'Receipt status changed to cancelled.',
      });
      await refreshAll();
    } catch (error) {
      toast({
        title: 'Cancel receipt failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCancellingReceiptById((prev) => ({ ...prev, [receipt.id]: false }));
    }
  };

  const requestCancelReceipt = (receipt: ReceiptInvoice) => {
    if (isCancellingReceiptById[receipt.id]) return;
    if (receipt.isHistoryRow) return;
    if (getReceiptStatusLabel(receipt) === 'cancelled receipt') return;
    setPendingCancelReceipt(receipt);
  };

  const copyPaymentText = async (value: string, label: string) => {
    const normalized = value.trim();
    if (!normalized) return;
    try {
      await navigator.clipboard.writeText(normalized);
      toast({
        title: `${label} copied`,
      });
    } catch {
      toast({
        title: 'Copy failed',
        description: `Unable to copy ${label.toLowerCase()}.`,
        variant: 'destructive',
      });
    }
  };

  const openReceiptDetail = async (invoiceId: string) => {
    if (!invoiceId) return;
    setReceiptDialogOpen(true);
    setIsLoadingReceiptDetail(true);
    try {
      const detail = await fetchReceiptDetail(invoiceId);
      setSelectedReceipt(detail);
    } catch (error) {
      toast({
        title: 'Failed to load receipt',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
      setReceiptDialogOpen(false);
    } finally {
      setIsLoadingReceiptDetail(false);
    }
  };

  const exportReceiptPdf = async (target?: ReceiptInvoice | string) => {
    const invoiceId =
      typeof target === 'string'
        ? target
        : typeof target === 'object' && target
          ? target.id
          : selectedReceipt?.id;
    if (!invoiceId) return;
    setIsDownloadingReceipt(true);
    try {
      const detail = await fetchReceiptDetail(invoiceId);
      setSelectedReceipt(detail);

      const customerName = getCustomerName(detail);
      const customerCode = detail.customer?.customerCode || '—';
      const customerPhone = detail.customer?.primaryPhone || '—';
      const customerAddress = detail.customer?.installationAddress || '—';
      const currency = detail.currency || 'MMK';
      const receiptNo = detail.receiptNo || '__________';
      const invoiceNo = formatInvoiceNo(detail.invoiceNo, detail.id);
      const collectionPaymentSummary = getLatestCollectionPaymentSummary(detail);
      const resolvedPaymentMethod = detail.paymentMethod || collectionPaymentSummary?.paymentMethod || '—';
      const resolvedPaymentAccount = collectionPaymentSummary?.paymentAccount || '—';
      const receiptCompanyName = branding.receiptCompanyName || branding.systemName;
      const receiptAddress = branding.receiptAddress || '—';
      const receiptPhone = branding.receiptPhone || '—';
      const receiptEmail = branding.receiptEmail;
      const receiptFooterText = branding.footerText;
      const receiptLogoHtml = branding.logoDataUrl
        ? `<img class="company-logo" src="${escapeHtml(branding.logoDataUrl)}" alt="${escapeHtml(
            receiptCompanyName,
          )} logo" />`
        : '';

      let rowNo = 1;
      const rows: string[] = [];
      if (toNumber(detail.monthlyFee) > 0) {
        rows.push(`
          <tr>
            <td>${rowNo++}</td>
            <td>Monthly Internet Fee</td>
            <td class="right">1</td>
            <td class="right">${escapeHtml(formatMoney(detail.monthlyFee, currency))}</td>
            <td class="right">${escapeHtml(formatMoney(detail.monthlyFee, currency))}</td>
          </tr>
        `);
      }
      if (toNumber(detail.installationFee) > 0) {
        rows.push(`
          <tr>
            <td>${rowNo++}</td>
            <td>Installation Fee</td>
            <td class="right">1</td>
            <td class="right">${escapeHtml(formatMoney(detail.installationFee, currency))}</td>
            <td class="right">${escapeHtml(formatMoney(detail.installationFee, currency))}</td>
          </tr>
        `);
      }
      if (toNumber(detail.additionalFees) > 0) {
        rows.push(`
          <tr>
            <td>${rowNo++}</td>
            <td>Additional Fee</td>
            <td class="right">1</td>
            <td class="right">${escapeHtml(formatMoney(detail.additionalFees, currency))}</td>
            <td class="right">${escapeHtml(formatMoney(detail.additionalFees, currency))}</td>
          </tr>
        `);
      }
      if (toNumber(detail.collectionFee) > 0) {
        rows.push(`
          <tr>
            <td>${rowNo++}</td>
            <td>Collection Fee</td>
            <td class="right">1</td>
            <td class="right">${escapeHtml(formatMoney(detail.collectionFee, currency))}</td>
            <td class="right">${escapeHtml(formatMoney(detail.collectionFee, currency))}</td>
          </tr>
        `);
      }
      for (const adjustment of detail.adjustments || []) {
        rows.push(`
          <tr>
            <td>${rowNo++}</td>
            <td>${escapeHtml(String(adjustment.description || 'Adjustment'))}</td>
            <td class="right">1</td>
            <td class="right">${
              String(adjustment.valueType || '').toLowerCase() === 'percent'
                ? `${escapeHtml(toNumber(adjustment.value).toString())}%`
                : escapeHtml(formatMoney(adjustment.value, currency))
            }</td>
            <td class="right">${
              String(adjustment.type || '').toLowerCase() === 'minus' ? '-' : ''
            }${escapeHtml(formatMoney(adjustment.amount, currency))}</td>
          </tr>
        `);
      }
      if (rows.length === 0) {
        rows.push(`
          <tr>
            <td>1</td>
            <td>Invoice Amount</td>
            <td class="right">1</td>
            <td class="right">${escapeHtml(formatMoney(detail.totalAmount, currency))}</td>
            <td class="right">${escapeHtml(formatMoney(detail.totalAmount, currency))}</td>
          </tr>
        `);
      }

      const html = `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>${escapeHtml(receiptNo)} - Receipt</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 0; color: #111827; }
              .page { max-width: 980px; margin: 24px auto; border: 2px solid #111827; padding: 20px; }
              h1 { text-align: center; margin: 0 0 20px; font-size: 42px; letter-spacing: 0.5px; }
              .section { margin-top: 18px; font-size: 14px; line-height: 1.55; }
              .title { font-weight: 700; margin-bottom: 8px; }
              .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
              table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 14px; }
              th, td { border: 1px solid #111827; padding: 6px 8px; }
              th { background: #f3f4f6; }
              .right { text-align: right; }
              .bold { font-weight: 700; }
              .total { font-size: 16px; font-weight: 700; }
              .company-header { display: flex; gap: 12px; align-items: flex-start; }
              .company-logo { width: 56px; height: 56px; object-fit: contain; border: 1px solid #e5e7eb; border-radius: 8px; padding: 4px; }
              .footer { text-align: center; color: #4b5563; }
              @media print { .page { margin: 0; border-width: 1px; } }
            </style>
          </head>
          <body>
            <div class="page">
              <h1>Receipt</h1>

              <div class="section company-header">
                ${receiptLogoHtml}
                <div>
                  <div class="bold">${escapeHtml(receiptCompanyName)}</div>
                  <div>${escapeHtml(receiptAddress)}</div>
                  <div>${escapeHtml(receiptPhone)}</div>
                  ${receiptEmail ? `<div>${escapeHtml(receiptEmail)}</div>` : ''}
                </div>
              </div>

              <div class="section grid">
                <div>
                  <div class="title">Receipt Information</div>
                  <div>Receipt No: ${escapeHtml(receiptNo)}</div>
                  <div>Invoice No: ${escapeHtml(invoiceNo)}</div>
                  <div>Invoice Date: ${escapeHtml(formatDisplayDate(detail.invoiceDate))}</div>
                  <div>Status: ${escapeHtml(formatStatus(detail.status))}</div>
                </div>
                <div>
                  <div class="title">Customer Information</div>
                  <div>Customer ID: ${escapeHtml(customerCode)}</div>
                  <div>Customer Name: ${escapeHtml(customerName)}</div>
                  <div>Phone No: ${escapeHtml(customerPhone)}</div>
                  <div>Address: ${escapeHtml(customerAddress)}</div>
                  <div>Billing Period: ${escapeHtml(formatDisplayDate(detail.billingPeriodFrom))} - ${escapeHtml(
                    formatDisplayDate(detail.billingPeriodTo),
                  )}</div>
                </div>
              </div>

              <div class="section">
                <div class="title">Charges Details</div>
                <table>
                  <thead>
                    <tr>
                      <th style="width: 10%">No</th>
                      <th>Description</th>
                      <th style="width: 10%">Qty</th>
                      <th style="width: 20%">Unit Price</th>
                      <th style="width: 20%">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rows.join('')}
                    <tr>
                      <td colspan="4" class="right total">Total Amount</td>
                      <td class="right total">${escapeHtml(formatMoney(detail.totalAmount, currency))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div class="section">
                <div class="title">Payment Information</div>
                <div>Payment Method: ${escapeHtml(resolvedPaymentMethod)}</div>
                <div>Payment Account: ${escapeHtml(resolvedPaymentAccount)}</div>
                <div>Payment Status: ${escapeHtml(formatStatus(detail.status))}</div>
                <div>Collection Status: ${escapeHtml(formatCollectionStatus(detail.collectionStatus))}</div>
                <div>Payment Date: ${escapeHtml(formatDisplayDate(detail.paidAt))}</div>
                <div>Receipt No: ${escapeHtml(receiptNo)}</div>
              </div>
              ${receiptFooterText ? `<div class="section footer">${escapeHtml(receiptFooterText)}</div>` : ''}
            </div>
          </body>
        </html>
      `;

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast({
          title: 'Popup blocked',
          description: 'Please allow popups to export receipt as PDF.',
          variant: 'destructive',
        });
        return;
      }
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    } catch (error) {
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Failed to export receipt.',
        variant: 'destructive',
      });
    } finally {
      setIsDownloadingReceipt(false);
    }
  };

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
            <h1 className="text-3xl font-bold text-slate-900">Receipt Management</h1>
            <p className="text-slate-600">
              Generate and track receipts. For unpaid invoices, confirm payment here and create receipt in one step.
            </p>
          </div>
          <Button variant="outline" onClick={() => void refreshAll()} disabled={isLoadingData}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingData ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Receipt Menu</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant={mode === 'create' ? 'default' : 'outline'} asChild>
              <Link href="/admin/billing/receipt/create">Create Receipt</Link>
            </Button>
            <Button variant={mode === 'list' ? 'default' : 'outline'} asChild>
              <Link href="/admin/billing/receipt/list">Receipt List</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin/billing?tab=invoice-list">Invoice List</Link>
            </Button>
          </CardContent>
        </Card>

        {mode === 'create' ? (
          <Card>
            <CardHeader>
              <CardTitle>Create Receipt</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Invoice</Label>
                <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select invoice" />
                  </SelectTrigger>
                  <SelectContent>
                    {invoiceCandidates.length === 0 ? (
                      <SelectItem value="__none__" disabled>
                        No invoices found
                      </SelectItem>
                    ) : (
                      invoiceCandidates.map((invoice) => (
                        <SelectItem key={invoice.id} value={invoice.id}>
                          {formatInvoiceNo(invoice.invoiceNo, invoice.id)} • {getCustomerName(invoice)} •{' '}
                          {formatStatus(invoice.status)}
                          {invoice.receiptNo ? ` • ${invoice.receiptNo}` : ''}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedInvoice && (
                <div className="space-y-4 rounded-lg border border-slate-300 bg-white p-5 text-slate-900">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-semibold">Invoice Preview</h3>
                    <Badge variant="secondary" className={statusBadgeClassName(selectedInvoice)}>
                      {getReceiptStatusLabel(selectedInvoice)}
                    </Badge>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1 text-sm text-slate-700">
                      <p>
                        Invoice: <span className="font-medium">{formatInvoiceNo(selectedInvoice.invoiceNo, selectedInvoice.id)}</span>
                      </p>
                      <p>
                        Invoice Date: <span className="font-medium">{formatDisplayDate(selectedInvoice.invoiceDate)}</span>
                      </p>
                      <p>
                        Billing Period:{' '}
                        <span className="font-medium">
                          {formatDisplayDateRange(selectedInvoice.billingPeriodFrom, selectedInvoice.billingPeriodTo)}
                        </span>
                      </p>
                      <p>
                        Due Date: <span className="font-medium">{formatDisplayDate(selectedInvoice.dueDate)}</span>
                      </p>
                    </div>
                    <div className="space-y-1 text-sm text-slate-700">
                      <p>
                        Customer: <span className="font-medium">{getCustomerName(selectedInvoice)}</span>
                      </p>
                      <p>
                        Customer Code:{' '}
                        <span className="font-medium">{selectedInvoice.customer?.customerCode || '—'}</span>
                      </p>
                      <p>
                        Phone: <span className="font-medium">{selectedInvoice.customer?.primaryPhone || '—'}</span>
                      </p>
                      <p>
                        Current Payment Method:{' '}
                        <span className="font-medium">{selectedInvoice.paymentMethod || '—'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>No</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Unit Price</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {toNumber(selectedInvoice.monthlyFee) > 0 && (
                          <TableRow>
                            <TableCell>1</TableCell>
                            <TableCell>Monthly Internet Fee</TableCell>
                            <TableCell className="text-right">1</TableCell>
                            <TableCell className="text-right">
                              {formatMoney(selectedInvoice.monthlyFee, selectedInvoice.currency || 'MMK')}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatMoney(selectedInvoice.monthlyFee, selectedInvoice.currency || 'MMK')}
                            </TableCell>
                          </TableRow>
                        )}
                        {toNumber(selectedInvoice.installationFee) > 0 && (
                          <TableRow>
                            <TableCell>{toNumber(selectedInvoice.monthlyFee) > 0 ? 2 : 1}</TableCell>
                            <TableCell>Installation Fee</TableCell>
                            <TableCell className="text-right">1</TableCell>
                            <TableCell className="text-right">
                              {formatMoney(selectedInvoice.installationFee, selectedInvoice.currency || 'MMK')}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatMoney(selectedInvoice.installationFee, selectedInvoice.currency || 'MMK')}
                            </TableCell>
                          </TableRow>
                        )}
                        {toNumber(selectedInvoice.additionalFees) > 0 && (
                          <TableRow>
                            <TableCell>
                              {1 +
                                (toNumber(selectedInvoice.monthlyFee) > 0 ? 1 : 0) +
                                (toNumber(selectedInvoice.installationFee) > 0 ? 1 : 0)}
                            </TableCell>
                            <TableCell>Additional Fee</TableCell>
                            <TableCell className="text-right">1</TableCell>
                            <TableCell className="text-right">
                              {formatMoney(selectedInvoice.additionalFees, selectedInvoice.currency || 'MMK')}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatMoney(selectedInvoice.additionalFees, selectedInvoice.currency || 'MMK')}
                            </TableCell>
                          </TableRow>
                        )}
                        {toNumber(selectedInvoice.collectionFee) > 0 && (
                          <TableRow>
                            <TableCell>
                              {1 +
                                (toNumber(selectedInvoice.monthlyFee) > 0 ? 1 : 0) +
                                (toNumber(selectedInvoice.installationFee) > 0 ? 1 : 0) +
                                (toNumber(selectedInvoice.additionalFees) > 0 ? 1 : 0)}
                            </TableCell>
                            <TableCell>Collection Fee</TableCell>
                            <TableCell className="text-right">1</TableCell>
                            <TableCell className="text-right">
                              {formatMoney(selectedInvoice.collectionFee, selectedInvoice.currency || 'MMK')}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatMoney(selectedInvoice.collectionFee, selectedInvoice.currency || 'MMK')}
                            </TableCell>
                          </TableRow>
                        )}
                        {selectedInvoice.adjustments?.map((adjustment, index) => (
                          <TableRow key={`${adjustment.id || adjustment.description || 'adj'}-${index}`}>
                            <TableCell>
                              {1 +
                                (toNumber(selectedInvoice.monthlyFee) > 0 ? 1 : 0) +
                                (toNumber(selectedInvoice.installationFee) > 0 ? 1 : 0) +
                                (toNumber(selectedInvoice.additionalFees) > 0 ? 1 : 0) +
                                (toNumber(selectedInvoice.collectionFee) > 0 ? 1 : 0) +
                                index}
                            </TableCell>
                            <TableCell>{adjustment.description || 'Adjustment'}</TableCell>
                            <TableCell className="text-right">1</TableCell>
                            <TableCell className="text-right">
                              {String(adjustment.valueType || '').toLowerCase() === 'percent'
                                ? `${toNumber(adjustment.value)}%`
                                : formatMoney(adjustment.value, selectedInvoice.currency || 'MMK')}
                            </TableCell>
                            <TableCell className="text-right">
                              {String(adjustment.type || '').toLowerCase() === 'minus' ? '-' : ''}
                              {formatMoney(adjustment.amount, selectedInvoice.currency || 'MMK')}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow>
                          <TableCell colSpan={4} className="text-right font-semibold">
                            Total Amount
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatMoney(selectedInvoice.totalAmount, selectedInvoice.currency || 'MMK')}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {selectedInvoice && !isInvoiceEffectivelyPaid(selectedInvoice) && (
                <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <h4 className="font-semibold text-amber-900">Payment Flow</h4>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-1">
                      <Label>Payment Method</Label>
                      {confirmCollected ? (
                        <>
                          <Input value={prefilledCollectedPaymentMethod || '—'} readOnly />
                          <p className="text-xs text-slate-500">
                            Auto-filled from collected payment information.
                          </p>
                        </>
                      ) : (
                        <>
                          <Select
                            value={paymentMethodType || undefined}
                            onValueChange={(value) => {
                              const nextType: ReceiptPaymentMethodType =
                                value === 'wallet' || value === 'account' || value === 'cash'
                                  ? value
                                  : '';
                              setPaymentMethodType(nextType);
                              setSelectedPaymentAccountId('');
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Choose method" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cash">Cash</SelectItem>
                              <SelectItem value="wallet">Wallet</SelectItem>
                              <SelectItem value="account">Account</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-slate-500">
                            {isLoadingPaymentAccounts
                              ? 'Loading methods from payment config...'
                              : 'Choose payment method for this receipt.'}
                          </p>
                        </>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label>Payment Account</Label>
                      <Select
                        value={selectedPaymentAccountId}
                        onValueChange={setSelectedPaymentAccountId}
                        disabled={!requiresPaymentAccount || confirmCollected}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              requiresPaymentAccount ? 'Choose account' : 'Not required for cash'
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {availablePaymentAccounts.length === 0 ? (
                            <SelectItem value="__no_accounts__" disabled>
                              {isLoadingPaymentAccounts
                                ? 'Loading payment accounts...'
                                : 'No active accounts for selected method'}
                            </SelectItem>
                          ) : (
                            availablePaymentAccounts.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                {formatPaymentMethodLabel(account)}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label>Paid At</Label>
                      <Input
                        type="datetime-local"
                        value={paidAtInput}
                        onChange={(event) => setPaidAtInput(event.target.value)}
                      />
                    </div>
                  </div>

                  {confirmCollected && (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label>Invoice Total</Label>
                        <Input
                          value={formatMoney(selectedInvoice.totalAmount, selectedInvoice.currency || 'MMK')}
                          readOnly
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Confirm Amount</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={confirmAmountInput}
                          onChange={(event) => setConfirmAmountInput(event.target.value)}
                          placeholder="Type amount again to confirm"
                          className={
                            confirmAmountInput.trim().length > 0 && !isConfirmAmountMatched
                              ? 'border-rose-300 focus-visible:ring-rose-400'
                              : ''
                          }
                        />
                        <p className="text-xs text-slate-500">
                          Admin must type the exact invoice total before confirming receipt.
                        </p>
                        {confirmAmountInput.trim().length > 0 && !isConfirmAmountMatched && (
                          <p className="text-xs font-medium text-rose-600">
                            Amount does not match invoice total.
                          </p>
                        )}
                        {confirmAmountInput.trim().length > 0 && isConfirmAmountMatched && (
                          <p className="text-xs font-medium text-emerald-600">
                            Amount confirmed.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {requiresPaymentAccount && selectedPaymentAccount ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => setIsPaymentDetailsOpen(true)}
                    >
                      View Payment Details
                    </Button>
                  ) : null}
                </div>
              )}

              <Button
                onClick={generateReceipt}
                disabled={
                  isGenerating ||
                  !selectedInvoiceId ||
                  isSelectedInvoiceReceiptIssued ||
                  (selectedInvoice
                    ? formatStatus(selectedInvoice.status) === 'cancelled' &&
                      selectedInvoiceReceiptLabel !== 'cancelled receipt'
                    : false)
                }
              >
                {isGenerating
                  ? 'Processing...'
                : isSelectedInvoiceReceiptIssued
                    ? 'Receipt Already Issued'
                  : selectedInvoice && !isInvoiceEffectivelyPaid(selectedInvoice)
                    ? confirmCollected
                      ? 'Confirm Collected Payment & Create Receipt'
                      : 'Confirm Payment & Create Receipt'
                    : 'Create Receipt'}
              </Button>

              {latestGenerated && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm text-emerald-700">Receipt generated successfully.</p>
                  <p className="mt-1 font-semibold text-emerald-900">
                    {latestGenerated.receiptNo || 'Receipt ID pending'}
                  </p>
                  <p className="text-sm text-emerald-900">
                    Invoice: {formatInvoiceNo(latestGenerated.invoiceNo, latestGenerated.id)}
                  </p>
                  <p className="text-sm text-emerald-900">
                    Payment Method: {latestGenerated.paymentMethod || '—'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Receipt List ({filteredReceipts.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Search receipt by id, invoice, customer, payment method..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Receipt</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Payment Method</TableHead>
                      <TableHead>Paid Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReceipts.map((receipt) => (
                      <TableRow key={receipt.id}>
                        <TableCell className="font-medium">{receipt.receiptNo || '—'}</TableCell>
                        <TableCell>{formatInvoiceNo(receipt.invoiceNo, resolveInvoiceId(receipt))}</TableCell>
                        <TableCell>
                          <div>{getCustomerName(receipt)}</div>
                          <div className="text-xs text-slate-500">{receipt.customer?.customerCode || '—'}</div>
                        </TableCell>
                        <TableCell>{formatMoney(receipt.totalAmount, receipt.currency || 'MMK')}</TableCell>
                        <TableCell className="capitalize">{receipt.paymentMethod || '—'}</TableCell>
                        <TableCell>{formatDisplayDate(receipt.paidAt)}</TableCell>
                        <TableCell>
                        <Badge variant="secondary">{getReceiptStatusLabel(receipt)}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void openReceiptDetail(resolveInvoiceId(receipt))}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void exportReceiptPdf(receipt)}
                              disabled={isDownloadingReceipt}
                            >
                              <Download className="mr-2 h-4 w-4" />
                              {isDownloadingReceipt ? 'Downloading...' : 'Download'}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                              onClick={() => requestCancelReceipt(receipt)}
                              disabled={
                                Boolean(isCancellingReceiptById[receipt.id]) ||
                                Boolean(receipt.isHistoryRow) ||
                                getReceiptStatusLabel(receipt) === 'cancelled receipt'
                              }
                            >
                              {isCancellingReceiptById[receipt.id] ? 'Cancelling...' : 'Cancel Receipt'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!isLoadingData && filteredReceipts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="py-6 text-center text-sm text-slate-500">
                          No receipts found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        <Dialog open={isPaymentDetailsOpen} onOpenChange={setIsPaymentDetailsOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Payment Account Details</DialogTitle>
            </DialogHeader>
            {selectedPaymentAccount ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Payment Type</p>
                      <p className="mt-1 font-semibold text-slate-900 capitalize">
                        {selectedPaymentAccount.kind}
                      </p>
                    </div>
                    <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
                      {selectedPaymentAccount.kind === 'wallet' ? (
                        <Wallet className="h-4 w-4" />
                      ) : (
                        <Landmark className="h-4 w-4" />
                      )}
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div>
                      <p className="text-xs text-slate-500">Provider</p>
                      <p className="font-medium text-slate-900">
                        {selectedPaymentAccount.kind === 'wallet'
                          ? selectedPaymentAccount.walletType || 'N/A'
                          : selectedPaymentAccount.bankType || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Name</p>
                      <p className="text-base font-semibold text-slate-900">{selectedPaymentAccount.accountName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Number</p>
                      <p className="text-lg font-bold tracking-wide text-slate-900">
                        {selectedPaymentAccount.accountNumber}
                      </p>
                    </div>
                  </div>

                  {selectedPaymentAccount.qrCodeDataUrl ? (
                    <div className="mt-4 rounded-lg border bg-white p-3">
                      <p className="mb-2 text-xs text-slate-500">QR Code</p>
                      <div className="flex justify-center">
                        <img
                          src={selectedPaymentAccount.qrCodeDataUrl}
                          alt="Payment QR"
                          className="h-44 w-44 rounded-md object-contain"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => copyPaymentText(selectedPaymentAccount.accountName, 'Account Name')}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Name
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => copyPaymentText(selectedPaymentAccount.accountNumber, 'Account Number')}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Number
                  </Button>
                </div>

                <Button type="button" onClick={() => setIsPaymentDetailsOpen(false)}>
                  Close
                </Button>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No payment account selected.</p>
            )}
          </DialogContent>
        </Dialog>

        <Dialog
          open={receiptDialogOpen}
          onOpenChange={(open) => {
            setReceiptDialogOpen(open);
            if (!open) {
              setSelectedReceipt(null);
            }
          }}
        >
          <DialogContent className="inset-0 left-0 top-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none border-0 p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>
                Receipt Detail
                {selectedReceipt
                  ? ` - ${selectedReceipt.receiptNo || formatInvoiceNo(selectedReceipt.invoiceNo, selectedReceipt.id)}`
                  : ''}
              </DialogTitle>
            </DialogHeader>

            {isLoadingReceiptDetail && (
              <div className="rounded-md border bg-slate-50 p-4 text-sm text-slate-600">
                Loading receipt detail...
              </div>
            )}

            {!isLoadingReceiptDetail && selectedReceipt && (
              <div className="mx-auto w-full max-w-5xl space-y-4 rounded-lg border border-slate-300 bg-white p-5 text-slate-900">
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => void exportReceiptPdf()} disabled={isDownloadingReceipt}>
                    <Download className="mr-2 h-4 w-4" />
                    {isDownloadingReceipt ? 'Exporting...' : 'Export as PDF'}
                  </Button>
                </div>

                <h2 className="text-center text-3xl font-semibold">Receipt</h2>

                <div className="mt-4 flex flex-col gap-3 text-sm sm:flex-row sm:items-start">
                  {branding.logoDataUrl && (
                    <img
                      src={branding.logoDataUrl}
                      alt={`${branding.receiptCompanyName || branding.systemName} logo`}
                      className="h-16 w-16 rounded-md border border-slate-200 object-contain p-1"
                    />
                  )}
                  <div className="space-y-1">
                    <p className="font-semibold">{branding.receiptCompanyName || branding.systemName}</p>
                    <p>{branding.receiptAddress || '—'}</p>
                    <p>{branding.receiptPhone || '—'}</p>
                    {branding.receiptEmail && <p>{branding.receiptEmail}</p>}
                  </div>
                </div>

                <div className="mt-6 grid gap-6 md:grid-cols-2">
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold">Receipt Information</p>
                    <p>Receipt No: {selectedReceipt.receiptNo || '__________'}</p>
                    <p>Invoice No: {formatInvoiceNo(selectedReceipt.invoiceNo, selectedReceipt.id)}</p>
                    <p>Invoice Date: {formatDisplayDate(selectedReceipt.invoiceDate)}</p>
                    <p>Status: {getReceiptStatusLabel(selectedReceipt)}</p>
                  </div>

                  <div className="space-y-1 text-sm">
                    <p className="font-semibold">Customer Information</p>
                    <p>Customer ID: {selectedReceipt.customer?.customerCode || '—'}</p>
                    <p>Customer Name: {getCustomerName(selectedReceipt)}</p>
                    <p>Phone No: {selectedReceipt.customer?.primaryPhone || '—'}</p>
                    <p>Address: {selectedReceipt.customer?.installationAddress || '—'}</p>
                    <p>
                      Billing Period: {formatDisplayDate(selectedReceipt.billingPeriodFrom)} -{' '}
                      {formatDisplayDate(selectedReceipt.billingPeriodTo)}
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <p className="mb-2 text-sm font-semibold">Charges Details</p>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>No</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Unit Price</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {toNumber(selectedReceipt.monthlyFee) > 0 && (
                          <TableRow>
                            <TableCell>1</TableCell>
                            <TableCell>Monthly Internet Fee</TableCell>
                            <TableCell className="text-right">1</TableCell>
                            <TableCell className="text-right">{formatMoney(selectedReceipt.monthlyFee, selectedReceipt.currency || 'MMK')}</TableCell>
                            <TableCell className="text-right">{formatMoney(selectedReceipt.monthlyFee, selectedReceipt.currency || 'MMK')}</TableCell>
                          </TableRow>
                        )}
                        {toNumber(selectedReceipt.installationFee) > 0 && (
                          <TableRow>
                            <TableCell>{toNumber(selectedReceipt.monthlyFee) > 0 ? 2 : 1}</TableCell>
                            <TableCell>Installation Fee</TableCell>
                            <TableCell className="text-right">1</TableCell>
                            <TableCell className="text-right">{formatMoney(selectedReceipt.installationFee, selectedReceipt.currency || 'MMK')}</TableCell>
                            <TableCell className="text-right">{formatMoney(selectedReceipt.installationFee, selectedReceipt.currency || 'MMK')}</TableCell>
                          </TableRow>
                        )}
                        {toNumber(selectedReceipt.additionalFees) > 0 && (
                          <TableRow>
                            <TableCell>
                              {1 +
                                (toNumber(selectedReceipt.monthlyFee) > 0 ? 1 : 0) +
                                (toNumber(selectedReceipt.installationFee) > 0 ? 1 : 0)}
                            </TableCell>
                            <TableCell>Additional Fee</TableCell>
                            <TableCell className="text-right">1</TableCell>
                            <TableCell className="text-right">{formatMoney(selectedReceipt.additionalFees, selectedReceipt.currency || 'MMK')}</TableCell>
                            <TableCell className="text-right">{formatMoney(selectedReceipt.additionalFees, selectedReceipt.currency || 'MMK')}</TableCell>
                          </TableRow>
                        )}
                        {toNumber(selectedReceipt.collectionFee) > 0 && (
                          <TableRow>
                            <TableCell>
                              {1 +
                                (toNumber(selectedReceipt.monthlyFee) > 0 ? 1 : 0) +
                                (toNumber(selectedReceipt.installationFee) > 0 ? 1 : 0) +
                                (toNumber(selectedReceipt.additionalFees) > 0 ? 1 : 0)}
                            </TableCell>
                            <TableCell>Collection Fee</TableCell>
                            <TableCell className="text-right">1</TableCell>
                            <TableCell className="text-right">{formatMoney(selectedReceipt.collectionFee, selectedReceipt.currency || 'MMK')}</TableCell>
                            <TableCell className="text-right">{formatMoney(selectedReceipt.collectionFee, selectedReceipt.currency || 'MMK')}</TableCell>
                          </TableRow>
                        )}
                        {selectedReceipt.adjustments?.map((adjustment, index) => (
                          <TableRow key={`${adjustment.id || adjustment.description || 'adj'}-${index}`}>
                            <TableCell>
                              {1 +
                                (toNumber(selectedReceipt.monthlyFee) > 0 ? 1 : 0) +
                                (toNumber(selectedReceipt.installationFee) > 0 ? 1 : 0) +
                                (toNumber(selectedReceipt.additionalFees) > 0 ? 1 : 0) +
                                (toNumber(selectedReceipt.collectionFee) > 0 ? 1 : 0) +
                                index}
                            </TableCell>
                            <TableCell>{adjustment.description || 'Adjustment'}</TableCell>
                            <TableCell className="text-right">1</TableCell>
                            <TableCell className="text-right">
                              {String(adjustment.valueType || '').toLowerCase() === 'percent'
                                ? `${toNumber(adjustment.value)}%`
                                : formatMoney(adjustment.value, selectedReceipt.currency || 'MMK')}
                            </TableCell>
                            <TableCell className="text-right">
                              {String(adjustment.type || '').toLowerCase() === 'minus' ? '-' : ''}
                              {formatMoney(adjustment.amount, selectedReceipt.currency || 'MMK')}
                            </TableCell>
                          </TableRow>
                        ))}

                        <TableRow>
                          <TableCell colSpan={4} className="text-right text-base font-bold">Total Amount</TableCell>
                          <TableCell className="text-right text-base font-bold">
                            {formatMoney(selectedReceipt.totalAmount, selectedReceipt.currency || 'MMK')}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="space-y-1 text-sm">
                  {(() => {
                    const paymentSummary = getLatestCollectionPaymentSummary(selectedReceipt);
                    return (
                      <>
                        <p className="mb-2 text-sm font-semibold">Payment Information</p>
                        <p>
                          Payment Method:{' '}
                          <span className="font-medium">
                            {selectedReceipt.paymentMethod || paymentSummary?.paymentMethod || '—'}
                          </span>
                        </p>
                        <p>
                          Payment Account:{' '}
                          <span className="font-medium">{paymentSummary?.paymentAccount || '—'}</span>
                        </p>
                      </>
                    );
                  })()}
                  <p>
                    Payment Status:{' '}
                    <span className="font-medium">{getReceiptStatusLabel(selectedReceipt)}</span>
                  </p>
                  <p>
                    Collection Status:{' '}
                    <span className="font-medium">
                      {formatCollectionStatus(selectedReceipt.collectionStatus)}
                    </span>
                  </p>
                  <p>
                    Payment Date:{' '}
                    <span className="font-medium">{formatDisplayDate(selectedReceipt.paidAt)}</span>
                  </p>
                  <p>
                    Receipt No:{' '}
                    <span className="font-medium">{selectedReceipt.receiptNo || '__________'}</span>
                  </p>
                  <div className="pt-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                      onClick={() => requestCancelReceipt(selectedReceipt)}
                      disabled={
                        Boolean(isCancellingReceiptById[selectedReceipt.id]) ||
                        Boolean(selectedReceipt.isHistoryRow) ||
                        getReceiptStatusLabel(selectedReceipt) === 'cancelled receipt'
                      }
                    >
                      {isCancellingReceiptById[selectedReceipt.id] ? 'Cancelling...' : 'Cancel Receipt'}
                    </Button>
                  </div>
                </div>

                {branding.footerText && (
                  <p className="text-center text-sm text-slate-500">{branding.footerText}</p>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
        <Dialog
          open={Boolean(pendingCancelReceipt)}
          onOpenChange={(open) => {
            if (!open) setPendingCancelReceipt(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Cancel Receipt Confirmation</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-slate-600">Are you sure you want to cancel this receipt?</p>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setPendingCancelReceipt(null)}>
                No
              </Button>
              <Button
                type="button"
                className="bg-rose-600 text-white hover:bg-rose-700"
                onClick={async () => {
                  if (!pendingCancelReceipt) return;
                  const target = pendingCancelReceipt;
                  setPendingCancelReceipt(null);
                  await cancelReceipt(target);
                }}
              >
                Yes, Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
