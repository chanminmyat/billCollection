'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Calendar,
  DollarSign,
  FileText,
  Search,
  RefreshCw,
  Eye,
  Download,
  Plus,
  Minus,
  Save,
  CheckCircle2,
  Trash2,
  Clock3,
  Play,
  Zap,
  Edit,
} from 'lucide-react';
import { useAuth } from '../../contexts/auth-context';
import Layout from '../../components/layout';
import { useToast } from '@/hooks/use-toast';
import {
  DEFAULT_FIXED_BILLING_WINDOW,
  FixedBillingWindow,
  getFixedBillingWindow,
} from '@/lib/billing-config';
import { getInvoiceReleaseDate, isInvoiceReleased } from '@/lib/invoice-visibility';
import { formatDisplayDate, formatDisplayDateRange } from '@/lib/date-format';
import {
  ACTIVITY_LOG_STORAGE_KEY,
  ACTIVITY_LOG_UPDATED_EVENT,
  appendActivityLog,
  readActivityLogs,
} from '@/lib/activity-log';
import {
  CollectionWorkflowEvent,
  CollectionWorkflowMap,
  CollectionWorkflowStatus,
  COLLECTION_WORKFLOW_STORAGE_KEY,
  COLLECTION_WORKFLOW_UPDATED_EVENT,
  getCollectionWorkflowStatusClassName,
  getCollectionWorkflowStatusLabel,
  readCollectionWorkflowMap,
} from '@/lib/collection-workflow';
import {
  assignRuleToCustomersLocally,
  assignRuleToInvoicesLocally,
  BILLING_RULE_ASSIGNMENTS_STORAGE_KEY,
  BILLING_RULE_ASSIGNMENTS_UPDATED_EVENT,
  readBillingRuleAssignments,
} from '@/lib/billing-rule-assignments';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
const BILLING_ENGINE_SCHEDULE_STORAGE_KEY = 'billing_next_invoice_manual_schedule_v1';
const INVOICE_LOCAL_CANCELLED_STORAGE_KEY = 'billing_local_cancelled_invoice_ids_v1';
const INVOICE_FORCE_RELEASED_STORAGE_KEY = 'billing_force_released_invoice_ids_v1';
const INVOICE_RULE_NONE_VALUE = '__none__';

type InvoiceStatus = 'paid' | 'unpaid' | 'overdue' | 'cancelled';
type AdjustmentType = 'plus' | 'minus';
type AdjustmentValueType = 'fixed' | 'percent';

type InvoiceAdjustment = {
  id: string;
  description: string;
  type: AdjustmentType;
  valueType: AdjustmentValueType;
  value: string;
  amount: string;
  rememberForNext: boolean;
  sortOrder: number;
};

type InvoiceRecord = {
  id: string;
  invoiceNo?: string | null;
  invoiceType?: string;
  billingRuleId?: string | null;
  ruleId?: string | null;
  billingRuleName?: string | null;
  ruleName?: string | null;
  billingRule?: {
    id?: string | null;
    name?: string | null;
  } | null;
  rule?: {
    id?: string | null;
    name?: string | null;
  } | null;
  invoiceDate?: string | null;
  issuedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  billingPeriodFrom?: string | null;
  billingPeriodTo?: string | null;
  dueDate?: string | null;
  status: InvoiceStatus;
  currency?: string;
  monthlyFee?: string;
  installationFee?: string;
  additionalFees?: string;
  discountAmount?: string;
  subtotalAmount?: string;
  plusAmount?: string;
  minusAmount?: string;
  totalAmount?: string;
  paymentMethod?: string | null;
  receiptNo?: string | null;
  paidAt?: string | null;
  collectionStatus?: CollectionWorkflowStatus | null;
  collectionUpdatedAt?: string | null;
  collectionEvents?: CollectionWorkflowEvent[] | null;
  customer?: {
    id: string;
    customerCode?: string;
    personalName?: string | null;
    companyName?: string | null;
    primaryPhone?: string | null;
    installationAddress?: string | null;
  };
  subscription?: {
    id: string;
    serviceType?: string;
    plan?: {
      id: string;
      planCode?: string;
      planName?: string;
      monthlyFee?: string;
      currency?: string;
    } | null;
  } | null;
  adjustments?: InvoiceAdjustment[];
};

type BillingMode = 'fixed' | 'anniversary';

type BillingCustomer = {
  id: string;
  customerCode: string;
  name: string;
  phone: string;
  address: string;
  status: string;
  billingCycle: string;
  firstInvoiceMode?: string | null;
  serviceStartDate?: string | null;
  billingRuleId?: string | null;
  billingRuleName?: string | null;
};

type BillingRule = {
  id: string;
  name: string;
  billingModel: 'recurring' | 'usage';
  billingType: 'fixed' | 'anniversary';
  billingMode: string;
  customMonths?: number | null;
  fixedBillingDay?: number | null;
  dueAfterDays?: number | null;
  graceDays?: number | null;
  lateFeeEnabled?: boolean;
  lateFeeType?: 'fixed' | 'percent';
  lateFeeApplyMode?: 'once' | 'per_day';
  lateFeeValue?: number | null;
  lateFeeTriggerDays?: number | null;
  isActive: boolean;
  version: number;
};

type PaymentAccountKind = 'wallet' | 'account';

type PaymentAccount = {
  id: string;
  kind: PaymentAccountKind;
  walletType?: string | null;
  bankType?: string | null;
  accountName: string;
  accountNumber: string;
  isActive?: boolean;
};

type EngineRowStatus =
  | 'no_invoice'
  | 'waiting_payment'
  | 'scheduled'
  | 'ready_to_release'
  | 'releasing';

type NextInvoiceEngineRow = {
  customerId: string;
  customerCode: string;
  customerName: string;
  currentInvoiceId?: string;
  queuedInvoiceId?: string;
  currentInvoiceNo: string;
  currentInvoiceStatus: InvoiceStatus | 'none';
  billingMode: BillingMode;
  billingCycleMode: string | null;
  customMonths: number | null;
  fixedBillingDay: number | null;
  dueAfterDays: number | null;
  ruleId: string | null;
  ruleName: string | null;
  releaseDate: string | null;
  nextPaymentDate: string | null;
  status: EngineRowStatus;
};

type TransactionAction = 'created' | 'edited' | 'paid' | 'collection';

type TransactionLog = {
  id: string;
  action: TransactionAction;
  actionAt: string;
  invoiceId: string;
  invoiceNo: string;
  customerName: string;
  customerCode: string;
  amount: string | number | null | undefined;
  currency?: string | null;
  note: string;
};

type TransactionGroup = {
  id: string;
  invoiceId: string;
  invoiceNo: string;
  customerName: string;
  customerCode: string;
  amount: string | number | null | undefined;
  currency?: string | null;
  latestAction: TransactionAction;
  latestActionAt: string;
  latestReason: string;
  logs: TransactionLog[];
};

type AdjustmentFormRow = {
  description: string;
  type: AdjustmentType;
  valueType: AdjustmentValueType;
  value: string;
  rememberForNext: boolean;
  sortOrder: number;
};

type GlobalAdjustmentOption = {
  id?: string;
  description: string;
  type: AdjustmentType;
  valueType: AdjustmentValueType;
  value: string;
  isActive: boolean;
  sortOrder: number;
};

const toNumber = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatMoney = (value: string | number | null | undefined, currency = 'MMK') =>
  `${toNumber(value).toLocaleString()} ${currency}`;

const formatInvoiceNo = (invoiceNo?: string | null, fallbackId?: string | null) => {
  const rawInvoiceNo = (invoiceNo ?? '').trim();
  if (rawInvoiceNo) {
    if (/^inv-/i.test(rawInvoiceNo)) return rawInvoiceNo.toUpperCase();
    if (/^\d+$/.test(rawInvoiceNo)) return `INV-${rawInvoiceNo}`;
    return rawInvoiceNo;
  }

  const rawId = (fallbackId ?? '').trim();
  if (!rawId) return '—';
  if (/^[0-9a-f]{8}-/i.test(rawId)) return `INV-${rawId.slice(0, 8).toUpperCase()}`;
  if (/^\d+$/.test(rawId)) return `INV-${rawId}`;
  return rawId;
};

const formatInvoiceTypeLabel = (value: string | null | undefined) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return '—';
  if (normalized === 'manual_one_time') return 'One-time Manual';
  if (normalized === 'manual') return 'Manual';
  if (normalized === 'auto') return 'Rule-based Auto';
  return normalized
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const normalizeInvoiceStatusLabel = (status: string | null | undefined) => {
  const normalized = String(status ?? '').trim().toLowerCase();
  if (normalized === 'canceled') return 'cancelled';
  if (normalized === 'cancel' || normalized === 'cancelled') return 'cancelled';
  if (
    normalized === 'unpaid' ||
    normalized === 'pending' ||
    normalized === 'pending_payment' ||
    normalized === 'pending-payment' ||
    normalized === 'awaiting_payment' ||
    normalized === 'not_paid' ||
    normalized === 'not-paid' ||
    normalized === 'notpaid' ||
    normalized === 'awaiting-payment'
  ) {
    return 'unpaid';
  }
  if (
    normalized === 'paid' ||
    normalized === 'completed' ||
    normalized === 'complete' ||
    normalized === 'settled' ||
    normalized === 'success' ||
    normalized === 'succeeded' ||
    normalized === 'paid_by_admin' ||
    normalized === 'paid-by-admin' ||
    normalized === 'fully_paid' ||
    normalized === 'fully-paid'
  ) {
    return 'paid';
  }
  if (normalized === 'over_due') return 'overdue';
  if (!normalized) return 'unpaid';
  return normalized;
};

const getInvoiceDisplayStatusLabel = (invoice: Pick<InvoiceRecord, 'status' | 'receiptNo'>) => {
  const normalized = normalizeInvoiceStatusLabel(invoice.status);
  if (normalized === 'cancelled' && Boolean(invoice.receiptNo?.trim())) {
    return 'cancelled receipt';
  }
  return normalized;
};

const statusBadgeVariant = (status: InvoiceStatus | string) => {
  const normalized = normalizeInvoiceStatusLabel(status);
  if (normalized === 'paid') return 'default';
  if (normalized === 'unpaid') return 'secondary';
  if (normalized === 'cancelled receipt') return 'secondary';
  return 'destructive';
};

const transactionActionClass = (action: TransactionAction) => {
  if (action === 'created') return 'bg-blue-50 text-blue-700 border border-blue-200';
  if (action === 'edited') return 'bg-amber-50 text-amber-700 border border-amber-200';
  if (action === 'collection') return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
  return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
};

const toTransactionActionFromBillingActivity = (action?: string | null): TransactionAction => {
  const normalized = String(action ?? '')
    .trim()
    .toLowerCase();
  if (normalized.includes('paid')) return 'paid';
  if (normalized.includes('edit')) return 'edited';
  if (normalized.includes('release') || normalized.includes('create')) return 'created';
  return 'edited';
};

const isCollectionActionRequired = (status: CollectionWorkflowStatus) =>
  status === 'collected_pending_admin' || status === 'office_transfer';

const getAdminCollectionStatusLabel = (status: CollectionWorkflowStatus) =>
  status === 'collected_pending_admin'
    ? 'Collected'
    : status === 'office_transfer'
      ? 'Office Transfer'
      : getCollectionWorkflowStatusLabel(status);

const getAdminCollectionStatusClassName = (status: CollectionWorkflowStatus) =>
  isCollectionActionRequired(status)
    ? 'bg-amber-100 text-amber-800'
    : getCollectionWorkflowStatusClassName(status);

const getAdminCollectionStatusLabelForInvoice = (invoice: Pick<InvoiceRecord, 'status' | 'receiptNo'>, status: CollectionWorkflowStatus) => {
  const invoiceStatus = normalizeInvoiceStatusLabel(invoice.status);
  if (invoiceStatus === 'cancelled' && Boolean(invoice.receiptNo?.trim())) {
    return 'Cancelled Invoice';
  }
  return getAdminCollectionStatusLabel(status);
};

const getAdminCollectionStatusClassNameForInvoice = (invoice: Pick<InvoiceRecord, 'status' | 'receiptNo'>, status: CollectionWorkflowStatus) => {
  const invoiceStatus = normalizeInvoiceStatusLabel(invoice.status);
  if (invoiceStatus === 'cancelled' && Boolean(invoice.receiptNo?.trim())) {
    return 'bg-rose-100 text-rose-700';
  }
  return getAdminCollectionStatusClassName(status);
};

const parseCollectedPaymentSummary = (note?: string | null) => {
  const raw = String(note ?? '').trim();
  if (!raw) return null;

  const parts = raw
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);

  const paymentMethodPart = parts.find((part) => part.toLowerCase().startsWith('payment method:'));
  const paymentAccountPart = parts.find((part) => part.toLowerCase().startsWith('payment account:'));
  const freeFormNote = parts.filter(
    (part) =>
      !part.toLowerCase().startsWith('payment method:') &&
      !part.toLowerCase().startsWith('payment account:'),
  );

  return {
    paymentMethod: paymentMethodPart ? paymentMethodPart.replace(/^payment method:\s*/i, '').trim() : '',
    paymentAccount: paymentAccountPart ? paymentAccountPart.replace(/^payment account:\s*/i, '').trim() : '',
    note: freeFormNote.join(' | ').trim(),
  };
};

const applyLocalCancelledStatuses = (
  list: InvoiceRecord[],
  localCancelled: Record<string, boolean>,
) =>
  list.map((invoice) =>
    localCancelled[invoice.id] && invoice.status !== 'cancelled'
      ? { ...invoice, status: 'cancelled' as InvoiceStatus }
      : invoice,
  );

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const parseDateSafe = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateTime = (value?: string | null) => {
  const parsed = parseDateSafe(value);
  if (!parsed) return '-';
  return parsed.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

const formatDateYmd = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parsePositiveInt = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const normalized = Math.trunc(parsed);
  return normalized > 0 ? normalized : null;
};

const inferCustomMonthsFromRuleName = (ruleName?: string | null): number | null => {
  const name = String(ruleName ?? '').trim();
  if (!name) return null;
  const match = name.match(/(\d+)\s*month/i);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const parseNonNegativeInt = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const normalized = Math.trunc(parsed);
  return normalized >= 0 ? normalized : null;
};

const getBillingCycleMonths = (billingMode?: string | null, customMonths?: number | null) => {
  const mode = String(billingMode ?? '')
    .trim()
    .toLowerCase();
  if (mode === 'quarterly') return 3;
  if (mode === 'bi_yearly' || mode === 'bi-yearly' || mode === 'half_yearly') return 6;
  if (mode === 'yearly' || mode === 'annual') return 12;
  if (mode === 'custom') {
    return Math.max(1, parsePositiveInt(customMonths) ?? 1);
  }
  return 1;
};

const addMonthsSafe = (date: Date, months: number) => {
  const base = new Date(date);
  const target = new Date(base.getFullYear(), base.getMonth() + months, 1);
  const maxDay = daysInMonth(target.getFullYear(), target.getMonth());
  target.setDate(Math.min(base.getDate(), maxDay));
  return target;
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const addDays = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

const daysInMonth = (year: number, monthIndex: number) =>
  new Date(year, monthIndex + 1, 0).getDate();

const nextOccurrenceByDay = (day: number, afterDate: Date) => {
  let year = afterDate.getFullYear();
  let month = afterDate.getMonth();
  let candidateDay = Math.min(day, daysInMonth(year, month));
  let candidate = new Date(year, month, candidateDay);

  if (candidate <= afterDate) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    candidateDay = Math.min(day, daysInMonth(year, month));
    candidate = new Date(year, month, candidateDay);
  }

  return candidate;
};

const resolveFixedDueDate = (releaseDate: Date, dueDay: number) => {
  let dueMonth = releaseDate.getMonth();
  let dueYear = releaseDate.getFullYear();
  let day = Math.min(dueDay, daysInMonth(dueYear, dueMonth));
  let dueDate = new Date(dueYear, dueMonth, day);

  if (dueDate < releaseDate) {
    dueMonth += 1;
    if (dueMonth > 11) {
      dueMonth = 0;
      dueYear += 1;
    }
    day = Math.min(dueDay, daysInMonth(dueYear, dueMonth));
    dueDate = new Date(dueYear, dueMonth, day);
  }

  return dueDate;
};

const nextStartOfMonth = (afterDate: Date) => {
  const year = afterDate.getFullYear();
  const month = afterDate.getMonth();
  const firstOfCurrentMonth = new Date(year, month, 1);
  if (firstOfCurrentMonth > afterDate) {
    return firstOfCurrentMonth;
  }
  return new Date(year, month + 1, 1);
};

const inferBillingMode = (
  customer: BillingCustomer,
  latestInvoice: InvoiceRecord,
  fixedBillingWindow: FixedBillingWindow,
): BillingMode => {
  const rawModeCandidates = [
    latestInvoice.invoiceType,
    (latestInvoice as any)?.firstInvoiceMode,
    (latestInvoice as any)?.billingMode,
    (latestInvoice as any)?.mode,
    customer.firstInvoiceMode,
    customer.billingCycle,
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.toLowerCase());

  const hasAnniversaryMode = rawModeCandidates.some((value) =>
    value.includes('anniversary') || value.includes('aniversary'),
  );
  if (hasAnniversaryMode) {
    return 'anniversary';
  }

  const hasFixedMode = rawModeCandidates.some((value) => value.includes('fixed'));
  if (hasFixedMode) {
    return 'fixed';
  }

  const periodStart = parseDateSafe(latestInvoice.billingPeriodFrom);
  const dueDate = parseDateSafe(latestInvoice.dueDate);

  if (periodStart && periodStart.getDate() !== fixedBillingWindow.startDay) {
    return 'anniversary';
  }

  if (dueDate && dueDate.getDate() !== fixedBillingWindow.dueDay) {
    return 'anniversary';
  }

  return 'fixed';
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

export default function BillingPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [customers, setCustomers] = useState<BillingCustomer[]>([]);
  const [collectionMap, setCollectionMap] = useState<CollectionWorkflowMap>({});
  const [collectorActivityLogs, setCollectorActivityLogs] = useState<
    Array<{
      id: string;
      timestamp: string;
      description: string;
      targetId?: string;
      targetName?: string;
      actorName?: string;
    }>
  >([]);
  const [invoiceEditActivityLogs, setInvoiceEditActivityLogs] = useState<
    Array<{
      id: string;
      timestamp: string;
      action?: string;
      description: string;
      targetId?: string;
      targetName?: string;
      actorName?: string;
    }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersError, setCustomersError] = useState('');

  const [activeTab, setActiveTab] = useState<'invoice-list' | 'next-engine' | 'rule-config' | 'transactions'>(
    'invoice-list',
  );
  const [autoReleaseEnabled, setAutoReleaseEnabled] = useState(true);
  const [isRunningAutoRelease, setIsRunningAutoRelease] = useState(false);
  const [isReleasingByCustomer, setIsReleasingByCustomer] = useState<Record<string, boolean>>({});
  const [isEditingScheduleByCustomer, setIsEditingScheduleByCustomer] = useState<Record<string, boolean>>({});
  const [manualReleaseDateByCustomer, setManualReleaseDateByCustomer] = useState<Record<string, string>>({});
  const [fixedBillingWindow, setFixedBillingWindow] = useState<FixedBillingWindow>(
    DEFAULT_FIXED_BILLING_WINDOW
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'all' | InvoiceStatus>('all');
  const [transactionSearchTerm, setTransactionSearchTerm] = useState('');
  const [transactionDetailOpen, setTransactionDetailOpen] = useState(false);
  const [selectedTransactionGroup, setSelectedTransactionGroup] = useState<TransactionGroup | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [invoiceDetailMode, setInvoiceDetailMode] = useState<'view' | 'edit'>('view');
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);
  const [adjustmentRows, setAdjustmentRows] = useState<AdjustmentFormRow[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  const [paymentAccountsLoading, setPaymentAccountsLoading] = useState(false);
  const [receiptNo, setReceiptNo] = useState('');
  const [isSavingAdjustments, setIsSavingAdjustments] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [isGeneratingReceiptByInvoice, setIsGeneratingReceiptByInvoice] = useState<
    Record<string, boolean>
  >({});
  const [globalAdjustments, setGlobalAdjustments] = useState<GlobalAdjustmentOption[]>([]);
  const [globalAdjustmentsLoading, setGlobalAdjustmentsLoading] = useState(false);
  const [globalAdjustmentsError, setGlobalAdjustmentsError] = useState('');
  const [selectedGlobalAdjustmentIds, setSelectedGlobalAdjustmentIds] = useState<string[]>([]);
  const [editedInvoiceRuleId, setEditedInvoiceRuleId] = useState<string>(INVOICE_RULE_NONE_VALUE);
  const [localCancelledInvoiceIds, setLocalCancelledInvoiceIds] = useState<Record<string, boolean>>({});
  const [forceReleasedInvoiceIds, setForceReleasedInvoiceIds] = useState<Record<string, boolean>>({});

  const [billingRules, setBillingRules] = useState<BillingRule[]>([]);
  const [billingRulesLoading, setBillingRulesLoading] = useState(false);
  const [billingRulesError, setBillingRulesError] = useState('');

  const [customerRuleId, setCustomerRuleId] = useState('');
  const [invoiceRuleId, setInvoiceRuleId] = useState('');
  const [ruleCustomerSearch, setRuleCustomerSearch] = useState('');
  const [ruleInvoiceSearch, setRuleInvoiceSearch] = useState('');
  const [ruleInvoiceStatusFilter, setRuleInvoiceStatusFilter] = useState<'all' | InvoiceStatus>('all');
  const [selectedRuleCustomerIds, setSelectedRuleCustomerIds] = useState<string[]>([]);
  const [selectedRuleInvoiceIds, setSelectedRuleInvoiceIds] = useState<string[]>([]);
  const [effectiveFromDate, setEffectiveFromDate] = useState(formatDateYmd(new Date()));
  const [applyToUnreleasedInvoices, setApplyToUnreleasedInvoices] = useState(true);
  const [recalculateAssignedInvoices, setRecalculateAssignedInvoices] = useState(true);
  const [isAssigningRuleToCustomers, setIsAssigningRuleToCustomers] = useState(false);
  const [isAssigningRuleToInvoices, setIsAssigningRuleToInvoices] = useState(false);
  const [isApplyingLateFees, setIsApplyingLateFees] = useState(false);

  const localRuleAssignments = useMemo(() => readBillingRuleAssignments(), [invoices, customers, billingRules]);
  const billingRulesById = useMemo(
    () => new Map(billingRules.map((rule) => [rule.id, rule])),
    [billingRules],
  );
  const billingRulesByName = useMemo(
    () =>
      new Map(
        billingRules
          .map((rule) => [rule.name.trim().toLowerCase(), rule] as const)
          .filter(([name]) => Boolean(name)),
      ),
    [billingRules],
  );
  const customersById = useMemo(() => new Map(customers.map((customer) => [customer.id, customer])), [customers]);
  const customersByCode = useMemo(
    () =>
      new Map(
        customers
          .map((customer) => [customer.customerCode, customer] as const)
          .filter(([code]) => Boolean(code)),
      ),
    [customers],
  );
  const paymentMethodOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [{ value: 'Cash', label: 'Cash' }];
    const seen = new Set<string>(['cash']);

    paymentAccounts
      .filter((account) => account.isActive !== false)
      .forEach((account) => {
        const label = formatPaymentMethodLabel(account);
        const key = label.trim().toLowerCase();
        if (!key || seen.has(key)) return;
        seen.add(key);
        options.push({ value: label, label });
      });

    const currentValue = paymentMethod.trim();
    if (currentValue && !seen.has(currentValue.toLowerCase())) {
      options.push({ value: currentValue, label: currentValue });
    }

    return options;
  }, [paymentAccounts, paymentMethod]);

  const getInvoiceRuleDetails = useCallback(
    (invoice: InvoiceRecord) => {
      const customer =
        (invoice.customer?.id ? customersById.get(invoice.customer.id) : undefined) ||
        (invoice.customer?.customerCode ? customersByCode.get(invoice.customer.customerCode) : undefined);

      const ruleIdCandidates = [
        invoice.billingRuleId,
        invoice.ruleId,
        invoice.billingRule?.id ?? null,
        invoice.rule?.id ?? null,
        invoice.id ? localRuleAssignments.invoices[invoice.id] ?? null : null,
        invoice.customer?.id ? localRuleAssignments.customers[invoice.customer.id] ?? null : null,
        customer?.billingRuleId ?? null,
      ]
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean);

      const resolvedRuleId = ruleIdCandidates[0] || null;

      const ruleNameCandidates = [
        invoice.billingRuleName,
        invoice.ruleName,
        invoice.billingRule?.name ?? null,
        invoice.rule?.name ?? null,
        customer?.billingRuleName ?? null,
      ]
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean);

      const resolvedNameById = resolvedRuleId ? billingRulesById.get(resolvedRuleId)?.name?.trim() : '';
      const resolvedNameByRuleField = ruleNameCandidates[0] || '';
      const resolvedNameByLocalLookup =
        !resolvedNameByRuleField && resolvedRuleId
          ? billingRulesByName.get(resolvedRuleId.trim().toLowerCase())?.name?.trim() || ''
          : '';

      return {
        id: resolvedRuleId,
        name: resolvedNameByRuleField || resolvedNameById || resolvedNameByLocalLookup || 'Unassigned',
      };
    },
    [billingRulesById, billingRulesByName, customersByCode, customersById, localRuleAssignments],
  );

  const selectedInvoiceRuleDetails = useMemo(
    () => (selectedInvoice ? getInvoiceRuleDetails(selectedInvoice) : { id: null, name: 'Unassigned' }),
    [getInvoiceRuleDetails, selectedInvoice],
  );

  const editedInvoiceRuleForPreview = useMemo(() => {
    if (!selectedInvoice) return null;
    const selectedRuleIdFromEditor =
      editedInvoiceRuleId && editedInvoiceRuleId !== INVOICE_RULE_NONE_VALUE
        ? editedInvoiceRuleId.trim()
        : '';

    if (selectedRuleIdFromEditor) {
      return billingRules.find((rule) => rule.id === selectedRuleIdFromEditor) ?? null;
    }

    if (selectedInvoiceRuleDetails.id) {
      return billingRules.find((rule) => rule.id === selectedInvoiceRuleDetails.id) ?? null;
    }

    return null;
  }, [billingRules, editedInvoiceRuleId, selectedInvoice, selectedInvoiceRuleDetails.id]);

  const editedInvoiceCycleMonths = useMemo(() => {
    if (!editedInvoiceRuleForPreview) return 1;
    const explicitCustomMonths = parsePositiveInt(editedInvoiceRuleForPreview.customMonths);
    const inferredCustomMonths = inferCustomMonthsFromRuleName(editedInvoiceRuleForPreview.name);
    return getBillingCycleMonths(
      editedInvoiceRuleForPreview.billingMode,
      explicitCustomMonths ?? inferredCustomMonths,
    );
  }, [editedInvoiceRuleForPreview]);

  const logAdminActivity = (
    action: string,
    description: string,
    targetType: string,
    targetId?: string,
    targetName?: string,
    metadata?: Record<string, unknown>
  ) => {
    appendActivityLog({
      module: 'billing',
      action,
      description,
      actorId: user?.id,
      actorName: user?.name,
      actorRole: user?.role,
      targetType,
      targetId,
      targetName,
      metadata
    });
  };

  const cancelInvoiceInBackend = async (invoiceId: string) => {
    const cancelCandidates: Array<{ method: 'PATCH' | 'POST'; path: string; body?: Record<string, unknown> }> = [
      { method: 'POST', path: `${API_BASE_URL}/billing/invoices/${invoiceId}/cancel` },
      { method: 'PATCH', path: `${API_BASE_URL}/billing/invoices/${invoiceId}/cancel` },
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
      {
        method: 'PATCH',
        path: `${API_BASE_URL}/billing/invoices/${invoiceId}`,
        body: { invoiceStatus: 'cancelled' },
      },
      {
        method: 'PATCH',
        path: `${API_BASE_URL}/billing/invoices/${invoiceId}`,
        body: { invoiceStatus: 'canceled' },
      },
      {
        method: 'PATCH',
        path: `${API_BASE_URL}/billing/invoices/${invoiceId}/status`,
        body: { status: 'cancelled' },
      },
      {
        method: 'PATCH',
        path: `${API_BASE_URL}/billing/invoices/${invoiceId}/status`,
        body: { status: 'canceled' },
      },
    ];

    let cancelError = 'Failed to cancel invoice in backend.';
    for (const candidate of cancelCandidates) {
      try {
        const cancelResponse = await fetch(candidate.path, {
          method: candidate.method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: candidate.body ? JSON.stringify(candidate.body) : undefined,
        });
        const cancelData = await cancelResponse.json().catch(() => null);
        if (cancelResponse.ok) {
          return true;
        }
        cancelError = Array.isArray(cancelData?.message)
          ? cancelData.message.join(', ')
          : cancelData?.message ?? cancelError;
      } catch {
        // try next endpoint variant
      }
    }

    throw new Error(cancelError);
  };

  const fetchInvoices = async (cancelledOverrides?: Record<string, boolean>) => {
    setIsLoading(true);
    setLoadError('');
    try {
      const response = await fetch(`${API_BASE_URL}/billing/invoices`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? 'Failed to load invoices');
      }

      const data = await response.json().catch(() => []);
      const list = Array.isArray(data) ? data : [];
      const localAssignments = readBillingRuleAssignments();
      const normalized = (list as any[]).map((item: any) => {
        const ruleIdFromServer =
          item?.billingRuleId ??
          item?.ruleId ??
          item?.billingRule?.id ??
          item?.rule?.id ??
          null;
        const customerRuleId =
          item?.customer?.id && localAssignments.customers[item.customer.id]
            ? localAssignments.customers[item.customer.id]
            : null;
        const invoiceRuleId =
          item?.id && localAssignments.invoices[item.id]
            ? localAssignments.invoices[item.id]
            : null;
        return {
          ...item,
          status: normalizeInvoiceStatusLabel(item?.status),
          billingRuleId: ruleIdFromServer ?? invoiceRuleId ?? customerRuleId ?? null,
        };
      });
      setInvoices(
        applyLocalCancelledStatuses(
          normalized as InvoiceRecord[],
          cancelledOverrides ?? localCancelledInvoiceIds,
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load invoices';
      setLoadError(message);
      setInvoices([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCustomers = async () => {
    setCustomersLoading(true);
    setCustomersError('');
    try {
      const response = await fetch(`${API_BASE_URL}/customers`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? 'Failed to load customers');
      }

      const data = await response.json().catch(() => ([]));
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.customers)
          ? data.customers
          : Array.isArray(data?.data)
            ? data.data
            : [];

      const normalized = (list as any[]).map((item: any, index: number) => ({
        id: String(item?.id ?? index + 1),
        customerCode: String(item?.customerCode ?? ''),
        name:
          item?.personalName ||
          item?.companyName ||
          item?.name ||
          'Unknown',
        phone:
          item?.primaryPhone ||
          item?.contactInformation?.primaryPhone ||
          item?.phone ||
          '',
        address:
          item?.installationAddress ||
          item?.addressInformation?.installation ||
          item?.address ||
          '',
        status: String(item?.status ?? ''),
        billingCycle: String(
          item?.billingCycle ??
          item?.billingInformation?.billingCycle ??
          item?.customer?.billingInformation?.billingCycle ??
          'Monthly'
        ),
        firstInvoiceMode:
          item?.firstInvoiceMode ??
          item?.billingMode ??
          item?.billingInformation?.firstInvoiceMode ??
          item?.billingInformation?.billingMode ??
          item?.customer?.billingInformation?.firstInvoiceMode ??
          item?.customer?.billingInformation?.billingMode ??
          null,
        serviceStartDate:
          item?.subscription?.serviceStartDate ||
          item?.services?.serviceStartDate ||
          item?.serviceStartDate ||
          null,
        billingRuleId:
          item?.billingRuleId ??
          item?.ruleId ??
          item?.billingRule?.id ??
          item?.rule?.id ??
          null,
        billingRuleName:
          item?.billingRuleName ??
          item?.ruleName ??
          item?.billingRule?.name ??
          item?.rule?.name ??
          null,
      })) as BillingCustomer[];

      const localAssignments = readBillingRuleAssignments();
      const enriched = normalized.map((customer) => {
        const localRuleId = localAssignments.customers[customer.id];
        if (customer.billingRuleId || !localRuleId) {
          return customer;
        }
        return {
          ...customer,
          billingRuleId: localRuleId,
        };
      });

      setCustomers(enriched);
    } catch (error) {
      setCustomers([]);
      setCustomersError(error instanceof Error ? error.message : 'Failed to load customers');
    } finally {
      setCustomersLoading(false);
    }
  };

  const fetchGlobalAdjustments = async () => {
    setGlobalAdjustmentsLoading(true);
    setGlobalAdjustmentsError('');

    try {
      const response = await fetch(`${API_BASE_URL}/billing/global-adjustments`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? 'Failed to load global adjustments');
      }

      const data = await response.json().catch(() => []);
      const list = Array.isArray(data) ? data : Array.isArray(data?.adjustments) ? data.adjustments : [];

      const normalized: GlobalAdjustmentOption[] = (list as any[])
        .map((item: any, index: number) => {
          const type: AdjustmentType = item?.type === 'minus' ? 'minus' : 'plus';
          const valueType: AdjustmentValueType = item?.valueType === 'percent' ? 'percent' : 'fixed';
          return {
            id: typeof item?.id === 'string' ? item.id : undefined,
            description: typeof item?.description === 'string' ? item.description : '',
            type,
            valueType,
            value:
              item?.value === null || item?.value === undefined || Number.isNaN(Number(item.value))
                ? '0'
                : String(item.value),
            isActive: item?.isActive !== false,
            sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item.sortOrder) : index,
          };
        })
        .filter((item) => item.description.trim().length > 0)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      setGlobalAdjustments(normalized);
    } catch (error) {
      setGlobalAdjustments([]);
      setGlobalAdjustmentsError(
        error instanceof Error ? error.message : 'Failed to load global adjustments',
      );
    } finally {
      setGlobalAdjustmentsLoading(false);
    }
  };

  const fetchPaymentAccounts = async () => {
    setPaymentAccountsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/billing/payment-accounts`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          Array.isArray(payload?.message)
            ? payload.message.join(', ')
            : payload?.message ?? 'Failed to load payment methods',
        );
      }

      const list = Array.isArray(payload) ? payload : [];
      const normalized = list
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
            isActive: Boolean(item?.isActive ?? true),
          } as PaymentAccount;
        })
        .filter((item) => item.id && item.accountName);

      setPaymentAccounts(normalized);
    } catch {
      setPaymentAccounts([]);
    } finally {
      setPaymentAccountsLoading(false);
    }
  };

  const fetchBillingRules = async () => {
    setBillingRulesLoading(true);
    setBillingRulesError('');

    const normalizeRules = (rawList: any[]) =>
      rawList
        .map((item, index) => {
          const billingModel = String(item?.billingModel ?? item?.model ?? 'recurring').toLowerCase();
          const billingType = String(item?.billingType ?? item?.type ?? 'fixed').toLowerCase();
          const lateFeeTypeRaw = String(
            item?.lateFeeType ?? item?.lateFee?.type ?? 'fixed',
          ).toLowerCase();
          const lateFeeApplyModeRaw = String(
            item?.lateFeeApplyMode ?? item?.lateFee?.applyMode ?? 'once',
          ).toLowerCase();
          const parseNumber = (value: unknown): number | null => {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : null;
          };
          return {
            id: String(item?.id ?? index + 1),
            name: String(item?.name ?? item?.ruleName ?? `Rule ${index + 1}`),
            billingModel: billingModel === 'usage' ? 'usage' : 'recurring',
            billingType: billingType === 'anniversary' ? 'anniversary' : 'fixed',
            billingMode: String(item?.billingMode ?? item?.cycle ?? 'monthly'),
            customMonths: parseNumber(item?.customMonths ?? item?.config?.customMonths),
            fixedBillingDay: parseNumber(item?.fixedBillingDay ?? item?.config?.fixedBillingDay),
            dueAfterDays: parseNumber(item?.dueAfterDays ?? item?.config?.dueAfterDays),
            graceDays: parseNumber(item?.graceDays ?? item?.config?.graceDays),
            lateFeeEnabled:
              item?.lateFeeEnabled !== undefined
                ? item.lateFeeEnabled === true
                : item?.lateFee?.enabled === true,
            lateFeeType: lateFeeTypeRaw === 'percent' ? 'percent' : 'fixed',
            lateFeeApplyMode: lateFeeApplyModeRaw === 'per_day' ? 'per_day' : 'once',
            lateFeeValue: parseNumber(item?.lateFeeValue ?? item?.lateFee?.value),
            lateFeeTriggerDays: parseNumber(
              item?.lateFeeTriggerDays ?? item?.lateFee?.triggerDays,
            ),
            isActive: item?.isActive !== false,
            version: Number(item?.version ?? 1) || 1,
          } as BillingRule;
        })
        .sort((a, b) => a.name.localeCompare(b.name));

    try {
      const response = await fetch(`${API_BASE_URL}/billing/rules`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const message = data?.message ?? 'Failed to load billing rules';
        throw new Error(message);
      }

      const data = await response.json().catch(() => []);
      const list = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.rules)
          ? (data as any).rules
          : Array.isArray((data as any)?.data)
            ? (data as any).data
            : [];

      const normalized = normalizeRules(list as any[]);

      setBillingRules(normalized);
    } catch (error) {
      setBillingRules([]);
      setBillingRulesError(error instanceof Error ? error.message : 'Failed to load billing rules');
    } finally {
      setBillingRulesLoading(false);
    }
  };

  const refreshCollectionMap = useCallback(() => {
    setCollectionMap(readCollectionWorkflowMap());
  }, []);

  const refreshCollectorActivityLogs = useCallback(() => {
    const logs = readActivityLogs()
      .filter((log) => log.module === 'collector' && log.targetType === 'invoice')
      .map((log) => ({
        id: log.id,
        timestamp: log.timestamp,
        description: log.description,
        targetId: log.targetId,
        targetName: log.targetName,
        actorName: log.actorName,
      }));
    setCollectorActivityLogs(logs);
  }, []);

  const refreshInvoiceEditActivityLogs = useCallback(() => {
    const logs = readActivityLogs()
      .filter(
        (log) =>
          log.module === 'billing' &&
          log.targetType === 'invoice',
      )
      .map((log) => ({
        id: log.id,
        timestamp: log.timestamp,
        action: log.action,
        description: log.description,
        targetId: log.targetId,
        targetName: log.targetName,
        actorName: log.actorName,
      }));
    setInvoiceEditActivityLogs(logs);
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchInvoices();
      fetchCustomers();
      fetchGlobalAdjustments();
      fetchBillingRules();
      fetchPaymentAccounts();
      refreshCollectionMap();
      refreshCollectorActivityLogs();
      refreshInvoiceEditActivityLogs();
    }
  }, [refreshCollectionMap, refreshCollectorActivityLogs, refreshInvoiceEditActivityLogs, user?.role]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const refreshFixedWindow = () => {
      setFixedBillingWindow(getFixedBillingWindow());
    };

    refreshFixedWindow();
    window.addEventListener('storage', refreshFixedWindow);
    window.addEventListener('focus', refreshFixedWindow);

    return () => {
      window.removeEventListener('storage', refreshFixedWindow);
      window.removeEventListener('focus', refreshFixedWindow);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const raw = window.localStorage.getItem(BILLING_ENGINE_SCHEDULE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, string>;
      if (parsed && typeof parsed === 'object') {
        setManualReleaseDateByCustomer(parsed);
      }
    } catch {
      // ignore malformed local storage
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const raw = window.localStorage.getItem(INVOICE_LOCAL_CANCELLED_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      if (parsed && typeof parsed === 'object') {
        setLocalCancelledInvoiceIds(parsed);
      }
    } catch {
      // ignore malformed local storage
    }
  }, []);

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

    const refreshRuleAssignments = () => {
      fetchCustomers();
      fetchInvoices();
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === COLLECTION_WORKFLOW_STORAGE_KEY) {
        refreshCollectionMap();
      }
      if (event.key === ACTIVITY_LOG_STORAGE_KEY) {
        refreshCollectorActivityLogs();
        refreshInvoiceEditActivityLogs();
      }
      if (event.key === BILLING_RULE_ASSIGNMENTS_STORAGE_KEY) {
        refreshRuleAssignments();
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
    window.addEventListener(ACTIVITY_LOG_UPDATED_EVENT, refreshCollectorActivityLogs);
    window.addEventListener(ACTIVITY_LOG_UPDATED_EVENT, refreshInvoiceEditActivityLogs);
    window.addEventListener(BILLING_RULE_ASSIGNMENTS_UPDATED_EVENT, refreshRuleAssignments);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(COLLECTION_WORKFLOW_UPDATED_EVENT, refreshCollectionMap);
      window.removeEventListener(ACTIVITY_LOG_UPDATED_EVENT, refreshCollectorActivityLogs);
      window.removeEventListener(ACTIVITY_LOG_UPDATED_EVENT, refreshInvoiceEditActivityLogs);
      window.removeEventListener(BILLING_RULE_ASSIGNMENTS_UPDATED_EVENT, refreshRuleAssignments);
    };
  }, [refreshCollectionMap, refreshCollectorActivityLogs, refreshInvoiceEditActivityLogs]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      BILLING_ENGINE_SCHEDULE_STORAGE_KEY,
      JSON.stringify(manualReleaseDateByCustomer),
    );
  }, [manualReleaseDateByCustomer]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      INVOICE_LOCAL_CANCELLED_STORAGE_KEY,
      JSON.stringify(localCancelledInvoiceIds),
    );
  }, [localCancelledInvoiceIds]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      INVOICE_FORCE_RELEASED_STORAGE_KEY,
      JSON.stringify(forceReleasedInvoiceIds),
    );
  }, [forceReleasedInvoiceIds]);

  useEffect(() => {
    if (Object.keys(localCancelledInvoiceIds).length === 0) return;
    setInvoices((prev) => applyLocalCancelledStatuses(prev, localCancelledInvoiceIds));
  }, [localCancelledInvoiceIds]);

  const releasedInvoices = useMemo(
    () =>
      invoices.filter(
        (invoice) =>
          Boolean(invoice.id && forceReleasedInvoiceIds[invoice.id]) || isInvoiceReleased(invoice),
      ),
    [forceReleasedInvoiceIds, invoices],
  );

  const getCollectionStatusForInvoice = useCallback(
    (invoice: InvoiceRecord): CollectionWorkflowStatus => {
      if (invoice.status === 'paid') return 'completed';
      if (invoice.collectionStatus) return invoice.collectionStatus;
      return collectionMap[invoice.id]?.status ?? 'idle';
    },
    [collectionMap],
  );

  const selectedCollectionStatus = useMemo<CollectionWorkflowStatus>(() => {
    if (!selectedInvoice) return 'idle';
    return getCollectionStatusForInvoice(selectedInvoice);
  }, [getCollectionStatusForInvoice, selectedInvoice]);

  const selectedCollectionTimeline = useMemo(() => {
    if (!selectedInvoice) return [];
    if (Array.isArray(selectedInvoice.collectionEvents) && selectedInvoice.collectionEvents.length > 0) {
      return selectedInvoice.collectionEvents;
    }
    return collectionMap[selectedInvoice.id]?.events ?? [];
  }, [collectionMap, selectedInvoice]);

  const selectedCollectedPaymentSummary = useMemo(() => {
    const latestCollectorEvent = selectedCollectionTimeline
      .slice()
      .reverse()
      .find((event) => event.type === 'collector_collected' || event.type === 'admin_confirmed');
    return parseCollectedPaymentSummary(latestCollectorEvent?.note ?? null);
  }, [selectedCollectionTimeline]);

  const selectedInvoiceStatus = useMemo<InvoiceStatus | null>(() => {
    if (!selectedInvoice) return null;
    return normalizeInvoiceStatusLabel(selectedInvoice.status) as InvoiceStatus;
  }, [selectedInvoice]);

  const canEditSelectedInvoiceInDialog = useMemo(() => {
    if (!selectedInvoiceStatus) return false;
    return invoiceDetailMode === 'edit' && selectedInvoiceStatus !== 'paid';
  }, [invoiceDetailMode, selectedInvoiceStatus]);

  const canMarkPaidSelectedInvoiceInDialog = useMemo(() => {
    if (!selectedInvoiceStatus) return false;
    return invoiceDetailMode === 'edit' && selectedInvoiceStatus !== 'paid' && selectedInvoiceStatus !== 'cancelled';
  }, [invoiceDetailMode, selectedInvoiceStatus]);

  const filteredInvoices = useMemo(() => {
    return releasedInvoices.filter((invoice) => {
      const customerName =
        invoice.customer?.personalName || invoice.customer?.companyName || 'Unknown Customer';
      const customerCode = invoice.customer?.customerCode || '';
      const invoiceNo = invoice.invoiceNo || '';

      const matchesSearch =
        customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customerCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoiceNo.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = selectedStatus === 'all' || invoice.status === selectedStatus;
      return matchesSearch && matchesStatus;
    });
  }, [releasedInvoices, searchTerm, selectedStatus]);

  const stats = useMemo(() => {
    const totalInvoices = releasedInvoices.length;
    const paidCount = releasedInvoices.filter((invoice) => invoice.status === 'paid').length;
    const unpaidCount = releasedInvoices.filter((invoice) => invoice.status === 'unpaid').length;
    const overdueCount = releasedInvoices.filter((invoice) => invoice.status === 'overdue').length;

    const paidRevenue = releasedInvoices
      .filter((invoice) => invoice.status === 'paid')
      .reduce((sum, invoice) => sum + toNumber(invoice.totalAmount), 0);

    const outstanding = releasedInvoices
      .filter((invoice) => invoice.status !== 'paid')
      .reduce((sum, invoice) => sum + toNumber(invoice.totalAmount), 0);

    return {
      totalInvoices,
      paidCount,
      unpaidCount,
      overdueCount,
      paidRevenue,
      outstanding,
    };
  }, [releasedInvoices]);

  const engineRows = useMemo<NextInvoiceEngineRow[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfToday = today.getTime();

    const byCustomerId = new Map<string, InvoiceRecord[]>();
    const byCustomerCode = new Map<string, InvoiceRecord[]>();

    for (const invoice of invoices) {
      const customerId = invoice.customer?.id;
      const customerCode = invoice.customer?.customerCode;
      if (customerId) {
        const items = byCustomerId.get(customerId) ?? [];
        items.push(invoice);
        byCustomerId.set(customerId, items);
      }
      if (customerCode) {
        const items = byCustomerCode.get(customerCode) ?? [];
        items.push(invoice);
        byCustomerCode.set(customerCode, items);
      }
    }

    const getInvoiceTimelineDate = (invoice: InvoiceRecord) =>
      parseDateSafe(invoice.billingPeriodTo) ||
      parseDateSafe(invoice.dueDate) ||
      parseDateSafe(invoice.invoiceDate) ||
      parseDateSafe(invoice.paidAt) ||
      new Date(0);

    const getQueuedReleaseDate = (invoice: InvoiceRecord) =>
      getInvoiceReleaseDate(invoice) ||
      parseDateSafe(invoice.billingPeriodFrom) ||
      parseDateSafe(invoice.invoiceDate) ||
      null;

    const descByTimeline = (a: InvoiceRecord, b: InvoiceRecord) =>
      getInvoiceTimelineDate(b).getTime() - getInvoiceTimelineDate(a).getTime();

    const ascByRelease = (a: InvoiceRecord, b: InvoiceRecord) => {
      const aDate = getQueuedReleaseDate(a);
      const bDate = getQueuedReleaseDate(b);
      if (aDate && bDate) return aDate.getTime() - bDate.getTime();
      if (aDate) return -1;
      if (bDate) return 1;
      return getInvoiceTimelineDate(a).getTime() - getInvoiceTimelineDate(b).getTime();
    };

    const localAssignments = readBillingRuleAssignments();
    const rulesById = new Map(billingRules.map((rule) => [rule.id, rule]));
    const rulesByName = new Map(
      billingRules.map((rule) => [rule.name.trim().toLowerCase(), rule]),
    );

    const findRuleByHints = (
      ids: Array<string | null | undefined>,
      names: Array<string | null | undefined>,
    ): BillingRule | null => {
      for (const rawId of ids) {
        const id = typeof rawId === 'string' ? rawId.trim() : '';
        if (!id) continue;
        const found = rulesById.get(id);
        if (found) return found;
      }
      for (const rawName of names) {
        const name = typeof rawName === 'string' ? rawName.trim().toLowerCase() : '';
        if (!name) continue;
        const found = rulesByName.get(name);
        if (found) return found;
      }
      return null;
    };

    const getNextFixedReleaseDate = (afterDate: Date, fixedDay: number, cycleMonths: number) => {
      const normalizedAfter = startOfDay(afterDate);
      const currentMonthDay = Math.min(
        fixedDay,
        daysInMonth(normalizedAfter.getFullYear(), normalizedAfter.getMonth()),
      );
      let candidate = new Date(
        normalizedAfter.getFullYear(),
        normalizedAfter.getMonth(),
        currentMonthDay,
      );
      if (candidate <= normalizedAfter) {
        const stepped = addMonthsSafe(
          new Date(normalizedAfter.getFullYear(), normalizedAfter.getMonth(), 1),
          Math.max(1, cycleMonths),
        );
        const steppedDay = Math.min(
          fixedDay,
          daysInMonth(stepped.getFullYear(), stepped.getMonth()),
        );
        candidate = new Date(stepped.getFullYear(), stepped.getMonth(), steppedDay);
      }
      return candidate;
    };

    const getNextAnniversaryReleaseDate = (afterDate: Date, cycleMonths: number) => {
      const normalizedAfter = startOfDay(afterDate);
      let candidate = addMonthsSafe(
        new Date(normalizedAfter.getFullYear(), normalizedAfter.getMonth(), 1),
        Math.max(1, cycleMonths),
      );
      candidate = new Date(candidate.getFullYear(), candidate.getMonth(), 1);
      if (candidate <= normalizedAfter) {
        const stepped = addMonthsSafe(candidate, Math.max(1, cycleMonths));
        candidate = new Date(stepped.getFullYear(), stepped.getMonth(), 1);
      }
      return candidate;
    };

    const getDueDate = (
      releaseDate: Date,
      billingType: BillingMode,
      dueAfterDays: number | null,
    ) => {
      if (dueAfterDays !== null) {
        return addDays(releaseDate, dueAfterDays);
      }
      if (billingType === 'fixed') {
        return resolveFixedDueDate(releaseDate, fixedBillingWindow.dueDay);
      }
      return addDays(releaseDate, 14);
    };

    const isReleasedForEngine = (invoice: InvoiceRecord) =>
      Boolean(invoice.id && forceReleasedInvoiceIds[invoice.id]) || isInvoiceReleased(invoice, today);

    return customers
      .map((customer) => {
        const customerInvoices = [
          ...(byCustomerId.get(customer.id) ?? []),
          ...(byCustomerCode.get(customer.customerCode) ?? []),
        ];
        const uniqueCustomerInvoices = Array.from(
          new Map(customerInvoices.map((invoice) => [invoice.id, invoice])).values(),
        );

        const releasedCustomerInvoices = uniqueCustomerInvoices
          .filter((invoice) => isReleasedForEngine(invoice))
          .sort(descByTimeline);
        const queuedCustomerInvoices = uniqueCustomerInvoices
          .filter((invoice) => !isReleasedForEngine(invoice))
          .sort(ascByRelease);

        const currentInvoice = releasedCustomerInvoices[0];
        const queuedInvoice = queuedCustomerInvoices[0];
        const localCustomerRuleId =
          customer.id && localAssignments.customers[customer.id]
            ? localAssignments.customers[customer.id]
            : null;
        const localQueuedRuleId =
          queuedInvoice?.id && localAssignments.invoices[queuedInvoice.id]
            ? localAssignments.invoices[queuedInvoice.id]
            : null;
        const localCurrentRuleId =
          currentInvoice?.id && localAssignments.invoices[currentInvoice.id]
            ? localAssignments.invoices[currentInvoice.id]
            : null;

        const resolvedRule =
          findRuleByHints(
            [
              queuedInvoice?.billingRuleId,
              queuedInvoice?.ruleId,
              queuedInvoice?.billingRule?.id ?? null,
              queuedInvoice?.rule?.id ?? null,
              currentInvoice?.billingRuleId,
              currentInvoice?.ruleId,
              currentInvoice?.billingRule?.id ?? null,
              currentInvoice?.rule?.id ?? null,
              customer.billingRuleId,
              localQueuedRuleId,
              localCurrentRuleId,
              localCustomerRuleId,
            ],
            [
              queuedInvoice?.billingRuleName,
              queuedInvoice?.ruleName,
              queuedInvoice?.billingRule?.name ?? null,
              queuedInvoice?.rule?.name ?? null,
              currentInvoice?.billingRuleName,
              currentInvoice?.ruleName,
              currentInvoice?.billingRule?.name ?? null,
              currentInvoice?.rule?.name ?? null,
              customer.billingRuleName,
            ],
          ) ?? null;

        const modeSeedInvoice = currentInvoice || queuedInvoice;
        const inferredBillingMode: BillingMode = resolvedRule
          ? resolvedRule.billingType === 'anniversary'
            ? 'anniversary'
            : 'fixed'
          : modeSeedInvoice
            ? inferBillingMode(customer, modeSeedInvoice, fixedBillingWindow)
            : ((customer.billingCycle.toLowerCase().includes('anniversary')
                ? 'anniversary'
                : 'fixed') as BillingMode);

        const cycleMonths = resolvedRule
          ? getBillingCycleMonths(resolvedRule.billingMode, resolvedRule.customMonths ?? null)
          : getBillingCycleMonths(customer.billingCycle, null);
        const fixedBillingDay = resolvedRule
          ? parsePositiveInt(resolvedRule.fixedBillingDay) ?? fixedBillingWindow.startDay
          : fixedBillingWindow.startDay;
        const dueAfterDays = resolvedRule
          ? parseNonNegativeInt(resolvedRule.dueAfterDays)
          : null;

        if (queuedInvoice) {
          const queuedReleaseDate = getQueuedReleaseDate(queuedInvoice);
          let nextPaymentDate = parseDateSafe(queuedInvoice.dueDate);

          if (!nextPaymentDate && queuedReleaseDate) {
            nextPaymentDate = getDueDate(queuedReleaseDate, inferredBillingMode, dueAfterDays);
          }

          let queuedStatus: EngineRowStatus = 'scheduled';
          if (isReleasingByCustomer[customer.id]) {
            queuedStatus = 'releasing';
          } else if (queuedReleaseDate && queuedReleaseDate.getTime() <= startOfToday) {
            queuedStatus = 'ready_to_release';
          }

          return {
            customerId: customer.id,
            customerCode: customer.customerCode || '—',
            customerName: customer.name,
            currentInvoiceId: currentInvoice?.id,
            queuedInvoiceId: queuedInvoice.id,
            currentInvoiceNo: formatInvoiceNo(currentInvoice?.invoiceNo, currentInvoice?.id),
            currentInvoiceStatus: currentInvoice?.status ?? ('none' as const),
            billingMode: inferredBillingMode,
            billingCycleMode: resolvedRule?.billingMode ?? null,
            customMonths: parsePositiveInt(resolvedRule?.customMonths),
            fixedBillingDay,
            dueAfterDays,
            ruleId: resolvedRule?.id ?? customer.billingRuleId ?? localCustomerRuleId ?? null,
            ruleName: resolvedRule?.name ?? customer.billingRuleName ?? null,
            releaseDate: queuedReleaseDate ? formatDateYmd(queuedReleaseDate) : null,
            nextPaymentDate: nextPaymentDate ? formatDateYmd(nextPaymentDate) : null,
            status: queuedStatus,
          };
        }

        if (!currentInvoice) {
          return {
            customerId: customer.id,
            customerCode: customer.customerCode || '—',
            customerName: customer.name,
            currentInvoiceNo: '—',
            currentInvoiceStatus: 'none' as const,
            billingMode: inferredBillingMode,
            billingCycleMode: resolvedRule?.billingMode ?? null,
            customMonths: parsePositiveInt(resolvedRule?.customMonths),
            fixedBillingDay,
            dueAfterDays,
            ruleId: resolvedRule?.id ?? customer.billingRuleId ?? localCustomerRuleId ?? null,
            ruleName: resolvedRule?.name ?? customer.billingRuleName ?? null,
            releaseDate: null,
            nextPaymentDate: null,
            status: 'no_invoice' as const,
          };
        }

        const referenceDate =
          parseDateSafe(currentInvoice.billingPeriodTo) ||
          parseDateSafe(currentInvoice.dueDate) ||
          parseDateSafe(currentInvoice.invoiceDate) ||
          parseDateSafe(currentInvoice.paidAt) ||
          new Date();
        const currentPeriodEndDate = parseDateSafe(currentInvoice.billingPeriodTo);

        let releaseDate: Date | null = null;
        let nextPaymentDate: Date | null = null;

        // Billing release policy:
        // If current invoice has an explicit billingPeriodTo, queue next invoice release
        // X days before that period end (X = rule dueAfterDays, default 15).
        // This matches expectation like:
        // current 21-03 to 20-06 -> next invoice release on 05-06 (lead 15 days).
        if (currentPeriodEndDate) {
          const releaseLeadDays = Math.max(0, dueAfterDays ?? 15);
          releaseDate = addDays(startOfDay(currentPeriodEndDate), -releaseLeadDays);
          nextPaymentDate = startOfDay(currentPeriodEndDate);
        } else if (inferredBillingMode === 'fixed') {
          releaseDate = getNextFixedReleaseDate(referenceDate, fixedBillingDay, cycleMonths);
          nextPaymentDate = getDueDate(releaseDate, inferredBillingMode, dueAfterDays);
        } else {
          releaseDate = getNextAnniversaryReleaseDate(referenceDate, cycleMonths);
          nextPaymentDate = getDueDate(releaseDate, inferredBillingMode, dueAfterDays);
        }

        const manualReleaseDate = parseDateSafe(
          manualReleaseDateByCustomer[customer.id] || null,
        );
        if (manualReleaseDate) {
          releaseDate = manualReleaseDate;
          nextPaymentDate = getDueDate(releaseDate, inferredBillingMode, dueAfterDays);
        }

        let rowStatus: EngineRowStatus = 'scheduled';
        if (currentInvoice.status !== 'paid') {
          rowStatus = 'waiting_payment';
        } else if (isReleasingByCustomer[customer.id]) {
          rowStatus = 'releasing';
        } else if (releaseDate && releaseDate <= today) {
          rowStatus = 'ready_to_release';
        }

        return {
          customerId: customer.id,
          customerCode: customer.customerCode || '—',
          customerName: customer.name,
          currentInvoiceId: currentInvoice.id,
          currentInvoiceNo: formatInvoiceNo(currentInvoice.invoiceNo, currentInvoice.id),
          currentInvoiceStatus: currentInvoice.status,
          billingMode: inferredBillingMode,
          billingCycleMode: resolvedRule?.billingMode ?? null,
          customMonths: parsePositiveInt(resolvedRule?.customMonths),
          fixedBillingDay,
          dueAfterDays,
          ruleId: resolvedRule?.id ?? customer.billingRuleId ?? localCustomerRuleId ?? null,
          ruleName: resolvedRule?.name ?? customer.billingRuleName ?? null,
          releaseDate: releaseDate ? formatDateYmd(releaseDate) : null,
          nextPaymentDate: nextPaymentDate ? formatDateYmd(nextPaymentDate) : null,
          status: rowStatus,
        };
      })
      .sort((a, b) => a.customerName.localeCompare(b.customerName));
  }, [
    customers,
    invoices,
    billingRules,
    fixedBillingWindow,
    isReleasingByCustomer,
    manualReleaseDateByCustomer,
    forceReleasedInvoiceIds,
  ]);

  const readyToReleaseRows = useMemo(
    () => engineRows.filter((row) => row.status === 'ready_to_release'),
    [engineRows],
  );

  const visibleEngineRows = useMemo(
    () =>
      engineRows.filter(
        (row) =>
          row.status === 'scheduled' ||
          row.status === 'ready_to_release' ||
          row.status === 'releasing',
      ),
    [engineRows],
  );

  const engineStats = useMemo(() => {
    const total = visibleEngineRows.length;
    const scheduled = visibleEngineRows.filter((row) => row.status === 'scheduled').length;
    const ready = visibleEngineRows.filter((row) => row.status === 'ready_to_release').length;
    const releasing = visibleEngineRows.filter((row) => row.status === 'releasing').length;
    return { total, scheduled, ready, releasing };
  }, [visibleEngineRows]);

  const transactionLogs = useMemo<TransactionLog[]>(() => {
    const logs: TransactionLog[] = [];
    const actionThresholdMs = 60_000;

    for (const invoice of invoices) {
      const customerName =
        invoice.customer?.personalName || invoice.customer?.companyName || 'Unknown Customer';
      const customerCode = invoice.customer?.customerCode || '—';
      const invoiceNo = invoice.invoiceNo || invoice.id;
      const createdAt =
        parseDateSafe(invoice.issuedAt) ||
        parseDateSafe(invoice.createdAt) ||
        parseDateSafe(invoice.invoiceDate);
      const updatedAt = parseDateSafe(invoice.updatedAt);
      const paidAt = parseDateSafe(invoice.paidAt);
      const editActivityForInvoice = invoiceEditActivityLogs.filter(
        (activity) =>
          activity.targetId === invoice.id ||
          (activity.targetName &&
            (activity.targetName === invoiceNo || activity.targetName === invoice.id)),
      );
      const hasBillingCreatedActivity = editActivityForInvoice.some(
        (activity) => toTransactionActionFromBillingActivity(activity.action) === 'created',
      );
      const hasBillingEditedActivity = editActivityForInvoice.some(
        (activity) => toTransactionActionFromBillingActivity(activity.action) === 'edited',
      );
      const hasBillingPaidActivity = editActivityForInvoice.some(
        (activity) => toTransactionActionFromBillingActivity(activity.action) === 'paid',
      );

      if (createdAt && !hasBillingCreatedActivity) {
        logs.push({
          id: `${invoice.id}-created`,
          action: 'created',
          actionAt: createdAt.toISOString(),
          invoiceId: invoice.id,
          invoiceNo,
          customerName,
          customerCode,
          amount: invoice.totalAmount,
          currency: invoice.currency,
          note: 'Invoice created',
        });
      }

      if (updatedAt) {
        const createdMs = createdAt?.getTime() ?? 0;
        const paidMs = paidAt?.getTime() ?? 0;
        const updatedMs = updatedAt.getTime();
        const differentFromCreated = !createdAt || Math.abs(updatedMs - createdMs) > actionThresholdMs;
        const differentFromPaid = !paidAt || Math.abs(updatedMs - paidMs) > actionThresholdMs;

        if (
          differentFromCreated &&
          differentFromPaid &&
          editActivityForInvoice.length === 0 &&
          !hasBillingEditedActivity
        ) {
          logs.push({
            id: `${invoice.id}-edited`,
            action: 'edited',
            actionAt: updatedAt.toISOString(),
            invoiceId: invoice.id,
            invoiceNo,
            customerName,
            customerCode,
            amount: invoice.totalAmount,
            currency: invoice.currency,
            note: 'Invoice edited',
          });
        }
      }

      if (editActivityForInvoice.length > 0) {
        for (const activity of editActivityForInvoice) {
          logs.push({
            id: `${invoice.id}-billing-activity-${activity.id}`,
            action: toTransactionActionFromBillingActivity(activity.action),
            actionAt: activity.timestamp,
            invoiceId: invoice.id,
            invoiceNo,
            customerName,
            customerCode,
            amount: invoice.totalAmount,
            currency: invoice.currency,
            note: activity.actorName
              ? `${activity.description} • ${activity.actorName}`
              : activity.description,
          });
        }
      }

      if (paidAt || (invoice.status === 'paid' && updatedAt)) {
        const paidDate = paidAt ?? updatedAt;
        if (paidDate && !hasBillingPaidActivity) {
          const method = invoice.paymentMethod?.trim();
          logs.push({
            id: `${invoice.id}-paid`,
            action: 'paid',
            actionAt: paidDate.toISOString(),
            invoiceId: invoice.id,
            invoiceNo,
            customerName,
            customerCode,
            amount: invoice.totalAmount,
            currency: invoice.currency,
            note: method ? `Invoice paid via ${method}` : 'Invoice paid',
          });
        }
      }

      const workflow = collectionMap[invoice.id];
      const backendCollectionEvents = Array.isArray(invoice.collectionEvents)
        ? invoice.collectionEvents
        : [];
      const collectorInvoiceLogs = collectorActivityLogs.filter(
        (activity) =>
          activity.targetId === invoice.id ||
          (activity.targetName &&
            (activity.targetName === invoiceNo || activity.targetName === invoice.id)),
      );

      if (collectorInvoiceLogs.length > 0) {
        for (const activity of collectorInvoiceLogs) {
          logs.push({
            id: `${invoice.id}-collection-activity-${activity.id}`,
            action: 'collection',
            actionAt: activity.timestamp,
            invoiceId: invoice.id,
            invoiceNo,
            customerName,
            customerCode,
            amount: invoice.totalAmount,
            currency: invoice.currency,
            note: activity.actorName
              ? `${activity.description} • ${activity.actorName}`
              : activity.description,
          });
        }
      }

      if (backendCollectionEvents.length > 0) {
        for (const event of backendCollectionEvents) {
          logs.push({
            id: `${invoice.id}-collection-backend-${event.id}`,
            action: 'collection',
            actionAt: event.timestamp,
            invoiceId: invoice.id,
            invoiceNo,
            customerName,
            customerCode,
            amount: invoice.totalAmount,
            currency: invoice.currency,
            note: event.note ? `${event.label} (${event.note})` : event.label,
          });
        }
      }

      if (workflow?.events?.length) {
        const existingKeys = new Set(
          [
            ...collectorInvoiceLogs.map((activity) => `${activity.timestamp}::${activity.description}`),
            ...backendCollectionEvents.map((event) => `${event.timestamp}::${event.label}`),
          ],
        );
        for (const event of workflow.events) {
          const dedupeKey = `${event.timestamp}::${event.label}`;
          if (existingKeys.has(dedupeKey)) {
            continue;
          }
          logs.push({
            id: `${invoice.id}-collection-${event.id}`,
            action: 'collection',
            actionAt: event.timestamp,
            invoiceId: invoice.id,
            invoiceNo,
            customerName,
            customerCode,
            amount: invoice.totalAmount,
            currency: invoice.currency,
            note: event.note ? `${event.label} (${event.note})` : event.label,
          });
        }
      }
    }

    return logs.sort(
      (a, b) => (parseDateSafe(b.actionAt)?.getTime() ?? 0) - (parseDateSafe(a.actionAt)?.getTime() ?? 0),
    );
  }, [collectionMap, collectorActivityLogs, invoiceEditActivityLogs, invoices]);

  const transactionGroups = useMemo<TransactionGroup[]>(() => {
    const grouped = new Map<string, TransactionLog[]>();

    for (const log of transactionLogs) {
      const key = log.invoiceId || log.invoiceNo || log.id;
      const existing = grouped.get(key) ?? [];
      existing.push(log);
      grouped.set(key, existing);
    }

    const groups = Array.from(grouped.entries()).map(([key, logs]) => {
      const sortedLogs = [...logs].sort(
        (a, b) => (parseDateSafe(b.actionAt)?.getTime() ?? 0) - (parseDateSafe(a.actionAt)?.getTime() ?? 0),
      );
      const latest = sortedLogs[0];
      return {
        id: key,
        invoiceId: latest?.invoiceId || key,
        invoiceNo: latest?.invoiceNo || key,
        customerName: latest?.customerName || 'Unknown Customer',
        customerCode: latest?.customerCode || '—',
        amount: latest?.amount,
        currency: latest?.currency,
        latestAction: latest?.action || 'created',
        latestActionAt: latest?.actionAt || new Date().toISOString(),
        latestReason: latest?.note || '—',
        logs: sortedLogs,
      } as TransactionGroup;
    });

    return groups.sort(
      (a, b) =>
        (parseDateSafe(b.latestActionAt)?.getTime() ?? 0) -
        (parseDateSafe(a.latestActionAt)?.getTime() ?? 0),
    );
  }, [transactionLogs]);

  const filteredTransactionGroups = useMemo(() => {
    const keyword = transactionSearchTerm.trim().toLowerCase();
    if (!keyword) return transactionGroups;

    return transactionGroups.filter((group) => {
      if (
        group.invoiceNo.toLowerCase().includes(keyword) ||
        group.customerName.toLowerCase().includes(keyword) ||
        group.customerCode.toLowerCase().includes(keyword) ||
        group.latestAction.toLowerCase().includes(keyword) ||
        group.latestReason.toLowerCase().includes(keyword)
      ) {
        return true;
      }

      return group.logs.some((log) => {
        return (
          log.action.toLowerCase().includes(keyword) ||
          log.note.toLowerCase().includes(keyword)
        );
      });
    });
  }, [transactionGroups, transactionSearchTerm]);

  const openTransactionDetail = (group: TransactionGroup) => {
    setSelectedTransactionGroup(group);
    setTransactionDetailOpen(true);
  };

  const filteredRuleCustomers = useMemo(() => {
    const keyword = ruleCustomerSearch.trim().toLowerCase();
    return customers.filter((customer) => {
      if (!keyword) return true;
      return (
        customer.name.toLowerCase().includes(keyword) ||
        customer.customerCode.toLowerCase().includes(keyword) ||
        customer.phone.toLowerCase().includes(keyword) ||
        customer.address.toLowerCase().includes(keyword)
      );
    });
  }, [customers, ruleCustomerSearch]);

  const filteredRuleInvoices = useMemo(() => {
    const keyword = ruleInvoiceSearch.trim().toLowerCase();
    return invoices
      .filter((invoice) => {
        const invoiceNo = (invoice.invoiceNo || invoice.id || '').toLowerCase();
        const customerName =
          (invoice.customer?.personalName || invoice.customer?.companyName || 'unknown').toLowerCase();
        const customerCode = (invoice.customer?.customerCode || '').toLowerCase();
        const matchesKeyword =
          !keyword ||
          invoiceNo.includes(keyword) ||
          customerName.includes(keyword) ||
          customerCode.includes(keyword);
        const matchesStatus =
          ruleInvoiceStatusFilter === 'all' || invoice.status === ruleInvoiceStatusFilter;
        return matchesKeyword && matchesStatus;
      })
      .sort((a, b) => {
        const aTime =
          parseDateSafe(a.invoiceDate)?.getTime() ??
          parseDateSafe(a.createdAt)?.getTime() ??
          0;
        const bTime =
          parseDateSafe(b.invoiceDate)?.getTime() ??
          parseDateSafe(b.createdAt)?.getTime() ??
          0;
        return bTime - aTime;
      });
  }, [invoices, ruleInvoiceSearch, ruleInvoiceStatusFilter]);

  const areAllFilteredCustomersSelected =
    filteredRuleCustomers.length > 0 &&
    filteredRuleCustomers.every((customer) => selectedRuleCustomerIds.includes(customer.id));

  const areAllFilteredInvoicesSelected =
    filteredRuleInvoices.length > 0 &&
    filteredRuleInvoices.every((invoice) => selectedRuleInvoiceIds.includes(invoice.id));

  const toggleSelectAllFilteredCustomers = (checked: boolean) => {
    if (!checked) {
      setSelectedRuleCustomerIds((prev) =>
        prev.filter((id) => !filteredRuleCustomers.some((customer) => customer.id === id))
      );
      return;
    }
    const filteredIds = filteredRuleCustomers.map((customer) => customer.id);
    setSelectedRuleCustomerIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
  };

  const toggleSelectAllFilteredInvoices = (checked: boolean) => {
    if (!checked) {
      setSelectedRuleInvoiceIds((prev) =>
        prev.filter((id) => !filteredRuleInvoices.some((invoice) => invoice.id === id))
      );
      return;
    }
    const filteredIds = filteredRuleInvoices.map((invoice) => invoice.id);
    setSelectedRuleInvoiceIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
  };

  const toggleCustomerRuleSelection = (customerId: string, checked: boolean) => {
    setSelectedRuleCustomerIds((prev) =>
      checked ? Array.from(new Set([...prev, customerId])) : prev.filter((id) => id !== customerId)
    );
  };

  const toggleInvoiceRuleSelection = (invoiceId: string, checked: boolean) => {
    setSelectedRuleInvoiceIds((prev) =>
      checked ? Array.from(new Set([...prev, invoiceId])) : prev.filter((id) => id !== invoiceId)
    );
  };

  const assignRuleToCustomers = async () => {
    if (!customerRuleId) {
      toast({
        title: 'Rule required',
        description: 'Please select a billing rule for customers.',
        variant: 'destructive',
      });
      return;
    }
    if (selectedRuleCustomerIds.length === 0) {
      toast({
        title: 'No customers selected',
        description: 'Please select at least one customer.',
        variant: 'destructive',
      });
      return;
    }

    const payload = {
      ruleId: customerRuleId,
      customerIds: selectedRuleCustomerIds,
      effectiveFrom: effectiveFromDate || undefined,
      alsoApplyToUnreleasedInvoices: applyToUnreleasedInvoices,
    };

    setIsAssigningRuleToCustomers(true);
    try {
      const candidates = [
        `${API_BASE_URL}/billing/rules/assign-customers`,
        `${API_BASE_URL}/billing/rules/${customerRuleId}/assign-customers`,
      ];

      let response: Response | null = null;
      let responseData: any = null;
      let lastError = 'Failed to assign billing rule to customers.';
      for (const url of candidates) {
        const current = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        const data = await current.json().catch(() => null);
        if (current.ok) {
          response = current;
          responseData = data;
          break;
        }
        lastError =
          Array.isArray(data?.message) ? data.message.join(', ') : data?.message ?? lastError;
        if (current.status !== 404) break;
      }

      if (!response) {
        throw new Error(lastError);
      }

      const appliedCount = Number(responseData?.updatedCount ?? selectedRuleCustomerIds.length);
      const selectedRuleName = billingRules.find((rule) => rule.id === customerRuleId)?.name || customerRuleId;
      setCustomers((prev) =>
        prev.map((customer) =>
          selectedRuleCustomerIds.includes(customer.id)
            ? {
                ...customer,
                billingRuleId: customerRuleId,
                billingRuleName: selectedRuleName,
              }
            : customer,
        ),
      );
      logAdminActivity(
        'billing_rule_assigned_customers',
        'Billing rule assigned to customers.',
        'billing_rule',
        customerRuleId,
        selectedRuleName,
        { customerCount: appliedCount, effectiveFrom: payload.effectiveFrom || null }
      );

      toast({
        title: 'Rule assigned',
        description: `${appliedCount} customer(s) updated.`,
      });
      setSelectedRuleCustomerIds([]);
      fetchCustomers();
      if (applyToUnreleasedInvoices) {
        fetchInvoices();
      }
    } catch (error) {
      toast({
        title: 'Assignment failed',
        description: error instanceof Error ? error.message : 'Failed to assign rule to customers',
        variant: 'destructive',
      });
    } finally {
      setIsAssigningRuleToCustomers(false);
    }
  };

  const assignRuleToInvoices = async () => {
    if (!invoiceRuleId) {
      toast({
        title: 'Rule required',
        description: 'Please select a billing rule for invoices.',
        variant: 'destructive',
      });
      return;
    }
    if (selectedRuleInvoiceIds.length === 0) {
      toast({
        title: 'No invoices selected',
        description: 'Please select at least one invoice.',
        variant: 'destructive',
      });
      return;
    }

    const payload = {
      ruleId: invoiceRuleId,
      invoiceIds: selectedRuleInvoiceIds,
      recalculate: recalculateAssignedInvoices,
    };

    setIsAssigningRuleToInvoices(true);
    try {
      const candidates = [
        `${API_BASE_URL}/billing/rules/assign-invoices`,
        `${API_BASE_URL}/billing/rules/${invoiceRuleId}/assign-invoices`,
      ];

      let response: Response | null = null;
      let responseData: any = null;
      let lastError = 'Failed to assign billing rule to invoices.';
      for (const url of candidates) {
        const current = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        const data = await current.json().catch(() => null);
        if (current.ok) {
          response = current;
          responseData = data;
          break;
        }
        lastError =
          Array.isArray(data?.message) ? data.message.join(', ') : data?.message ?? lastError;
        if (current.status !== 404) break;
      }

      if (!response) {
        throw new Error(lastError);
      }

      const appliedCount = Number(responseData?.updatedCount ?? selectedRuleInvoiceIds.length);
      const selectedRuleName = billingRules.find((rule) => rule.id === invoiceRuleId)?.name || invoiceRuleId;
      setInvoices((prev) =>
        prev.map((invoice) =>
          selectedRuleInvoiceIds.includes(invoice.id)
            ? {
                ...invoice,
                billingRuleId: invoiceRuleId,
                billingRuleName: selectedRuleName,
              }
            : invoice,
        ),
      );
      logAdminActivity(
        'billing_rule_assigned_invoices',
        'Billing rule assigned to invoices.',
        'billing_rule',
        invoiceRuleId,
        selectedRuleName,
        { invoiceCount: appliedCount, recalculate: recalculateAssignedInvoices }
      );

      toast({
        title: 'Rule assigned',
        description: `${appliedCount} invoice(s) updated.`,
      });
      setSelectedRuleInvoiceIds([]);
      fetchInvoices();
    } catch (error) {
      toast({
        title: 'Assignment failed',
        description: error instanceof Error ? error.message : 'Failed to assign rule to invoices',
        variant: 'destructive',
      });
    } finally {
      setIsAssigningRuleToInvoices(false);
    }
  };

  const activeGlobalAdjustments = useMemo(
    () => globalAdjustments.filter((item) => item.isActive),
    [globalAdjustments],
  );

  const getGlobalAdjustmentKey = (item: GlobalAdjustmentOption, index: number) =>
    item.id ?? `idx-${index}`;

  const openInvoiceDetail = (invoice: InvoiceRecord, mode: 'view' | 'edit' = 'view') => {
    setInvoiceDetailMode(mode);
    setSelectedInvoice(invoice);
    const invoiceRuleDetails = getInvoiceRuleDetails(invoice);
    const rows =
      invoice.adjustments?.map((adjustment, index) => ({
        description: adjustment.description,
        type: adjustment.type,
        valueType: adjustment.valueType,
        value: toNumber(adjustment.value).toString(),
        rememberForNext: Boolean(adjustment.rememberForNext),
        sortOrder: adjustment.sortOrder ?? index,
      })) ?? [];
    setAdjustmentRows(rows);
    setPaymentMethod(invoice.paymentMethod || 'Cash');
    setReceiptNo(invoice.receiptNo || '');
    setEditedInvoiceRuleId(invoiceRuleDetails.id || INVOICE_RULE_NONE_VALUE);
    setDetailOpen(true);
  };

  const addAdjustmentRow = (type: AdjustmentType) => {
    setAdjustmentRows((prev) => [
      ...prev,
      {
        description: '',
        type,
        valueType: 'fixed',
        value: '',
        rememberForNext: false,
        sortOrder: prev.length,
      },
    ]);
  };

  const addSelectedGlobalAdjustment = () => {
    if (selectedGlobalAdjustmentIds.length === 0) {
      toast({
        title: 'Choose adjustment',
        description: 'Select one or more global adjustments from dropdown first.',
        variant: 'destructive',
      });
      return;
    }

    const selectedItems = activeGlobalAdjustments.filter((item, index) =>
      selectedGlobalAdjustmentIds.includes(getGlobalAdjustmentKey(item, index)),
    );
    if (selectedItems.length === 0) {
      toast({
        title: 'Not found',
        description: 'Selected adjustments are no longer available. Refresh and try again.',
        variant: 'destructive',
      });
      return;
    }

    setAdjustmentRows((prev) => {
      const startSortOrder = prev.length;
      const mapped = selectedItems.map((item, index) => ({
        description: item.description,
        type: item.type,
        valueType: item.valueType,
        value: item.value,
        rememberForNext: false,
        sortOrder: startSortOrder + index,
      }));
      return [...prev, ...mapped];
    });
    setSelectedGlobalAdjustmentIds([]);
  };

  const updateAdjustmentRow = <K extends keyof AdjustmentFormRow>(
    index: number,
    key: K,
    value: AdjustmentFormRow[K],
  ) => {
    setAdjustmentRows((prev) =>
      prev.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)),
    );
  };

  const removeAdjustmentRow = (index: number) => {
    setAdjustmentRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
  };

  const selectedInvoicePricingPreview = useMemo(() => {
    if (!selectedInvoice) {
      return {
        cycleMonths: 1,
        unitMonthlyFee: 0,
        serviceAmount: 0,
      };
    }

    const cycleMonths = Math.max(1, editedInvoiceCycleMonths);
    const planMonthlyFee = toNumber(selectedInvoice.subscription?.plan?.monthlyFee);
    const invoiceMonthlyFee = toNumber(selectedInvoice.monthlyFee);
    const unitMonthlyFee = planMonthlyFee > 0 ? planMonthlyFee : invoiceMonthlyFee;

    return {
      cycleMonths,
      unitMonthlyFee,
      serviceAmount: unitMonthlyFee * cycleMonths,
    };
  }, [selectedInvoice, editedInvoiceCycleMonths]);

  const adjustmentPreview = useMemo(() => {
    if (!selectedInvoice) {
      return {
        baseSubtotal: 0,
        plusTotal: 0,
        minusTotal: 0,
        discountBase: 0,
        total: 0,
      };
    }

    const baseSubtotal =
      selectedInvoicePricingPreview.serviceAmount +
      toNumber(selectedInvoice.installationFee) +
      toNumber(selectedInvoice.additionalFees);

    const dynamic = adjustmentRows.reduce(
      (acc, row) => {
        const raw = toNumber(row.value);
        const amount = row.valueType === 'percent' ? (baseSubtotal * raw) / 100 : raw;
        if (row.type === 'plus') {
          acc.plus += amount;
        } else {
          acc.minus += amount;
        }
        return acc;
      },
      { plus: 0, minus: 0 },
    );

    const discountBase = toNumber(selectedInvoice.discountAmount);
    const minusTotal = discountBase + dynamic.minus;
    const total = baseSubtotal + dynamic.plus - minusTotal;

    return {
      baseSubtotal,
      plusTotal: dynamic.plus,
      minusTotal,
      discountBase,
      total,
    };
  }, [selectedInvoice, selectedInvoicePricingPreview.serviceAmount, adjustmentRows]);

  const saveAdjustments = async () => {
    if (!selectedInvoice) return;
    const invoiceStatus = normalizeInvoiceStatusLabel(selectedInvoice.status);
    if (invoiceStatus === 'paid') {
      toast({
        title: 'Invoice is locked',
        description: 'Paid invoices cannot be changed.',
        variant: 'destructive',
      });
      return;
    }

    const invalid = adjustmentRows.find(
      (row) => row.description.trim().length === 0 || toNumber(row.value) < 0,
    );

    if (invalid) {
      toast({
        title: 'Invalid adjustment',
        description: 'Each row needs a description and non-negative value.',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingAdjustments(true);

    try {
      const customerId = selectedInvoice.customer?.id;
      if (!customerId) {
        throw new Error('Customer not found for this invoice.');
      }

      const customerProfile = customers.find(
        (item) =>
          item.id === customerId ||
          (selectedInvoice.customer?.customerCode &&
            item.customerCode === selectedInvoice.customer.customerCode),
      );

      const localAssignments = readBillingRuleAssignments();
      const localRuleId =
        (selectedInvoice.id && localAssignments.invoices[selectedInvoice.id]) ||
        (customerId && localAssignments.customers[customerId]) ||
        null;
      const selectedRuleIdFromEditor =
        editedInvoiceRuleId && editedInvoiceRuleId !== INVOICE_RULE_NONE_VALUE
          ? editedInvoiceRuleId.trim()
          : null;
      const selectedRule =
        (selectedRuleIdFromEditor
          ? billingRules.find((rule) => rule.id === selectedRuleIdFromEditor)
          : null) ??
        billingRules.find(
          (rule) =>
            rule.id === selectedInvoice.billingRuleId ||
            rule.id === selectedInvoice.ruleId ||
            (localRuleId ? rule.id === localRuleId : false),
        ) ??
        null;
      const effectiveRuleId = selectedRuleIdFromEditor ?? selectedRule?.id ?? localRuleId ?? null;

      let cancelledInBackend = invoiceStatus === 'cancelled';
      if (!cancelledInBackend) {
        await cancelInvoiceInBackend(selectedInvoice.id);
        cancelledInBackend = true;
      }

      if (localCancelledInvoiceIds[selectedInvoice.id]) {
        const nextLocalCancelled = { ...localCancelledInvoiceIds };
        delete nextLocalCancelled[selectedInvoice.id];
        setLocalCancelledInvoiceIds(nextLocalCancelled);
      }

      const billingMode: BillingMode = selectedRule
        ? selectedRule.billingType === 'anniversary'
          ? 'anniversary'
          : 'fixed'
        : customerProfile
          ? inferBillingMode(customerProfile, selectedInvoice, fixedBillingWindow)
          : String(selectedInvoice.invoiceType || '')
              .toLowerCase()
              .includes('anniversary')
            ? 'anniversary'
            : 'fixed';
      const resolvedFixedBillingDay =
        parsePositiveInt(selectedRule?.fixedBillingDay) ?? fixedBillingWindow.startDay;
      const resolvedDueAfterDays = parseNonNegativeInt(selectedRule?.dueAfterDays);
      const resolvedCustomMonths =
        parsePositiveInt(selectedRule?.customMonths) ??
        inferCustomMonthsFromRuleName(selectedRule?.name);
      const normalizedRuleBillingMode = String(selectedRule?.billingMode ?? '')
        .trim()
        .toLowerCase();
      const derivedBillingCycle = (() => {
        if (normalizedRuleBillingMode === 'quarterly') return 'Quarterly';
        if (normalizedRuleBillingMode === 'yearly' || normalizedRuleBillingMode === 'annual') return 'Yearly';
        if (
          normalizedRuleBillingMode === 'custom' ||
          normalizedRuleBillingMode === 'bi-yearly' ||
          normalizedRuleBillingMode === 'bi_yearly' ||
          normalizedRuleBillingMode === 'biyearly' ||
          normalizedRuleBillingMode === 'semiannual' ||
          normalizedRuleBillingMode === 'semi-annual'
        ) {
          return 'Custom';
        }
        return 'Monthly';
      })();

      const generateResponse = await fetch(
        `${API_BASE_URL}/billing/customers/${customerId}/invoices/generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            firstInvoiceMode: billingMode,
            fixedStartDay: resolvedFixedBillingDay,
            fixedDueDay: fixedBillingWindow.dueDay,
            billingCycle: derivedBillingCycle,
            billingRuleId: effectiveRuleId ?? undefined,
            billingRuleName: selectedRule?.name ?? undefined,
            billingMode: selectedRule?.billingMode ?? undefined,
            customMonths:
              normalizedRuleBillingMode === 'bi-yearly' ||
              normalizedRuleBillingMode === 'bi_yearly' ||
              normalizedRuleBillingMode === 'biyearly' ||
              normalizedRuleBillingMode === 'semiannual' ||
              normalizedRuleBillingMode === 'semi-annual'
                ? 6
                : resolvedCustomMonths ?? undefined,
            dueAfterDays: resolvedDueAfterDays ?? undefined,
          }),
        },
      );

      const generateData = await generateResponse.json().catch(() => null);
      if (!generateResponse.ok) {
        const message = Array.isArray(generateData?.message)
          ? generateData.message.join(', ')
          : generateData?.message ?? 'Failed to generate new invoice';
        throw new Error(message);
      }

      const createdInvoiceId = typeof generateData?.id === 'string' ? generateData.id : '';
      if (!createdInvoiceId) {
        throw new Error('New invoice ID is missing from backend response.');
      }

      const persistCustomerBillingConfig = async () => {
        const customerBillingPayload = {
          billingRuleId: effectiveRuleId ?? null,
          billingRuleName: selectedRule?.name ?? null,
          billingCycle: derivedBillingCycle,
          firstInvoiceMode: billingMode,
          billingMode: selectedRule?.billingMode ?? null,
          customMonths:
            normalizedRuleBillingMode === 'bi-yearly' ||
            normalizedRuleBillingMode === 'bi_yearly' ||
            normalizedRuleBillingMode === 'biyearly' ||
            normalizedRuleBillingMode === 'semiannual' ||
            normalizedRuleBillingMode === 'semi-annual'
              ? 6
              : resolvedCustomMonths ?? null,
          fixedStartDay: billingMode === 'fixed' ? resolvedFixedBillingDay : null,
          fixedDueDay: fixedBillingWindow.dueDay,
          dueAfterDays: resolvedDueAfterDays ?? null,
        };

        const candidates: Array<{ method: 'PATCH'; path: string }> = [
          { method: 'PATCH', path: `${API_BASE_URL}/customers/${customerId}` },
          { method: 'PATCH', path: `${API_BASE_URL}/billing/customers/${customerId}` },
          { method: 'PATCH', path: `${API_BASE_URL}/billing/customers/${customerId}/billing-config` },
        ];

        for (const candidate of candidates) {
          try {
            const response = await fetch(candidate.path, {
              method: candidate.method,
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(customerBillingPayload),
            });
            if (response.ok) {
              setCustomers((prev) =>
                prev.map((item) =>
                  item.id === customerId
                    ? {
                        ...item,
                        billingCycle: derivedBillingCycle,
                        firstInvoiceMode: billingMode,
                        billingRuleId: effectiveRuleId ?? null,
                        billingRuleName: selectedRule?.name ?? null,
                      }
                    : item,
                ),
              );
              return true;
            }
            if (response.status !== 404) {
              return false;
            }
          } catch {
            // try next endpoint variant
          }
        }
        return false;
      };

      const ensureInvoiceReleasedNow = async (invoiceId: string) => {
        const releaseDate = formatDateYmd(new Date());
        const releaseCandidates: Array<{
          method: 'PATCH' | 'POST';
          path: string;
          body?: Record<string, unknown>;
        }> = [
          {
            method: 'PATCH',
            path: `${API_BASE_URL}/billing/invoices/${invoiceId}`,
            body: {
              releaseDate,
              scheduledReleaseDate: releaseDate,
              releaseAt: new Date().toISOString(),
            },
          },
          {
            method: 'PATCH',
            path: `${API_BASE_URL}/billing/invoices/${invoiceId}/release-date`,
            body: { releaseDate },
          },
          {
            method: 'PATCH',
            path: `${API_BASE_URL}/billing/invoices/${invoiceId}/release`,
            body: { releaseDate },
          },
          {
            method: 'POST',
            path: `${API_BASE_URL}/billing/invoices/${invoiceId}/release`,
            body: { releaseDate },
          },
        ];

        for (const candidate of releaseCandidates) {
          try {
            const releaseResponse = await fetch(candidate.path, {
              method: candidate.method,
              headers: {
                'Content-Type': 'application/json',
              },
              body: candidate.body ? JSON.stringify(candidate.body) : undefined,
            });
            if (releaseResponse.ok) {
              return true;
            }
            if (releaseResponse.status !== 404) {
              break;
            }
          } catch {
            // try next endpoint variant
          }
        }
        return false;
      };

      await ensureInvoiceReleasedNow(createdInvoiceId);
      await persistCustomerBillingConfig();

      if (effectiveRuleId) {
        const assignPayload = {
          ruleId: effectiveRuleId,
          invoiceIds: [createdInvoiceId],
          recalculate: true,
        };

        const assignCandidates = [
          `${API_BASE_URL}/billing/rules/assign-invoices`,
          `${API_BASE_URL}/billing/rules/${effectiveRuleId}/assign-invoices`,
        ];

        let ruleAssigned = false;
        let assignError = 'Failed to bind selected billing rule to new invoice.';
        for (const url of assignCandidates) {
          const assignResponse = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(assignPayload),
          });
          const assignData = await assignResponse.json().catch(() => null);
          if (assignResponse.ok) {
            ruleAssigned = true;
            break;
          }
          assignError = Array.isArray(assignData?.message)
            ? assignData.message.join(', ')
            : assignData?.message ?? assignError;
          if (assignResponse.status !== 404) {
            break;
          }
        }

        if (!ruleAssigned) {
          throw new Error(assignError);
        }
      }

      const adjustmentsPayload = {
        adjustments: adjustmentRows.map((row, index) => ({
          description: row.description.trim(),
          type: row.type,
          valueType: row.valueType,
          value: toNumber(row.value),
          rememberForNext: row.rememberForNext,
          sortOrder: row.sortOrder ?? index,
        })),
      };

      const response = await fetch(`${API_BASE_URL}/billing/invoices/${createdInvoiceId}/adjustments`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(adjustmentsPayload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? 'Failed to save adjustments');
      }

      const updatedRaw = (await response.json()) as InvoiceRecord;
      const updated: InvoiceRecord = {
        ...updatedRaw,
        status: normalizeInvoiceStatusLabel(updatedRaw.status) as InvoiceStatus,
        billingRuleId:
          updatedRaw.billingRuleId ??
          updatedRaw.ruleId ??
          effectiveRuleId ??
          null,
        billingRuleName:
          updatedRaw.billingRuleName ??
          updatedRaw.ruleName ??
          selectedRule?.name ??
          null,
      };

      setSelectedInvoice(updated);
      setForceReleasedInvoiceIds((prev) => ({
        ...prev,
        [updated.id]: true,
      }));
      setEditedInvoiceRuleId(
        effectiveRuleId && effectiveRuleId.trim()
          ? effectiveRuleId
          : updated.billingRuleId && updated.billingRuleId.trim()
            ? updated.billingRuleId
          : INVOICE_RULE_NONE_VALUE,
      );
      setInvoices((prev) => {
        const withCancelledOld = prev.map((invoice) =>
          invoice.id === selectedInvoice.id ? { ...invoice, status: 'cancelled' as InvoiceStatus } : invoice,
        );
        const nextIndex = withCancelledOld.findIndex((invoice) => invoice.id === updated.id);
        if (nextIndex >= 0) {
          const cloned = [...withCancelledOld];
          cloned[nextIndex] = updated;
          return applyLocalCancelledStatuses(cloned, localCancelledInvoiceIds);
        }
        return applyLocalCancelledStatuses([updated, ...withCancelledOld], localCancelledInvoiceIds);
      });

      const rows =
        updated.adjustments?.map((adjustment, index) => ({
          description: adjustment.description,
          type: adjustment.type,
          valueType: adjustment.valueType,
          value: toNumber(adjustment.value).toString(),
          rememberForNext: Boolean(adjustment.rememberForNext),
          sortOrder: adjustment.sortOrder ?? index,
        })) ?? [];
      setAdjustmentRows(rows);

      logAdminActivity(
        'invoice_edited_new_revision',
        'Invoice edited by creating a new invoice revision and cancelling previous invoice.',
        'invoice',
        updated.id,
        updated.invoiceNo || updated.id,
        {
          previousInvoiceId: selectedInvoice.id,
          previousInvoiceNo: selectedInvoice.invoiceNo || selectedInvoice.id,
          backendCancelledOldInvoice: cancelledInBackend,
          billingRuleId: effectiveRuleId,
          billingRuleName: selectedRule?.name ?? null,
          adjustmentCount: adjustmentRows.length
        }
      );

      toast({
        title: 'New invoice created',
        description: 'Old invoice was cancelled and a new invoice number was created in current cycle.',
      });

      await fetchInvoices();
    } catch (error) {
      toast({
        title: 'Failed to save',
        description: error instanceof Error ? error.message : 'Failed to save adjustments',
        variant: 'destructive',
      });
    } finally {
      setIsSavingAdjustments(false);
    }
  };

  const markInvoicePaid = async () => {
    if (!selectedInvoice) return;
    const invoiceStatus = normalizeInvoiceStatusLabel(selectedInvoice.status);
    if (invoiceStatus === 'paid' || invoiceStatus === 'cancelled') {
      toast({
        title: 'Invoice is locked',
        description: 'Paid or cancelled invoices cannot be marked again.',
        variant: 'destructive',
      });
      return;
    }

    setIsMarkingPaid(true);
    try {
      const shouldUseManualPaymentFields = selectedCollectionStatus === 'office_transfer';
      const response = await fetch(`${API_BASE_URL}/billing/invoices/${selectedInvoice.id}/receipt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          shouldUseManualPaymentFields
            ? {
                paymentMethod: paymentMethod.trim() || undefined,
                receiptNo: receiptNo.trim() || undefined,
              }
            : {},
        ),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? 'Failed to confirm payment');
      }

      const updatedRaw = (await response.json().catch(() => null)) as Partial<InvoiceRecord> | null;
      const normalizedPaidStatus = normalizeInvoiceStatusLabel(updatedRaw?.status ?? 'paid') as InvoiceStatus;
      const updated: InvoiceRecord = {
        ...selectedInvoice,
        ...(updatedRaw ?? {}),
        status: normalizedPaidStatus,
      };
      setSelectedInvoice(updated);
      setInvoices((prev) =>
        prev.map((invoice) =>
          invoice.id === selectedInvoice.id
            ? {
                ...invoice,
                ...(updatedRaw ?? {}),
                status: normalizedPaidStatus,
              }
            : invoice,
        ),
      );

      logAdminActivity(
        'invoice_paid',
        'Invoice confirmed, receipt generated, and marked as paid.',
        'invoice',
        updated.id,
        updated.invoiceNo || updated.id,
        {
          paymentMethod: shouldUseManualPaymentFields ? paymentMethod.trim() || null : null,
          receiptNo: shouldUseManualPaymentFields ? receiptNo.trim() || null : null
        }
      );

      toast({
        title: 'Payment confirmed',
        description: 'Receipt generated and invoice marked as paid. Next invoice is now scheduled in billing engine.',
      });
    } catch (error) {
      toast({
        title: 'Confirmation failed',
        description: error instanceof Error ? error.message : 'Failed to confirm payment',
        variant: 'destructive',
      });
    } finally {
      setIsMarkingPaid(false);
    }
  };

  const generateReceiptForInvoice = async (invoice: InvoiceRecord) => {
    const invoiceStatus = normalizeInvoiceStatusLabel(invoice.status);
    if (invoiceStatus !== 'paid') {
      toast({
        title: 'Receipt unavailable',
        description: 'Only paid invoices can generate receipts.',
        variant: 'destructive',
      });
      return;
    }

    if (isGeneratingReceiptByInvoice[invoice.id]) return;

    setIsGeneratingReceiptByInvoice((prev) => ({ ...prev, [invoice.id]: true }));
    try {
      const response = await fetch(`${API_BASE_URL}/billing/invoices/${invoice.id}/receipt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message = Array.isArray(data?.message)
          ? data.message.join(', ')
          : data?.message ?? 'Failed to generate receipt';
        throw new Error(message);
      }

      const nextStatus = normalizeInvoiceStatusLabel(data?.status ?? invoice.status);
      const nextReceiptNo = data?.receiptNo ?? invoice.receiptNo ?? null;
      const nextPaymentMethod = data?.paymentMethod ?? invoice.paymentMethod ?? null;

      setInvoices((prev) =>
        prev.map((item) =>
          item.id === invoice.id
            ? {
                ...item,
                ...(data ?? {}),
                status: nextStatus as InvoiceStatus,
                receiptNo: nextReceiptNo,
                paymentMethod: nextPaymentMethod,
              }
            : item,
        ),
      );

      if (selectedInvoice?.id === invoice.id) {
        setSelectedInvoice((prev) =>
          prev
            ? {
                ...prev,
                ...(data ?? {}),
                status: nextStatus as InvoiceStatus,
                receiptNo: nextReceiptNo,
                paymentMethod: nextPaymentMethod,
              }
            : prev,
        );
        if (nextReceiptNo) {
          setReceiptNo(nextReceiptNo);
        }
      }

      logAdminActivity(
        'receipt_generated',
        'Receipt generated from invoice list.',
        'invoice',
        invoice.id,
        invoice.invoiceNo || invoice.id,
        {
          receiptNo: nextReceiptNo,
          paymentMethod: nextPaymentMethod,
        },
      );

      toast({
        title: 'Receipt generated',
        description: nextReceiptNo ? `Receipt: ${nextReceiptNo}` : 'Receipt generated successfully.',
      });
    } catch (error) {
      toast({
        title: 'Generate receipt failed',
        description: error instanceof Error ? error.message : 'Failed to generate receipt.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingReceiptByInvoice((prev) => ({ ...prev, [invoice.id]: false }));
    }
  };

  const applyLateFeesAndOverdueStatuses = useCallback(
    async (silent = false) => {
      if (isApplyingLateFees) return;
      if (invoices.length === 0) return;

      const customerById = new Map(customers.map((customer) => [customer.id, customer]));
      const customerByCode = new Map(customers.map((customer) => [customer.customerCode, customer]));
      const localAssignments = readBillingRuleAssignments();

      const rulesById = new Map(billingRules.map((rule) => [rule.id, rule]));
      const rulesByName = new Map(
        billingRules.map((rule) => [rule.name.trim().toLowerCase(), rule]),
      );

      const getRuleForInvoice = (invoice: InvoiceRecord): BillingRule | null => {
        const customer = invoice.customer?.id
          ? customerById.get(invoice.customer.id)
          : invoice.customer?.customerCode
            ? customerByCode.get(invoice.customer.customerCode)
            : undefined;

        const possibleRuleIds = [
          invoice.billingRuleId,
          invoice.ruleId,
          invoice.billingRule?.id ?? null,
          invoice.rule?.id ?? null,
          customer?.billingRuleId ?? null,
          invoice.id && localAssignments.invoices[invoice.id]
            ? localAssignments.invoices[invoice.id]
            : null,
          invoice.customer?.id && localAssignments.customers[invoice.customer.id]
            ? localAssignments.customers[invoice.customer.id]
            : null,
        ]
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          .map((value) => value.trim());

        for (const ruleId of possibleRuleIds) {
          const found = rulesById.get(ruleId);
          if (found) return found;
        }

        const possibleRuleNames = [
          invoice.billingRuleName,
          invoice.ruleName,
          invoice.billingRule?.name ?? null,
          invoice.rule?.name ?? null,
          customer?.billingRuleName ?? null,
        ]
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          .map((value) => value.trim().toLowerCase());

        for (const ruleName of possibleRuleNames) {
          const found = rulesByName.get(ruleName);
          if (found) return found;
        }

        return null;
      };

      const findLateFeeAdjustmentIndex = (
        adjustments: Array<{
          description: string;
          type: AdjustmentType;
          valueType: AdjustmentValueType;
          value: number;
          rememberForNext: boolean;
          sortOrder: number;
        }>,
      ) =>
        adjustments.findIndex((adjustment) => {
          const description = (adjustment.description || '').toLowerCase();
          return adjustment.type === 'plus' && description.includes('late fee');
        });

      const patchInvoiceOverdueStatus = async (invoiceId: string) => {
        const candidates: Array<{ method: 'PATCH'; path: string; body: Record<string, unknown> }> = [
          {
            method: 'PATCH',
            path: `${API_BASE_URL}/billing/invoices/${invoiceId}/status`,
            body: { status: 'overdue' },
          },
          {
            method: 'PATCH',
            path: `${API_BASE_URL}/billing/invoices/${invoiceId}`,
            body: { status: 'overdue' },
          },
        ];

        for (const candidate of candidates) {
          try {
            const response = await fetch(candidate.path, {
              method: candidate.method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(candidate.body),
            });
            if (response.ok) {
              return true;
            }
          } catch {
            // try the next endpoint variant
          }
        }

        return false;
      };

      const todayStart = startOfDay(new Date()).getTime();
      let changedInBackend = false;
      let overdueUpdated = 0;
      let lateFeeApplied = 0;
      const locallyUpdatedOverdueIds: string[] = [];
      const errors: string[] = [];

      setIsApplyingLateFees(true);
      try {
        for (const invoice of invoices) {
          if (invoice.status === 'paid' || invoice.status === 'cancelled') continue;
          const dueDateRaw = parseDateSafe(invoice.dueDate);
          if (!dueDateRaw) continue;

          const dueDate = startOfDay(dueDateRaw);
          const rule = getRuleForInvoice(invoice);
          const graceDays = Math.max(0, Number(rule?.graceDays ?? 0) || 0);
          const lateFeeTriggerDays = Math.max(0, Number(rule?.lateFeeTriggerDays ?? 0) || 0);

          const overdueThreshold = addDays(dueDate, graceDays).getTime();
          const isOverdueNow = todayStart > overdueThreshold;

          if (invoice.status === 'unpaid' && isOverdueNow) {
            const patched = await patchInvoiceOverdueStatus(invoice.id);
            if (patched) {
              overdueUpdated += 1;
              changedInBackend = true;
            } else {
              locallyUpdatedOverdueIds.push(invoice.id);
              overdueUpdated += 1;
            }
          }

          if (!rule?.lateFeeEnabled) continue;

          const lateFeeThreshold = addDays(dueDate, graceDays + lateFeeTriggerDays).getTime();
          const isLateFeeDue = todayStart > lateFeeThreshold;
          if (!isLateFeeDue) continue;

          const lateFeeType: AdjustmentValueType = rule.lateFeeType === 'percent' ? 'percent' : 'fixed';
          const lateFeeApplyMode = rule.lateFeeApplyMode === 'per_day' ? 'per_day' : 'once';
          const baseLateFeeValue = Number(rule.lateFeeValue ?? 0);
          if (!Number.isFinite(baseLateFeeValue) || baseLateFeeValue <= 0) continue;

          const lateDays = Math.max(
            1,
            Math.floor((todayStart - lateFeeThreshold) / (24 * 60 * 60 * 1000)),
          );
          const effectiveLateFeeValue =
            lateFeeApplyMode === 'per_day'
              ? baseLateFeeValue * lateDays
              : baseLateFeeValue;

          const existingAdjustments = (invoice.adjustments ?? []).map((adjustment, index) => ({
            description: adjustment.description,
            type: adjustment.type,
            valueType: adjustment.valueType,
            value: toNumber(adjustment.value),
            rememberForNext: Boolean(adjustment.rememberForNext),
            sortOrder: adjustment.sortOrder ?? index,
          }));

          const existingLateFeeIndex = findLateFeeAdjustmentIndex(existingAdjustments);
          if (lateFeeApplyMode === 'once' && existingLateFeeIndex >= 0) {
            continue;
          }

          const lateFeeDescription =
            lateFeeApplyMode === 'per_day'
              ? lateFeeType === 'percent'
                ? `Late Fee (${baseLateFeeValue}% / day)`
                : 'Late Fee (Per Day)'
              : lateFeeType === 'percent'
                ? `Late Fee (${baseLateFeeValue}%)`
                : 'Late Fee';

          let nextAdjustments = [...existingAdjustments];
          if (existingLateFeeIndex >= 0) {
            const existingLateFee = nextAdjustments[existingLateFeeIndex];
            const hasChanged =
              existingLateFee.valueType !== lateFeeType ||
              Math.abs(existingLateFee.value - effectiveLateFeeValue) > 0.0001 ||
              existingLateFee.description !== lateFeeDescription;
            if (!hasChanged) {
              continue;
            }
            nextAdjustments[existingLateFeeIndex] = {
              ...existingLateFee,
              description: lateFeeDescription,
              valueType: lateFeeType,
              value: effectiveLateFeeValue,
              type: 'plus',
            };
          } else {
            nextAdjustments = [
              ...nextAdjustments,
              {
                description: lateFeeDescription,
                type: 'plus' as const,
                valueType: lateFeeType,
                value: effectiveLateFeeValue,
                rememberForNext: false,
                sortOrder: nextAdjustments.length,
              },
            ];
          }

          try {
            const response = await fetch(`${API_BASE_URL}/billing/invoices/${invoice.id}/adjustments`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                adjustments: nextAdjustments,
              }),
            });

            if (!response.ok) {
              const data = await response.json().catch(() => null);
              const message =
                Array.isArray(data?.message)
                  ? data.message.join(', ')
                  : data?.message ?? 'Failed to apply late fee';
              throw new Error(message);
            }

            lateFeeApplied += 1;
            changedInBackend = true;
          } catch (error) {
            const invoiceNo = invoice.invoiceNo || invoice.id;
            const reason = error instanceof Error ? error.message : 'Failed to apply late fee';
            errors.push(`${invoiceNo}: ${reason}`);
          }
        }

        if (locallyUpdatedOverdueIds.length > 0) {
          setInvoices((prev) =>
            prev.map((invoice) =>
              locallyUpdatedOverdueIds.includes(invoice.id)
                ? { ...invoice, status: 'overdue' as InvoiceStatus }
                : invoice,
            ),
          );
        }

        if (changedInBackend) {
          await fetchInvoices();
        }

        if (!silent) {
          if (overdueUpdated === 0 && lateFeeApplied === 0) {
            toast({
              title: 'No late fee updates',
              description: 'No overdue invoices required late-fee processing.',
            });
          } else {
            toast({
              title: 'Late fees processed',
              description: `${overdueUpdated} invoice(s) set overdue, ${lateFeeApplied} late fee(s) applied.`,
            });
          }
        }

        if (errors.length > 0) {
          toast({
            title: 'Some invoices were skipped',
            description: `${errors.length} invoice(s) failed late-fee update.`,
            variant: 'destructive',
          });
        }
      } finally {
        setIsApplyingLateFees(false);
      }
    },
    [billingRules, customers, invoices, isApplyingLateFees, toast],
  );

  const releaseNextInvoice = useCallback(
    async (row: NextInvoiceEngineRow, silent = false) => {
      if (!row.customerId || isReleasingByCustomer[row.customerId]) {
        return false;
      }

      if (row.queuedInvoiceId) {
        if (!silent) {
          toast({
            title: 'Already queued',
            description: 'Next invoice is already queued for this customer.',
          });
        }
        return false;
      }

      if (row.currentInvoiceStatus !== 'paid') {
        if (!silent) {
          toast({
            title: 'Cannot release yet',
            description: 'Current invoice is not paid.',
            variant: 'destructive',
          });
        }
        return false;
      }

      setIsReleasingByCustomer((prev) => ({ ...prev, [row.customerId]: true }));
      try {
        const normalizedCycleMode = String(row.billingCycleMode ?? '')
          .trim()
          .toLowerCase();
        const derivedBillingCycle = (() => {
          if (normalizedCycleMode === 'quarterly') return 'Quarterly';
          if (normalizedCycleMode === 'yearly' || normalizedCycleMode === 'annual') return 'Yearly';
          if (
            normalizedCycleMode === 'custom' ||
            normalizedCycleMode === 'bi-yearly' ||
            normalizedCycleMode === 'bi_yearly' ||
            normalizedCycleMode === 'biyearly' ||
            normalizedCycleMode === 'semiannual' ||
            normalizedCycleMode === 'semi-annual'
          ) {
            return 'Custom';
          }
          return row.billingMode === 'anniversary' || row.billingMode === 'fixed'
            ? 'Monthly'
            : 'Monthly';
        })();
        const response = await fetch(
          `${API_BASE_URL}/billing/customers/${row.customerId}/invoices/generate`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              firstInvoiceMode: row.billingMode,
              fixedStartDay: row.fixedBillingDay ?? fixedBillingWindow.startDay,
              fixedDueDay: fixedBillingWindow.dueDay,
              billingCycle: derivedBillingCycle,
              billingRuleId: row.ruleId ?? undefined,
              billingRuleName: row.ruleName ?? undefined,
              billingMode: row.billingCycleMode ?? undefined,
              customMonths:
                normalizedCycleMode === 'bi-yearly' ||
                normalizedCycleMode === 'bi_yearly' ||
                normalizedCycleMode === 'biyearly' ||
                normalizedCycleMode === 'semiannual' ||
                normalizedCycleMode === 'semi-annual'
                  ? 6
                  : row.customMonths ??
                    inferCustomMonthsFromRuleName(row.ruleName) ??
                    undefined,
              dueAfterDays: row.dueAfterDays ?? undefined,
            }),
          },
        );

        const data = await response.json().catch(() => null);
        if (!response.ok) {
          const message =
            Array.isArray(data?.message)
              ? data.message.join(', ')
              : data?.message ?? 'Failed to release next invoice';
          throw new Error(message);
        }

        const createdInvoiceId =
          typeof data?.id === 'string' && data.id.trim().length > 0 ? data.id : null;
        if (createdInvoiceId && row.ruleId) {
          assignRuleToInvoicesLocally(row.ruleId, [createdInvoiceId]);
        }

        logAdminActivity(
          'invoice_released',
          'Scheduled next invoice released.',
          'invoice',
          data?.id ? String(data.id) : undefined,
          data?.invoiceNo ? String(data.invoiceNo) : undefined,
          {
            customerId: row.customerId,
            customerCode: row.customerCode,
            billingMode: row.billingMode,
            releaseDate: row.releaseDate
          }
        );

        await fetchInvoices();

        if (!silent) {
          toast({
            title: 'Next invoice released',
            description: `${row.customerName} invoice is created.`,
          });
        }

        return true;
      } catch (error) {
        if (!silent) {
          toast({
            title: 'Release failed',
            description:
              error instanceof Error ? error.message : 'Failed to release next invoice',
            variant: 'destructive',
          });
        }
        return false;
      } finally {
        setIsReleasingByCustomer((prev) => ({ ...prev, [row.customerId]: false }));
        setIsEditingScheduleByCustomer((prev) => ({ ...prev, [row.customerId]: false }));
      }
    },
    [fixedBillingWindow.dueDay, fixedBillingWindow.startDay, isReleasingByCustomer, toast],
  );

  const runAutoReleaseNow = useCallback(
    async (silent = false) => {
      if (isRunningAutoRelease) return;
      const dueRows = readyToReleaseRows.filter(
        (row) => !isReleasingByCustomer[row.customerId],
      );

      if (dueRows.length === 0) {
        if (!silent) {
          toast({
            title: 'No due schedules',
            description: 'No invoices are ready for release today.',
          });
        }
        return;
      }

      setIsRunningAutoRelease(true);
      let successCount = 0;

      for (const row of dueRows) {
        const ok = await releaseNextInvoice(row, true);
        if (ok) successCount += 1;
      }

      setIsRunningAutoRelease(false);

      if (!silent) {
        toast({
          title: 'Auto release completed',
          description: `${successCount}/${dueRows.length} invoices released.`,
        });
      }
    },
    [
      isRunningAutoRelease,
      readyToReleaseRows,
      isReleasingByCustomer,
      releaseNextInvoice,
      toast,
    ],
  );

  useEffect(() => {
    if (!autoReleaseEnabled || user?.role !== 'admin') return;

    const run = () => {
      applyLateFeesAndOverdueStatuses(true);
      runAutoReleaseNow(true);
    };

    run();
    const intervalId = window.setInterval(run, 60_000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [autoReleaseEnabled, applyLateFeesAndOverdueStatuses, runAutoReleaseNow, user?.role]);

  const exportInvoicePdf = () => {
    if (!selectedInvoice) return;

    const customerName =
      selectedInvoice.customer?.personalName ||
      selectedInvoice.customer?.companyName ||
      'Unknown Customer';
    const customerCode = selectedInvoice.customer?.customerCode || '—';
    const customerPhone = selectedInvoice.customer?.primaryPhone || '—';
    const customerAddress = selectedInvoice.customer?.installationAddress || '—';
    const packageName =
      selectedInvoice.subscription?.plan?.planName ||
      selectedInvoice.subscription?.plan?.planCode ||
      '—';
    const currency = selectedInvoice.currency || 'MMK';

    let rowNumber = 1;
    const itemRows: string[] = [];

    itemRows.push(`
      <tr>
        <td>${rowNumber++}</td>
        <td>Monthly Internet Fee</td>
        <td class="right">1</td>
        <td class="right">${escapeHtml(formatMoney(selectedInvoice.monthlyFee, currency))}</td>
        <td class="right">${escapeHtml(formatMoney(selectedInvoice.monthlyFee, currency))}</td>
      </tr>
    `);

    if (toNumber(selectedInvoice.installationFee) > 0) {
      itemRows.push(`
        <tr>
          <td>${rowNumber++}</td>
          <td>Installation Fee</td>
          <td class="right">1</td>
          <td class="right">${escapeHtml(formatMoney(selectedInvoice.installationFee, currency))}</td>
          <td class="right">${escapeHtml(formatMoney(selectedInvoice.installationFee, currency))}</td>
        </tr>
      `);
    }

    if (toNumber(selectedInvoice.additionalFees) > 0) {
      itemRows.push(`
        <tr>
          <td>${rowNumber++}</td>
          <td>Additional Fee</td>
          <td class="right">1</td>
          <td class="right">${escapeHtml(formatMoney(selectedInvoice.additionalFees, currency))}</td>
          <td class="right">${escapeHtml(formatMoney(selectedInvoice.additionalFees, currency))}</td>
        </tr>
      `);
    }

    for (const adjustment of selectedInvoice.adjustments || []) {
      itemRows.push(`
        <tr>
          <td>${rowNumber++}</td>
          <td>${escapeHtml(adjustment.description || 'Adjustment')}</td>
          <td class="right">1</td>
          <td class="right">${
            adjustment.valueType === 'percent'
              ? `${escapeHtml(toNumber(adjustment.value).toString())}%`
              : escapeHtml(formatMoney(adjustment.value, currency))
          }</td>
          <td class="right">${
            adjustment.type === 'minus' ? '-' : ''
          }${escapeHtml(formatMoney(adjustment.amount, currency))}</td>
        </tr>
      `);
    }

    const summaryRows =
      selectedInvoice.status === 'paid'
        ? ''
        : `
          <tr>
            <td colspan="4" class="right bold">Subtotal</td>
            <td class="right bold">${escapeHtml(formatMoney(selectedInvoice.subtotalAmount, currency))}</td>
          </tr>
          <tr>
            <td colspan="4" class="right bold">Plus</td>
            <td class="right bold">${escapeHtml(formatMoney(selectedInvoice.plusAmount, currency))}</td>
          </tr>
          <tr>
            <td colspan="4" class="right bold">Minus</td>
            <td class="right bold">${escapeHtml(formatMoney(selectedInvoice.minusAmount, currency))}</td>
          </tr>
        `;

    const paidDate = formatDisplayDate(selectedInvoice.paidAt, '__________');
    const invoiceNoDisplay = formatInvoiceNo(selectedInvoice.invoiceNo, selectedInvoice.id);
    const invoiceRuleName = selectedInvoiceRuleDetails.name || 'Unassigned';
    const invoiceRuleId = selectedInvoiceRuleDetails.id || '—';

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(invoiceNoDisplay)} - Invoice</title>
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
            @media print { .page { margin: 0; border-width: 1px; } }
          </style>
        </head>
        <body>
          <div class="page">
            <h1>Invoice</h1>

            <div class="section">
              <div>Company Name: ABC Internet Service Provider</div>
              <div>Address: No. 123, Main Road, Yangon</div>
              <div>Phone: 09-xxxxxxx</div>
              <div>Email:</div>
            </div>

            <div class="section grid">
              <div>
                <div class="title">Invoice Information</div>
                <div>Invoice No: ${escapeHtml(invoiceNoDisplay)}</div>
                <div>Invoice Date: ${escapeHtml(formatDisplayDate(selectedInvoice.invoiceDate))}</div>
                <div>Invoice Type: ${escapeHtml(formatInvoiceTypeLabel(selectedInvoice.invoiceType))}</div>
                <div>Billing Period: ${escapeHtml(
                  formatDisplayDateRange(selectedInvoice.billingPeriodFrom, selectedInvoice.billingPeriodTo)
                )}</div>
                <div>Due Date: ${escapeHtml(formatDisplayDate(selectedInvoice.dueDate))}</div>
                <div>Billing Rule: ${escapeHtml(invoiceRuleName)}</div>
                <div>Rule ID: ${escapeHtml(invoiceRuleId)}</div>
              </div>
              <div>
                <div class="title">Customer Information</div>
                <div>Customer ID: ${escapeHtml(customerCode)}</div>
                <div>Customer Name: ${escapeHtml(customerName)}</div>
                <div>Phone No: ${escapeHtml(customerPhone)}</div>
                <div>Address: ${escapeHtml(customerAddress)}</div>
                <div>Package: ${escapeHtml(packageName)}</div>
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
                  ${itemRows.join('')}
                  ${summaryRows}
                  <tr>
                    <td colspan="4" class="right total">Total Amount</td>
                    <td class="right total">${escapeHtml(formatMoney(selectedInvoice.totalAmount, currency))}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="section">
              <div class="title">Payment Information</div>
              <div>Payment Method: ${escapeHtml(selectedInvoice.paymentMethod || '—')}</div>
              <div>Payment Status: ${escapeHtml(normalizeInvoiceStatusLabel(selectedInvoice.status))}</div>
              <div>Payment Date: ${escapeHtml(paidDate)}</div>
              <div>Receipt No: ${escapeHtml(selectedInvoice.receiptNo || '__________')}</div>
            </div>

            <div class="section">
              <div class="title">Notes / Terms</div>
              <div>Please pay before the due date to avoid service suspension.</div>
              <div>No refund after billing period started.</div>
              <div>This is a system-generated invoice.</div>
            </div>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        title: 'Popup blocked',
        description: 'Please allow popups to export invoice as PDF.',
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
  };

  const refreshAll = () => {
    fetchInvoices();
    fetchCustomers();
    fetchGlobalAdjustments();
    fetchBillingRules();
    fetchPaymentAccounts();
  };

  const engineStatusLabel = (status: EngineRowStatus) => {
    if (status === 'ready_to_release') return 'Ready To Release';
    if (status === 'scheduled') return 'Scheduled';
    if (status === 'waiting_payment') return 'Waiting Payment';
    if (status === 'no_invoice') return 'No Invoice Yet';
    return 'Releasing...';
  };

  const engineStatusClass = (status: EngineRowStatus) => {
    if (status === 'ready_to_release') {
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    }
    if (status === 'scheduled') {
      return 'bg-blue-50 text-blue-700 border border-blue-200';
    }
    if (status === 'waiting_payment') {
      return 'bg-amber-50 text-amber-700 border border-amber-200';
    }
    if (status === 'no_invoice') {
      return 'bg-slate-100 text-slate-600 border border-slate-200';
    }
    return 'bg-violet-50 text-violet-700 border border-violet-200';
  };

  if (authLoading) {
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
            <h1 className="text-3xl font-bold text-slate-900">Billing Management</h1>
            <p className="text-slate-600">
              Invoice list, next-invoice schedule, and automatic release engine
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => applyLateFeesAndOverdueStatuses(false)}
              disabled={
                isApplyingLateFees ||
                isLoading ||
                customersLoading ||
                billingRulesLoading
              }
            >
              <Zap
                className={`mr-2 h-4 w-4 ${
                  isApplyingLateFees ? 'animate-pulse' : ''
                }`}
              />
              {isApplyingLateFees ? 'Applying...' : 'Apply Late Fees'}
            </Button>
            <Button
              variant="outline"
              onClick={refreshAll}
              disabled={isLoading || customersLoading || globalAdjustmentsLoading || billingRulesLoading}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${
                  isLoading || customersLoading || globalAdjustmentsLoading || billingRulesLoading
                    ? 'animate-spin'
                    : ''
                }`}
              />
              Refresh
            </Button>
          </div>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) =>
            setActiveTab(value as 'invoice-list' | 'next-engine' | 'rule-config' | 'transactions')
          }
        >
          <TabsList>
            <TabsTrigger value="invoice-list">Invoice List</TabsTrigger>
            <TabsTrigger value="next-engine">Next Invoice Engine</TabsTrigger>
            <TabsTrigger value="rule-config">Rule Config</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
          </TabsList>
        </Tabs>

        {activeTab === 'invoice-list' ? (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold">{stats.totalInvoices}</div>
                    <FileText className="h-4 w-4 text-slate-400" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Paid</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold text-emerald-600">{stats.paidCount}</div>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Unpaid</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold text-amber-600">{stats.unpaidCount}</div>
                    <Calendar className="h-4 w-4 text-amber-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Overdue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold text-rose-600">{stats.overdueCount}</div>
                    <Calendar className="h-4 w-4 text-rose-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Paid Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-xl font-bold">{formatMoney(stats.paidRevenue)}</div>
                    <DollarSign className="h-4 w-4 text-slate-400" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-xl font-bold text-rose-600">{formatMoney(stats.outstanding)}</div>
                    <DollarSign className="h-4 w-4 text-rose-400" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-4 md:flex-row">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search by invoice no, customer name, or customer code"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select
                    value={selectedStatus}
                    onValueChange={(value) => setSelectedStatus(value as 'all' | InvoiceStatus)}
                  >
                    <SelectTrigger className="w-full md:w-48">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="unpaid">Unpaid</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Invoices ({filteredInvoices.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading && <p className="mb-4 text-sm text-slate-500">Loading invoices...</p>}
                {loadError && <p className="mb-4 text-sm text-rose-600">{loadError}</p>}
                {!isLoading && !loadError && filteredInvoices.length === 0 && (
                  <p className="mb-4 text-sm text-slate-500">No invoices found.</p>
                )}

                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Rule</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Collection</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInvoices.map((invoice) => {
                        const customerName =
                          invoice.customer?.personalName ||
                          invoice.customer?.companyName ||
                          'Unknown Customer';
                        const ruleDetails = getInvoiceRuleDetails(invoice);
                        const invoiceStatus = normalizeInvoiceStatusLabel(invoice.status);
                        const displayInvoiceStatus = getInvoiceDisplayStatusLabel(invoice);
                        const canEditInvoice = invoiceStatus !== 'paid';
                        const collectionStatus = getCollectionStatusForInvoice(invoice);
                        const canConfirmCollectedInvoice = collectionStatus === 'collected_pending_admin';
                        const hasReceipt = Boolean((invoice.receiptNo ?? '').trim());
                        const isCancelledReceipt = displayInvoiceStatus === 'cancelled receipt';
                        return (
                          <TableRow key={invoice.id}>
                            <TableCell>
                              <div className="font-medium">{formatInvoiceNo(invoice.invoiceNo, invoice.id)}</div>
                              <div className="text-xs text-slate-500">{formatDisplayDate(invoice.invoiceDate)}</div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{customerName}</div>
                              <div className="text-xs text-slate-500">
                                {invoice.customer?.customerCode || '—'}
                              </div>
                            </TableCell>
                            <TableCell>
                              {formatDisplayDateRange(invoice.billingPeriodFrom, invoice.billingPeriodTo)}
                            </TableCell>
                            <TableCell>{formatDisplayDate(invoice.dueDate)}</TableCell>
                            <TableCell>
                              <div className="font-medium">{ruleDetails.name}</div>
                              <div className="text-xs text-slate-500">{ruleDetails.id || '—'}</div>
                            </TableCell>
                            <TableCell>{formatMoney(invoice.totalAmount, invoice.currency)}</TableCell>
                            <TableCell>
                              <Badge variant={statusBadgeVariant(displayInvoiceStatus)}>{displayInvoiceStatus}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={getAdminCollectionStatusClassNameForInvoice(
                                  invoice,
                                  getCollectionStatusForInvoice(invoice),
                                )}
                              >
                                {getAdminCollectionStatusLabelForInvoice(
                                  invoice,
                                  getCollectionStatusForInvoice(invoice),
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openInvoiceDetail(invoice, 'view')}
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  View
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => openInvoiceDetail(invoice, 'edit')}
                                  disabled={!canEditInvoice}
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </Button>
                                {canConfirmCollectedInvoice ? (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => openInvoiceDetail(invoice, 'edit')}
                                  >
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                    Confirm
                                  </Button>
                                ) : hasReceipt && !isCancelledReceipt ? (
                                  <Button variant="outline" size="sm" asChild>
                                    <Link
                                      href={`/admin/billing/receipt/list?q=${encodeURIComponent(
                                        invoice.receiptNo ?? formatInvoiceNo(invoice.invoiceNo, invoice.id),
                                      )}`}
                                    >
                                      <FileText className="mr-2 h-4 w-4" />
                                      Receipt
                                    </Link>
                                  </Button>
                                ) : (
                                  <Button variant="outline" size="sm" asChild>
                                    <Link
                                      href={`/admin/billing/receipt/create?invoiceId=${encodeURIComponent(invoice.id)}`}
                                    >
                                      <FileText className="mr-2 h-4 w-4" />
                                      Create Receipt
                                    </Link>
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-4 md:hidden">
                  {filteredInvoices.map((invoice) => {
                    const customerName =
                      invoice.customer?.personalName || invoice.customer?.companyName || 'Unknown Customer';
                    const ruleDetails = getInvoiceRuleDetails(invoice);
                    const invoiceStatus = normalizeInvoiceStatusLabel(invoice.status);
                    const displayInvoiceStatus = getInvoiceDisplayStatusLabel(invoice);
                    const canEditInvoice = invoiceStatus !== 'paid';
                    const collectionStatus = getCollectionStatusForInvoice(invoice);
                    const canConfirmCollectedInvoice = collectionStatus === 'collected_pending_admin';
                    const hasReceipt = Boolean((invoice.receiptNo ?? '').trim());
                    const isCancelledReceipt = displayInvoiceStatus === 'cancelled receipt';
                    return (
                      <Card key={invoice.id}>
                        <CardContent className="space-y-3 pt-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm text-slate-500">{formatInvoiceNo(invoice.invoiceNo, invoice.id)}</p>
                              <p className="text-base font-semibold text-slate-900">{customerName}</p>
                            </div>
                            <Badge variant={statusBadgeVariant(displayInvoiceStatus)}>{displayInvoiceStatus}</Badge>
                          </div>

                          <div className="space-y-1 text-sm text-slate-700">
                            <p>Invoice Date: {formatDisplayDate(invoice.invoiceDate)}</p>
                            <p>Due Date: {formatDisplayDate(invoice.dueDate)}</p>
                            <p>Rule: {ruleDetails.name}</p>
                            <p>Total: {formatMoney(invoice.totalAmount, invoice.currency)}</p>
                              <p>
                              Collection:{' '}
                              <span className="font-medium">
                                {getAdminCollectionStatusLabelForInvoice(
                                  invoice,
                                  getCollectionStatusForInvoice(invoice),
                                )}
                              </span>
                            </p>
                          </div>

                          <div className="grid gap-2 grid-cols-1 sm:grid-cols-4">
                            <Button
                              className="w-full"
                              variant="outline"
                              onClick={() => openInvoiceDetail(invoice, 'view')}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </Button>
                            <Button
                              className="w-full"
                              onClick={() => openInvoiceDetail(invoice, 'edit')}
                              disabled={!canEditInvoice}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </Button>
                            {canConfirmCollectedInvoice ? (
                              <Button
                                className="w-full"
                                variant="secondary"
                                onClick={() => openInvoiceDetail(invoice, 'edit')}
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Confirm
                              </Button>
                            ) : hasReceipt && !isCancelledReceipt ? (
                              <Button className="w-full" variant="outline" asChild>
                                <Link
                                  href={`/admin/billing/receipt/list?q=${encodeURIComponent(
                                    invoice.receiptNo ?? formatInvoiceNo(invoice.invoiceNo, invoice.id),
                                  )}`}
                                >
                                  <FileText className="mr-2 h-4 w-4" />
                                  Receipt
                                </Link>
                              </Button>
                            ) : (
                              <Button className="w-full" variant="outline" asChild>
                                <Link
                                  href={`/admin/billing/receipt/create?invoiceId=${encodeURIComponent(invoice.id)}`}
                                >
                                  <FileText className="mr-2 h-4 w-4" />
                                  Create Receipt
                                </Link>
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        ) : activeTab === 'next-engine' ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Engine Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-900">Automatic Release</p>
                    <p className="text-xs text-slate-600">
                      When enabled, due schedules are checked every minute and released automatically.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={autoReleaseEnabled} onCheckedChange={setAutoReleaseEnabled} />
                    <Button
                      variant="outline"
                      onClick={() => runAutoReleaseNow(false)}
                      disabled={isRunningAutoRelease || readyToReleaseRows.length === 0}
                    >
                      <Zap className="mr-2 h-4 w-4" />
                      {isRunningAutoRelease ? 'Running...' : 'Run Auto Release Now'}
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm">
                    <p className="text-xs text-slate-500">Customers</p>
                    <p className="font-semibold text-slate-900">{engineStats.total}</p>
                  </div>
                  <div className="rounded-md border bg-emerald-50 px-3 py-2 text-sm">
                    <p className="text-xs text-emerald-700">Ready</p>
                    <p className="font-semibold text-emerald-900">{engineStats.ready}</p>
                  </div>
                  <div className="rounded-md border bg-blue-50 px-3 py-2 text-sm">
                    <p className="text-xs text-blue-700">Scheduled</p>
                    <p className="font-semibold text-blue-900">{engineStats.scheduled}</p>
                  </div>
                  <div className="rounded-md border bg-violet-50 px-3 py-2 text-sm">
                    <p className="text-xs text-violet-700">Releasing</p>
                    <p className="font-semibold text-violet-900">{engineStats.releasing}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Next Invoice Schedule ({visibleEngineRows.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {(customersLoading || isLoading) && (
                  <p className="mb-4 text-sm text-slate-500">Loading schedule data...</p>
                )}
                {(customersError || loadError) && (
                  <p className="mb-4 text-sm text-rose-600">
                    {[customersError, loadError].filter(Boolean).join(' | ')}
                  </p>
                )}
                {!customersLoading && !isLoading && visibleEngineRows.length === 0 && (
                  <p className="mb-4 text-sm text-slate-500">
                    No scheduled invoices yet. Mark current invoice as paid first.
                  </p>
                )}

                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Next Release Date</TableHead>
                        <TableHead>Next Payment Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleEngineRows.map((row) => {
                        const releaseValue =
                          manualReleaseDateByCustomer[row.customerId] ?? row.releaseDate ?? '';
                        const canEditSchedule =
                          row.currentInvoiceStatus === 'paid' &&
                          !Boolean(row.queuedInvoiceId) &&
                          !isReleasingByCustomer[row.customerId];
                        const isEditingSchedule = Boolean(isEditingScheduleByCustomer[row.customerId]);
                        const isDisabledRelease =
                          row.currentInvoiceStatus !== 'paid' ||
                          isReleasingByCustomer[row.customerId] ||
                          Boolean(row.queuedInvoiceId);
                        return (
                          <TableRow key={row.customerId}>
                            <TableCell>
                              <div className="font-medium text-slate-900">{row.customerName}</div>
                              <div className="text-xs text-slate-500">{row.customerCode || '—'}</div>
                            </TableCell>
                            <TableCell>
                              <div className="capitalize">{row.billingMode}</div>
                              {row.billingCycleMode && (
                                <div className="text-xs text-slate-500 capitalize">
                                  {row.billingCycleMode.replaceAll('_', ' ')}
                                </div>
                              )}
                              {row.ruleName && (
                                <div className="text-xs text-slate-500">{row.ruleName}</div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Input
                                type="date"
                                value={releaseValue}
                                onChange={(event) =>
                                  setManualReleaseDateByCustomer((prev) => {
                                    const nextValue = event.target.value;
                                    if (!nextValue) {
                                      const next = { ...prev };
                                      delete next[row.customerId];
                                      return next;
                                    }
                                    return {
                                      ...prev,
                                      [row.customerId]: nextValue,
                                    };
                                  })
                                }
                                disabled={!canEditSchedule || !isEditingSchedule}
                              />
                            </TableCell>
                            <TableCell>{formatDisplayDate(row.nextPaymentDate)}</TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${engineStatusClass(
                                  row.status,
                                )}`}
                              >
                                {engineStatusLabel(row.status)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={!canEditSchedule}
                                  onClick={() =>
                                    setIsEditingScheduleByCustomer((prev) => ({
                                      ...prev,
                                      [row.customerId]: !prev[row.customerId],
                                    }))
                                  }
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  {isEditingSchedule ? 'Done' : 'Edit'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={isDisabledRelease}
                                  onClick={() => releaseNextInvoice(row, false)}
                                >
                                  {isReleasingByCustomer[row.customerId] ? (
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <Play className="mr-2 h-4 w-4" />
                                  )}
                                  {row.queuedInvoiceId ? 'Queued' : 'Release Now'}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-4 md:hidden">
                  {visibleEngineRows.map((row) => {
                    const releaseValue =
                      manualReleaseDateByCustomer[row.customerId] ?? row.releaseDate ?? '';
                    const canEditSchedule =
                      row.currentInvoiceStatus === 'paid' &&
                      !Boolean(row.queuedInvoiceId) &&
                      !isReleasingByCustomer[row.customerId];
                    const isEditingSchedule = Boolean(isEditingScheduleByCustomer[row.customerId]);
                    const isDisabledRelease =
                      row.currentInvoiceStatus !== 'paid' ||
                      isReleasingByCustomer[row.customerId] ||
                      Boolean(row.queuedInvoiceId);
                    return (
                      <Card key={row.customerId}>
                        <CardContent className="space-y-3 pt-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{row.customerName}</p>
                              <p className="text-xs text-slate-500">{row.customerCode || '—'}</p>
                            </div>
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${engineStatusClass(
                                row.status,
                              )}`}
                            >
                              {engineStatusLabel(row.status)}
                            </span>
                          </div>

                          <div className="grid gap-2 text-sm text-slate-700">
                            <p>
                              Mode: {row.billingMode}
                              {row.billingCycleMode
                                ? ` / ${row.billingCycleMode.replaceAll('_', ' ')}`
                                : ''}
                            </p>
                            {row.ruleName && <p>Rule: {row.ruleName}</p>}
                            <p>Next Payment Date: {formatDisplayDate(row.nextPaymentDate)}</p>
                            <div>
                              <Label className="text-xs text-slate-500">Next Release Date</Label>
                              <Input
                                type="date"
                                value={releaseValue}
                                onChange={(event) =>
                                  setManualReleaseDateByCustomer((prev) => {
                                    const nextValue = event.target.value;
                                    if (!nextValue) {
                                      const next = { ...prev };
                                      delete next[row.customerId];
                                      return next;
                                    }
                                    return {
                                      ...prev,
                                      [row.customerId]: nextValue,
                                    };
                                  })
                                }
                                disabled={!canEditSchedule || !isEditingSchedule}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              className="w-full"
                              variant="outline"
                              disabled={!canEditSchedule}
                              onClick={() =>
                                setIsEditingScheduleByCustomer((prev) => ({
                                  ...prev,
                                  [row.customerId]: !prev[row.customerId],
                                }))
                              }
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              {isEditingSchedule ? 'Done' : 'Edit'}
                            </Button>
                            <Button
                              className="w-full"
                              variant="outline"
                              disabled={isDisabledRelease}
                              onClick={() => releaseNextInvoice(row, false)}
                            >
                              {isReleasingByCustomer[row.customerId] ? (
                                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Clock3 className="mr-2 h-4 w-4" />
                              )}
                              {row.queuedInvoiceId ? 'Queued' : 'Release Now'}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        ) : activeTab === 'rule-config' ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Billing Rule Config</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm">
                    <p className="text-xs text-slate-500">Active Rules</p>
                    <p className="font-semibold text-slate-900">
                      {billingRules.filter((rule) => rule.isActive).length}
                    </p>
                  </div>
                  <div className="rounded-md border bg-blue-50 px-3 py-2 text-sm">
                    <p className="text-xs text-blue-700">Selected Customers</p>
                    <p className="font-semibold text-blue-900">{selectedRuleCustomerIds.length}</p>
                  </div>
                  <div className="rounded-md border bg-emerald-50 px-3 py-2 text-sm">
                    <p className="text-xs text-emerald-700">Selected Invoices</p>
                    <p className="font-semibold text-emerald-900">{selectedRuleInvoiceIds.length}</p>
                  </div>
                  <div className="rounded-md border bg-violet-50 px-3 py-2 text-sm">
                    <p className="text-xs text-violet-700">Total Customers</p>
                    <p className="font-semibold text-violet-900">{customers.length}</p>
                  </div>
                </div>

                {billingRulesLoading && (
                  <p className="text-sm text-slate-500">Loading billing rules...</p>
                )}
                {billingRulesError && (
                  <p className="text-sm text-rose-600">{billingRulesError}</p>
                )}
                {!billingRulesLoading && !billingRulesError && billingRules.length === 0 && (
                  <p className="text-sm text-slate-500">
                    No billing rules found. Create rules in Super Admin first.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Assign Rule To Customers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Billing Rule</Label>
                    <Select value={customerRuleId} onValueChange={setCustomerRuleId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select rule" />
                      </SelectTrigger>
                      <SelectContent>
                        {billingRules.map((rule) => (
                          <SelectItem key={rule.id} value={rule.id}>
                            {rule.name} • {rule.billingType}/{rule.billingMode} • v{rule.version}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Effective From</Label>
                    <Input
                      type="date"
                      value={effectiveFromDate}
                      onChange={(event) => setEffectiveFromDate(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="block">Also Apply To Unreleased Invoices</Label>
                    <div className="flex h-10 items-center">
                      <Switch
                        checked={applyToUnreleasedInvoices}
                        onCheckedChange={setApplyToUnreleasedInvoices}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="relative md:col-span-2">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      className="pl-10"
                      placeholder="Search customer by code, name, phone, address"
                      value={ruleCustomerSearch}
                      onChange={(event) => setRuleCustomerSearch(event.target.value)}
                    />
                  </div>
                  <Button
                    onClick={assignRuleToCustomers}
                    disabled={
                      isAssigningRuleToCustomers ||
                      !customerRuleId ||
                      selectedRuleCustomerIds.length === 0
                    }
                  >
                    {isAssigningRuleToCustomers ? 'Assigning...' : 'Assign Rule To Selected Customers'}
                  </Button>
                </div>

                <div className="rounded-md border">
                  <div className="flex items-center justify-between border-b bg-slate-50 px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={areAllFilteredCustomersSelected}
                        onCheckedChange={(checked) =>
                          toggleSelectAllFilteredCustomers(checked === true)
                        }
                      />
                      <span>Select all filtered</span>
                    </div>
                    <span className="text-xs text-slate-500">
                      {selectedRuleCustomerIds.length} selected
                    </span>
                  </div>
                  <div className="max-h-72 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Contact</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRuleCustomers.map((customer) => (
                          <TableRow key={customer.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedRuleCustomerIds.includes(customer.id)}
                                onCheckedChange={(checked) =>
                                  toggleCustomerRuleSelection(customer.id, checked === true)
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-slate-900">{customer.name}</div>
                              <div className="text-xs text-slate-500">{customer.customerCode || '—'}</div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">{customer.phone || '—'}</div>
                              <div className="text-xs text-slate-500 truncate max-w-[260px]">
                                {customer.address || '—'}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="capitalize">
                                {customer.status || 'unknown'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredRuleCustomers.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-sm text-slate-500">
                              No customers found.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Assign Rule To Invoices</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Billing Rule</Label>
                    <Select value={invoiceRuleId} onValueChange={setInvoiceRuleId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select rule" />
                      </SelectTrigger>
                      <SelectContent>
                        {billingRules.map((rule) => (
                          <SelectItem key={rule.id} value={rule.id}>
                            {rule.name} • {rule.billingType}/{rule.billingMode} • v{rule.version}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status Filter</Label>
                    <Select
                      value={ruleInvoiceStatusFilter}
                      onValueChange={(value) =>
                        setRuleInvoiceStatusFilter(value as 'all' | InvoiceStatus)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="unpaid">Unpaid</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="block">Recalculate Amount</Label>
                    <div className="flex h-10 items-center">
                      <Switch
                        checked={recalculateAssignedInvoices}
                        onCheckedChange={setRecalculateAssignedInvoices}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="relative md:col-span-2">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      className="pl-10"
                      placeholder="Search invoice by no, customer name, customer code"
                      value={ruleInvoiceSearch}
                      onChange={(event) => setRuleInvoiceSearch(event.target.value)}
                    />
                  </div>
                  <Button
                    onClick={assignRuleToInvoices}
                    disabled={
                      isAssigningRuleToInvoices ||
                      !invoiceRuleId ||
                      selectedRuleInvoiceIds.length === 0
                    }
                  >
                    {isAssigningRuleToInvoices ? 'Assigning...' : 'Assign Rule To Selected Invoices'}
                  </Button>
                </div>

                <div className="rounded-md border">
                  <div className="flex items-center justify-between border-b bg-slate-50 px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={areAllFilteredInvoicesSelected}
                        onCheckedChange={(checked) =>
                          toggleSelectAllFilteredInvoices(checked === true)
                        }
                      />
                      <span>Select all filtered</span>
                    </div>
                    <span className="text-xs text-slate-500">
                      {selectedRuleInvoiceIds.length} selected
                    </span>
                  </div>
                  <div className="max-h-72 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Invoice</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRuleInvoices.map((invoice) => {
                          const customerName =
                            invoice.customer?.personalName || invoice.customer?.companyName || 'Unknown';
                          const customerCode = invoice.customer?.customerCode || '—';
                          return (
                            <TableRow key={invoice.id}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedRuleInvoiceIds.includes(invoice.id)}
                                  onCheckedChange={(checked) =>
                                    toggleInvoiceRuleSelection(invoice.id, checked === true)
                                  }
                                />
                              </TableCell>
                              <TableCell className="font-medium">{formatInvoiceNo(invoice.invoiceNo, invoice.id)}</TableCell>
                              <TableCell>
                              <div className="font-medium text-slate-900">{customerName}</div>
                                <div className="text-xs text-slate-500">{customerCode}</div>
                              </TableCell>
                              <TableCell>{formatDisplayDate(invoice.invoiceDate)}</TableCell>
                              <TableCell>
                                <Badge variant={statusBadgeVariant(getInvoiceDisplayStatusLabel(invoice))}>
                                  {getInvoiceDisplayStatusLabel(invoice)}
                                </Badge>
                              </TableCell>
                              <TableCell>{formatMoney(invoice.totalAmount, invoice.currency || 'MMK')}</TableCell>
                            </TableRow>
                          );
                        })}
                        {filteredRuleInvoices.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-sm text-slate-500">
                              No invoices found.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Transactions ({filteredTransactionGroups.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search by invoice, customer, action, or note"
                    value={transactionSearchTerm}
                    onChange={(event) => setTransactionSearchTerm(event.target.value)}
                    className="pl-10"
                  />
                </div>

                {isLoading && <p className="text-sm text-slate-500">Loading transaction logs...</p>}
                {loadError && <p className="text-sm text-rose-600">{loadError}</p>}
                {!isLoading && !loadError && filteredTransactionGroups.length === 0 && (
                  <p className="text-sm text-slate-500">No transactions found.</p>
                )}

                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Latest Date Time</TableHead>
                        <TableHead>Latest Action</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Logs</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTransactionGroups.map((group) => (
                        <TableRow
                          key={group.id}
                          className="cursor-pointer hover:bg-slate-50"
                          onClick={() => openTransactionDetail(group)}
                        >
                          <TableCell className="font-medium">{formatInvoiceNo(group.invoiceNo, group.invoiceId)}</TableCell>
                          <TableCell>
                            <div className="font-medium">{group.customerName}</div>
                            <div className="text-xs text-slate-500">{group.customerCode}</div>
                          </TableCell>
                          <TableCell>{formatDateTime(group.latestActionAt)}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-medium capitalize ${transactionActionClass(
                                group.latestAction,
                              )}`}
                            >
                              {group.latestAction}
                            </span>
                          </TableCell>
                          <TableCell>{formatMoney(group.amount, group.currency || 'MMK')}</TableCell>
                          <TableCell>{group.logs.length}</TableCell>
                          <TableCell>
                            <div className="flex justify-end">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openTransactionDetail(group);
                                }}
                              >
                                View Log
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-3 md:hidden">
                  {filteredTransactionGroups.map((group) => (
                    <Card
                      key={group.id}
                      className="cursor-pointer"
                      onClick={() => openTransactionDetail(group)}
                    >
                      <CardContent className="space-y-3 pt-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs text-slate-500">{formatDateTime(group.latestActionAt)}</p>
                            <p className="text-base font-semibold text-slate-900">
                              {formatInvoiceNo(group.invoiceNo, group.invoiceId)}
                            </p>
                          </div>
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-medium capitalize ${transactionActionClass(
                              group.latestAction,
                            )}`}
                          >
                            {group.latestAction}
                          </span>
                        </div>
                        <div className="space-y-1 text-sm text-slate-700">
                          <p>
                            Customer: {group.customerName} ({group.customerCode})
                          </p>
                          <p>Amount: {formatMoney(group.amount, group.currency || 'MMK')}</p>
                          <p>Logs: {group.logs.length}</p>
                          <p className="text-xs text-slate-500">Tap to view log timeline</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <Dialog
          open={transactionDetailOpen}
          onOpenChange={(open) => {
            setTransactionDetailOpen(open);
            if (!open) {
              setSelectedTransactionGroup(null);
            }
          }}
        >
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                Transaction Log {selectedTransactionGroup ? `- ${selectedTransactionGroup.invoiceNo}` : ''}
              </DialogTitle>
            </DialogHeader>

            {selectedTransactionGroup ? (
              <div className="space-y-4">
                <div className="rounded-md border bg-slate-50 p-3 text-sm text-slate-700">
                  <p>
                    Customer: <span className="font-medium">{selectedTransactionGroup.customerName}</span>{' '}
                    ({selectedTransactionGroup.customerCode})
                  </p>
                  <p>
                    Latest: {formatDateTime(selectedTransactionGroup.latestActionAt)} (
                    {selectedTransactionGroup.latestAction})
                  </p>
                  <p>
                    Current Amount: {formatMoney(selectedTransactionGroup.amount, selectedTransactionGroup.currency || 'MMK')}
                  </p>
                </div>

                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                  {selectedTransactionGroup.logs.map((log) => (
                    <div key={log.id} className="rounded-md border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium capitalize ${transactionActionClass(
                            log.action,
                          )}`}
                        >
                          {log.action}
                        </span>
                        <span className="text-xs text-slate-500">{formatDateTime(log.actionAt)}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-700">{log.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No transaction selected.</p>
            )}
          </DialogContent>
        </Dialog>

        <Dialog
          open={detailOpen}
          onOpenChange={(open) => {
            setDetailOpen(open);
            if (!open) {
              setInvoiceDetailMode('view');
              setSelectedInvoice(null);
              setAdjustmentRows([]);
              setReceiptNo('');
              setPaymentMethod('Cash');
              setSelectedGlobalAdjustmentIds([]);
              setEditedInvoiceRuleId(INVOICE_RULE_NONE_VALUE);
            }
          }}
        >
          <DialogContent className="inset-0 left-0 top-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none border-0 p-4 sm:rounded-none sm:p-6">
            <DialogHeader>
              <DialogTitle>
                Invoice Detail {invoiceDetailMode === 'edit' ? '(Edit Mode)' : '(View Mode)'}
              </DialogTitle>
            </DialogHeader>

            {selectedInvoice && (
              <div className="mx-auto w-full max-w-5xl space-y-6">
                {canEditSelectedInvoiceInDialog ? (
                  <div className="rounded-lg border border-slate-300 bg-white p-5 text-slate-900">
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <h3 className="text-base font-semibold text-slate-900">Customer Information</h3>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Customer Code</Label>
                            <Input value={selectedInvoice.customer?.customerCode || '—'} readOnly />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Customer Name</Label>
                            <Input
                              value={
                                selectedInvoice.customer?.personalName ||
                                selectedInvoice.customer?.companyName ||
                                'Unknown'
                              }
                              readOnly
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Primary Phone</Label>
                            <Input value={selectedInvoice.customer?.primaryPhone || '—'} readOnly />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Package Plan</Label>
                            <Input
                              value={
                                selectedInvoice.subscription?.plan?.planName ||
                                selectedInvoice.subscription?.plan?.planCode ||
                                '—'
                              }
                              readOnly
                            />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label className="text-sm font-medium text-slate-700">Installation Address</Label>
                            <Input value={selectedInvoice.customer?.installationAddress || '—'} readOnly />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-base font-semibold text-slate-900">Invoice Information</h3>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Invoice Number</Label>
                            <Input value={formatInvoiceNo(selectedInvoice.invoiceNo, selectedInvoice.id)} readOnly />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Invoice Date</Label>
                            <Input value={formatDisplayDate(selectedInvoice.invoiceDate)} readOnly />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Billing Period</Label>
                            <Input
                              value={formatDisplayDateRange(
                                selectedInvoice.billingPeriodFrom,
                                selectedInvoice.billingPeriodTo
                              )}
                              readOnly
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Due Date</Label>
                            <Input value={formatDisplayDate(selectedInvoice.dueDate)} readOnly />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label className="text-sm font-medium text-slate-700">
                              Rule For This Invoice Revision
                            </Label>
                            <Select value={editedInvoiceRuleId} onValueChange={setEditedInvoiceRuleId}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select rule" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={INVOICE_RULE_NONE_VALUE}>No rule (Unassigned)</SelectItem>
                                {billingRules.map((rule) => (
                                  <SelectItem key={rule.id} value={rule.id}>
                                    {rule.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-slate-500">
                              Current rule: {selectedInvoiceRuleDetails.name} ({selectedInvoiceRuleDetails.id || '—'})
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-2">
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
                              <TableRow>
                                <TableCell>1</TableCell>
                                <TableCell>Monthly Internet Fee</TableCell>
                                <TableCell className="text-right">
                                  {selectedInvoicePricingPreview.cycleMonths}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatMoney(
                                    selectedInvoicePricingPreview.unitMonthlyFee,
                                    selectedInvoice.currency,
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatMoney(
                                    selectedInvoicePricingPreview.serviceAmount,
                                    selectedInvoice.currency,
                                  )}
                                </TableCell>
                              </TableRow>
                              {toNumber(selectedInvoice.installationFee) > 0 && (
                                <TableRow>
                                  <TableCell>2</TableCell>
                                  <TableCell>Installation Fee</TableCell>
                                  <TableCell className="text-right">1</TableCell>
                                  <TableCell className="text-right">
                                    {formatMoney(selectedInvoice.installationFee, selectedInvoice.currency)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatMoney(selectedInvoice.installationFee, selectedInvoice.currency)}
                                  </TableCell>
                                </TableRow>
                              )}
                              {toNumber(selectedInvoice.additionalFees) > 0 && (
                                <TableRow>
                                  <TableCell>3</TableCell>
                                  <TableCell>Additional Fee</TableCell>
                                  <TableCell className="text-right">1</TableCell>
                                  <TableCell className="text-right">
                                    {formatMoney(selectedInvoice.additionalFees, selectedInvoice.currency)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatMoney(selectedInvoice.additionalFees, selectedInvoice.currency)}
                                  </TableCell>
                                </TableRow>
                              )}
                              {adjustmentRows.map((row, index) => {
                                const amount =
                                  row.valueType === 'percent'
                                    ? (adjustmentPreview.baseSubtotal * toNumber(row.value)) / 100
                                    : toNumber(row.value);
                                return (
                                  <TableRow key={`${row.description}-${index}`}>
                                    <TableCell>{index + 4}</TableCell>
                                    <TableCell>{row.description || 'Adjustment'}</TableCell>
                                    <TableCell className="text-right">1</TableCell>
                                    <TableCell className="text-right">
                                      {row.valueType === 'percent'
                                        ? `${toNumber(row.value)}%`
                                        : formatMoney(row.value, selectedInvoice.currency)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {row.type === 'minus' ? '-' : ''}
                                      {formatMoney(amount, selectedInvoice.currency)}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                              <TableRow>
                                <TableCell colSpan={4} className="text-right font-semibold">Subtotal</TableCell>
                                <TableCell className="text-right font-semibold">
                                  {formatMoney(adjustmentPreview.baseSubtotal, selectedInvoice.currency)}
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell colSpan={4} className="text-right font-semibold">Plus</TableCell>
                                <TableCell className="text-right font-semibold">
                                  {formatMoney(adjustmentPreview.plusTotal, selectedInvoice.currency)}
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell colSpan={4} className="text-right font-semibold">Minus</TableCell>
                                <TableCell className="text-right font-semibold">
                                  {formatMoney(adjustmentPreview.minusTotal, selectedInvoice.currency)}
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell colSpan={4} className="text-right text-base font-bold">Total Amount</TableCell>
                                <TableCell className="text-right text-base font-bold">
                                  {formatMoney(adjustmentPreview.total, selectedInvoice.currency)}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </div>

                      {!canMarkPaidSelectedInvoiceInDialog && (
                        <div className="mt-8 space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4">
                          <p className="text-sm font-semibold text-slate-900">
                            Additional Fees / Discounts Setup
                          </p>
                          <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="w-full justify-between font-normal"
                                  disabled={globalAdjustmentsLoading || activeGlobalAdjustments.length === 0}
                                >
                                  {globalAdjustmentsLoading
                                    ? 'Loading global adjustments...'
                                    : activeGlobalAdjustments.length === 0
                                      ? 'No active global adjustments'
                                      : selectedGlobalAdjustmentIds.length > 0
                                        ? `${selectedGlobalAdjustmentIds.length} adjustment${
                                            selectedGlobalAdjustmentIds.length > 1 ? 's' : ''
                                          } selected`
                                        : 'Select global adjustments'}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="max-h-72 w-[420px] overflow-y-auto">
                                {activeGlobalAdjustments.map((item, index) => {
                                  const key = getGlobalAdjustmentKey(item, index);
                                  const checked = selectedGlobalAdjustmentIds.includes(key);
                                  return (
                                    <DropdownMenuCheckboxItem
                                      key={key}
                                      checked={checked}
                                      onCheckedChange={(nextChecked) => {
                                        setSelectedGlobalAdjustmentIds((prev) => {
                                          if (nextChecked === true) {
                                            return Array.from(new Set([...prev, key]));
                                          }
                                          return prev.filter((id) => id !== key);
                                        });
                                      }}
                                    >
                                      {item.description} ({item.type === 'plus' ? '+' : '-'}{' '}
                                      {item.valueType === 'percent'
                                        ? `${toNumber(item.value)}%`
                                        : formatMoney(item.value)})
                                    </DropdownMenuCheckboxItem>
                                  );
                                })}
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={addSelectedGlobalAdjustment}
                              disabled={
                                globalAdjustmentsLoading ||
                                activeGlobalAdjustments.length === 0 ||
                                selectedGlobalAdjustmentIds.length === 0
                              }
                            >
                              Add Selected
                            </Button>
                          </div>

                          {globalAdjustmentsError && (
                            <p className="text-sm text-rose-600">{globalAdjustmentsError}</p>
                          )}

                          <div className="flex flex-wrap gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => addAdjustmentRow('plus')}>
                              <Plus className="mr-2 h-4 w-4" />
                              Add Plus Fee
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => addAdjustmentRow('minus')}>
                              <Minus className="mr-2 h-4 w-4" />
                              Add Minus Fee
                            </Button>
                          </div>

                          {adjustmentRows.length === 0 && (
                            <p className="text-sm text-slate-500">
                              No adjustment rows. Add from global dropdown or use plus/minus buttons.
                            </p>
                          )}

                          <div className="space-y-3">
                            {adjustmentRows.map((row, index) => (
                              <div key={index} className="rounded-md border bg-white p-3">
                                <div className="grid gap-3 md:grid-cols-6">
                                  <div className="md:col-span-2">
                                    <Label>Description</Label>
                                    <Input
                                      value={row.description}
                                      onChange={(event) =>
                                        updateAdjustmentRow(index, 'description', event.target.value)
                                      }
                                      placeholder="e.g. Router Fee / Promo Discount"
                                    />
                                  </div>

                                  <div>
                                    <Label>Type</Label>
                                    <Select
                                      value={row.type}
                                      onValueChange={(value) =>
                                        updateAdjustmentRow(index, 'type', value as AdjustmentType)
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="plus">Plus</SelectItem>
                                        <SelectItem value="minus">Minus</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div>
                                    <Label>Value Type</Label>
                                    <Select
                                      value={row.valueType}
                                      onValueChange={(value) =>
                                        updateAdjustmentRow(index, 'valueType', value as AdjustmentValueType)
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="fixed">Fixed</SelectItem>
                                        <SelectItem value="percent">Percent</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div>
                                    <Label>{row.valueType === 'percent' ? 'Percent' : 'Amount'}</Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={row.value}
                                      onChange={(event) => updateAdjustmentRow(index, 'value', event.target.value)}
                                    />
                                  </div>

                                  <div>
                                    <Label>Remember</Label>
                                    <div className="mt-2 flex items-center gap-2">
                                      <Checkbox
                                        checked={row.rememberForNext}
                                        onCheckedChange={(checked) =>
                                          updateAdjustmentRow(index, 'rememberForNext', checked === true)
                                        }
                                      />
                                      <span className="text-xs text-slate-600">Use in next invoice</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-3 flex justify-end">
                                  <Button size="sm" variant="ghost" onClick={() => removeAdjustmentRow(index)}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Remove
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="flex justify-end">
                            <Button onClick={saveAdjustments} disabled={isSavingAdjustments}>
                              <Save className="mr-2 h-4 w-4" />
                              {isSavingAdjustments ? 'Saving...' : 'Save Adjustments'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-300 bg-white p-5 text-slate-900">
                    <div className="mb-3 flex justify-end">
                      <Button variant="outline" size="sm" onClick={exportInvoicePdf}>
                        <Download className="mr-2 h-4 w-4" />
                        Export as PDF
                      </Button>
                    </div>
                    <h2 className="text-center text-3xl font-semibold">Invoice</h2>

                    <div className="mt-8 space-y-1 text-sm">
                      <p>Company Name: ABC Internet Service Provider</p>
                      <p>Address: No. 123, Main Road, Yangon</p>
                      <p>Phone: 09-xxxxxxx</p>
                      <p>Email:</p>
                    </div>

                    <div className="mt-8 grid gap-6 md:grid-cols-2">
                      <div className="space-y-1 text-sm">
                        <p className="font-semibold">Invoice Information</p>
                        <p>Invoice No: {formatInvoiceNo(selectedInvoice.invoiceNo, selectedInvoice.id)}</p>
                        <p>Invoice Date: {formatDisplayDate(selectedInvoice.invoiceDate)}</p>
                        <p>Invoice Type: {formatInvoiceTypeLabel(selectedInvoice.invoiceType)}</p>
                        <p>
                          Billing Period: {formatDisplayDateRange(
                            selectedInvoice.billingPeriodFrom,
                            selectedInvoice.billingPeriodTo
                          )}
                        </p>
                        <p>Due Date: {formatDisplayDate(selectedInvoice.dueDate)}</p>
                        <p>Billing Rule: {selectedInvoiceRuleDetails.name}</p>
                        <p>Rule ID: {selectedInvoiceRuleDetails.id || '—'}</p>
                      </div>

                      <div className="space-y-1 text-sm">
                        <p className="font-semibold">Customer Information</p>
                        <p>Customer ID: {selectedInvoice.customer?.customerCode || '—'}</p>
                        <p>
                          Customer Name:{' '}
                          {selectedInvoice.customer?.personalName ||
                            selectedInvoice.customer?.companyName ||
                            'Unknown'}
                        </p>
                        <p>Phone No: {selectedInvoice.customer?.primaryPhone || '—'}</p>
                        <p>Address: {selectedInvoice.customer?.installationAddress || '—'}</p>
                        <p>
                          Package:{' '}
                          {selectedInvoice.subscription?.plan?.planName ||
                            selectedInvoice.subscription?.plan?.planCode ||
                            '—'}
                        </p>
                      </div>
                    </div>

                    {(() => {
                      const currency = selectedInvoice.currency || 'MMK';
                      const monthlyFeeAmount = toNumber(selectedInvoice.monthlyFee);
                      const installationFeeAmount = toNumber(selectedInvoice.installationFee);
                      const additionalFeeAmount = toNumber(selectedInvoice.additionalFees);
                      const allAdjustments = selectedInvoice.adjustments || [];
                      const isSystemMonthlyOffset = (adjustment: InvoiceAdjustment) => {
                        const description = String(adjustment.description || '').trim().toLowerCase();
                        if (description !== 'manual monthly fee adjustment') return false;
                        if ((adjustment.type || '').toLowerCase() !== 'minus') return false;
                        return Math.abs(toNumber(adjustment.amount) - monthlyFeeAmount) < 0.01;
                      };
                      const visibleAdjustments = allAdjustments.filter((adjustment) => !isSystemMonthlyOffset(adjustment));
                      const hasSystemMonthlyOffset = visibleAdjustments.length !== allAdjustments.length;
                      const visibleChargeRows: Array<{ description: string; qty: number; unitPrice: number; amount: number }> = [];
                      if (!hasSystemMonthlyOffset && monthlyFeeAmount > 0) {
                        visibleChargeRows.push({
                          description: 'Monthly Internet Fee',
                          qty: 1,
                          unitPrice: monthlyFeeAmount,
                          amount: monthlyFeeAmount
                        });
                      }
                      if (installationFeeAmount > 0) {
                        visibleChargeRows.push({
                          description: 'Installation Fee',
                          qty: 1,
                          unitPrice: installationFeeAmount,
                          amount: installationFeeAmount
                        });
                      }
                      if (additionalFeeAmount > 0) {
                        visibleChargeRows.push({
                          description: 'Additional Fee',
                          qty: 1,
                          unitPrice: additionalFeeAmount,
                          amount: additionalFeeAmount
                        });
                      }
                      const displaySubtotal = visibleChargeRows.reduce((sum, row) => sum + row.amount, 0);
                      const displayPlus = visibleAdjustments
                        .filter((adjustment) => adjustment.type !== 'minus')
                        .reduce((sum, adjustment) => sum + Math.abs(toNumber(adjustment.amount)), 0);
                      const displayMinus = visibleAdjustments
                        .filter((adjustment) => adjustment.type === 'minus')
                        .reduce((sum, adjustment) => sum + Math.abs(toNumber(adjustment.amount)), 0);
                      const displayTotal = displaySubtotal + displayPlus - displayMinus;

                      return (
                        <div className="mt-8">
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
                                {visibleChargeRows.map((row, index) => (
                                  <TableRow key={`charge-${row.description}-${index}`}>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell>{row.description}</TableCell>
                                    <TableCell className="text-right">{row.qty}</TableCell>
                                    <TableCell className="text-right">{formatMoney(row.unitPrice, currency)}</TableCell>
                                    <TableCell className="text-right">{formatMoney(row.amount, currency)}</TableCell>
                                  </TableRow>
                                ))}
                                {visibleAdjustments.map((adjustment, index) => (
                                  <TableRow key={adjustment.id || `${adjustment.description}-${index}`}>
                                    <TableCell>{visibleChargeRows.length + index + 1}</TableCell>
                                    <TableCell>{adjustment.description}</TableCell>
                                    <TableCell className="text-right">1</TableCell>
                                    <TableCell className="text-right">
                                      {adjustment.valueType === 'percent'
                                        ? `${toNumber(adjustment.value)}%`
                                        : formatMoney(adjustment.value, currency)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {adjustment.type === 'minus' ? '-' : ''}
                                      {formatMoney(adjustment.amount, currency)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                                {selectedInvoice.status !== 'paid' && !hasSystemMonthlyOffset && (
                                  <>
                                    {displaySubtotal > 0 && (
                                      <TableRow>
                                        <TableCell colSpan={4} className="text-right font-semibold">Subtotal</TableCell>
                                        <TableCell className="text-right font-semibold">
                                          {formatMoney(displaySubtotal, currency)}
                                        </TableCell>
                                      </TableRow>
                                    )}
                                    {displayPlus > 0 && (
                                      <TableRow>
                                        <TableCell colSpan={4} className="text-right font-semibold">Plus</TableCell>
                                        <TableCell className="text-right font-semibold">
                                          {formatMoney(displayPlus, currency)}
                                        </TableCell>
                                      </TableRow>
                                    )}
                                    {displayMinus > 0 && (
                                      <TableRow>
                                        <TableCell colSpan={4} className="text-right font-semibold">Minus</TableCell>
                                        <TableCell className="text-right font-semibold">
                                          {formatMoney(displayMinus, currency)}
                                        </TableCell>
                                      </TableRow>
                                    )}
                                  </>
                                )}
                                <TableRow>
                                  <TableCell colSpan={4} className="text-right text-base font-bold">Total Amount</TableCell>
                                  <TableCell className="text-right text-base font-bold">
                                    {formatMoney(hasSystemMonthlyOffset ? displayTotal : selectedInvoice.totalAmount, currency)}
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="mt-8 space-y-1 text-sm">
                      <p className="font-semibold">Notes / Terms</p>
                      <p>Please pay before the due date to avoid service suspension.</p>
                      <p>No refund after billing period started.</p>
                      <p>This is a system-generated invoice.</p>
                    </div>

                    <div className="mt-8 space-y-3">
                      <p className="text-sm font-semibold">Collection Timeline</p>
                      <Badge
                        variant="secondary"
                        className={getAdminCollectionStatusClassNameForInvoice(
                          selectedInvoice,
                          selectedCollectionStatus,
                        )}
                      >
                        {getAdminCollectionStatusLabelForInvoice(selectedInvoice, selectedCollectionStatus)}
                      </Badge>

                      {selectedCollectionTimeline.length === 0 ? (
                        <p className="text-sm text-slate-500">No collection events for this invoice yet.</p>
                      ) : (
                        <div className="max-h-52 space-y-2 overflow-y-auto rounded-md border p-3">
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

                {canMarkPaidSelectedInvoiceInDialog ? (
                  <div className="rounded-lg border border-slate-300 bg-white p-5 text-slate-900 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Payment Confirmation</p>
                        <h3 className="mt-1 text-xl font-semibold">
                          {isCollectionActionRequired(selectedCollectionStatus)
                            ? 'Admin Action Required'
                            : 'Mark Invoice Paid'}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">
                          {selectedCollectionStatus === 'collected_pending_admin'
                            ? 'Collector has already completed collection. Confirm and generate the receipt from this summary.'
                            : 'Customer will pay at office. Confirm the payment details below before generating the receipt.'}
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={getAdminCollectionStatusClassNameForInvoice(
                          selectedInvoice,
                          selectedCollectionStatus,
                        )}
                      >
                        {getAdminCollectionStatusLabelForInvoice(selectedInvoice, selectedCollectionStatus)}
                      </Badge>
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <div className="space-y-1 text-sm">
                        <p className="font-semibold text-slate-900">Invoice Information</p>
                        <p>Invoice No: {formatInvoiceNo(selectedInvoice.invoiceNo, selectedInvoice.id)}</p>
                        <p>Invoice Date: {formatDisplayDate(selectedInvoice.invoiceDate)}</p>
                        <p>Customer: {selectedInvoice.customer?.personalName || selectedInvoice.customer?.companyName || 'Unknown'}</p>
                      </div>

                      <div className="space-y-1 text-sm md:text-right">
                        <p className="font-semibold text-slate-900">Amount Summary</p>
                        <p>
                          Total Amount:{' '}
                          <span className="text-base font-semibold text-slate-900">
                            {formatMoney(selectedInvoice.totalAmount, selectedInvoice.currency)}
                          </span>
                        </p>
                        <p>
                          Collection Status:{' '}
                          {getAdminCollectionStatusLabelForInvoice(selectedInvoice, selectedCollectionStatus)}
                        </p>
                      </div>
                    </div>

                    {selectedCollectionStatus === 'collected_pending_admin' && (
                      <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Collector Payment Details</p>
                        <div className="mt-2 space-y-1">
                          <p>
                            Payment Method:{' '}
                            <span className="font-medium text-slate-900">
                              {selectedCollectedPaymentSummary?.paymentMethod || selectedInvoice.paymentMethod || '—'}
                            </span>
                          </p>
                          {selectedCollectedPaymentSummary?.paymentAccount && (
                            <p>
                              Payment Account:{' '}
                              <span className="font-medium text-slate-900">
                                {selectedCollectedPaymentSummary.paymentAccount}
                              </span>
                            </p>
                          )}
                          {selectedCollectedPaymentSummary?.note && (
                            <p className="text-xs text-slate-500">{selectedCollectedPaymentSummary.note}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedCollectionStatus === 'office_transfer' && (
                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Payment Method</Label>
                          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                            <SelectTrigger>
                              <SelectValue placeholder="Choose payment method" />
                            </SelectTrigger>
                            <SelectContent>
                              {paymentMethodOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-slate-500">
                            {paymentAccountsLoading
                              ? 'Loading methods from payment config...'
                              : 'Methods are loaded from payment config.'}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label>Receipt No</Label>
                          <Input
                            value={receiptNo}
                            onChange={(event) => setReceiptNo(event.target.value)}
                            placeholder="Optional"
                          />
                        </div>
                      </div>
                    )}

                    <div className="mt-6 flex justify-end">
                      <Button onClick={markInvoicePaid} disabled={isMarkingPaid}>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        {isMarkingPaid
                          ? 'Updating...'
                          : isCollectionActionRequired(selectedCollectionStatus)
                            ? 'Confirm & Generate Receipt'
                            : 'Mark as Paid'}
                      </Button>
                    </div>
                  </div>
                ) : (
                    <Card>
                    <CardHeader>
                      <CardTitle>
                        {selectedInvoiceStatus === 'paid'
                          ? 'Final Amount (Paid Invoice)'
                          : selectedInvoiceStatus === 'cancelled'
                            ? 'Cancelled Receipt'
                            : 'View Only'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-slate-600">
                        {selectedInvoiceStatus === 'paid'
                          ? 'This invoice is already paid and locked.'
                          : selectedInvoiceStatus === 'cancelled'
                            ? 'This receipt was cancelled. You can still edit it to create a new invoice revision.'
                            : 'This is view mode. Use Edit to change adjustments or payment.'}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">
                        {formatMoney(selectedInvoice.totalAmount, selectedInvoice.currency)}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
