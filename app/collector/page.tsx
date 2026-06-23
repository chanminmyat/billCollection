'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search,
  DollarSign,
  FileText,
  Users,
  Calendar,
  Eye,
  Phone,
  MapPin,
  Copy,
  Wallet,
  Landmark,
} from 'lucide-react';
import { useAuth } from '../contexts/auth-context';
import Layout from '../components/layout';
import { useToast } from '@/hooks/use-toast';
import { isInvoiceReleased } from '@/lib/invoice-visibility';
import { formatDisplayDate, formatDisplayDateRange } from '@/lib/date-format';
import { appendActivityLog } from '@/lib/activity-log';
import {
  COLLECTOR_DASHBOARD_COPY_UPDATED_AT_STORAGE_KEY,
  COLLECTOR_DASHBOARD_COPY_UPDATED_EVENT,
  DEFAULT_COLLECTOR_DASHBOARD_COPY,
  normalizeCollectorDashboardCopy,
} from '@/lib/collector-dashboard-copy';
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
import { readUiLanguage, UI_LANGUAGE_STORAGE_KEY, UI_LANGUAGE_UPDATED_EVENT, UiLanguage } from '@/lib/ui-language';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
const INVOICE_FORCE_RELEASED_STORAGE_KEY = 'billing_force_released_invoice_ids_v1';
const COLLECTOR_TODAY_QUEUE_STORAGE_PREFIX = 'collector_collect_today_queue_v1';

type InvoiceStatus = 'paid' | 'unpaid' | 'overdue' | 'cancelled';

type MapLinkSource = {
  billingMapLink?: string | null;
  billingMapUrl?: string | null;
  installationMapLink?: string | null;
  installationMapUrl?: string | null;
  mapLink?: string | null;
  googleMapLink?: string | null;
  addressInformation?: {
    installationMapLink?: string | null;
    billingMapLink?: string | null;
    mapLink?: string | null;
    googleMapLink?: string | null;
  } | null;
};

type CollectorCustomer = {
  id: string;
  customerCode?: string;
  billingCycle?: string | null;
  firstInvoiceMode?: string | null;
  personalName?: string | null;
  companyName?: string | null;
  primaryPhone?: string | null;
  billingAddress?: string | null;
  installationAddress?: string | null;
  billingMapLink?: string | null;
  billingMapUrl?: string | null;
  installationMapLink?: string | null;
  installationMapUrl?: string | null;
  mapLink?: string | null;
  googleMapLink?: string | null;
  status?: string | null;
  addressInformation?: MapLinkSource['addressInformation'];
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

type PaymentAccountKind = 'wallet' | 'account';
type CollectorPaymentMethod = 'cash' | 'wallet' | 'account';

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
    billingAddress?: string | null;
    installationAddress?: string | null;
    installationMapLink?: string | null;
    mapLink?: string | null;
    googleMapLink?: string | null;
    addressInformation?: MapLinkSource['addressInformation'];
  } | null;
};

type CollectorDashboardView = 'dashboard' | 'assigned_customers' | 'assigned_bills' | 'collected_bills';

const normalizeCollectorDashboardView = (value: string | null): CollectorDashboardView => {
  if (value === 'assigned_customers') return 'assigned_customers';
  if (value === 'assigned_bills') return 'assigned_bills';
  if (value === 'collected_bills') return 'collected_bills';
  return 'dashboard';
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

const isCollectorSuspended = (status: unknown) => {
  const normalized = String(status ?? '').trim().toLowerCase();
  return ['suspended', 'disable', 'disabled', 'takeoff', 'inactive'].includes(normalized);
};

const getCustomerDisplayName = (customer: {
  personalName?: string | null;
  companyName?: string | null;
},
fallback = 'Unknown Customer') => customer.personalName || customer.companyName || fallback;

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

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');

const extractIframeSrc = (value: string): string | null => {
  const iframeSrcMatch = value.match(/<iframe[^>]*\ssrc=(["'])(.*?)\1/i);
  if (iframeSrcMatch?.[2]) {
    return decodeHtmlEntities(iframeSrcMatch[2].trim());
  }
  const genericSrcMatch = value.match(/\ssrc=(["'])(.*?)\1/i);
  if (genericSrcMatch?.[2]) {
    return decodeHtmlEntities(genericSrcMatch[2].trim());
  }
  return null;
};

const normalizeExternalLink = (value?: string | null): string | null => {
  const input = String(value ?? '').trim();
  if (!input) return null;

  const embeddedSrc = extractIframeSrc(input);
  const raw = decodeHtmlEntities((embeddedSrc ?? input).trim());
  if (!raw) return null;

  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^geo:/i.test(raw)) return raw;

  // Lat/Lng values like "16.8661,96.1951"
  if (/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(raw)) {
    return `https://www.google.com/maps?q=${encodeURIComponent(raw)}`;
  }

  // Domain-like values without protocol
  if (/^[\w.-]+\.[a-z]{2,}/i.test(raw)) return `https://${raw}`;

  // Map-like free text or place names
  if (raw.toLowerCase().includes('map') || raw.includes(' ')) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(raw)}`;
  }

  return null;
};

const isShortGoogleMapLink = (value?: string | null) => {
  const link = normalizeExternalLink(value);
  if (!link) return false;
  try {
    const url = new URL(link);
    const host = url.hostname.toLowerCase();
    return (
      host.includes('maps.app.goo.gl') ||
      host === 'goo.gl' ||
      host.endsWith('.goo.gl')
    );
  } catch {
    return false;
  }
};

const getGoogleMapEmbedLink = (value?: string | null): string | null => {
  const mapLink = normalizeExternalLink(value);
  if (!mapLink) return null;

  const toEmbedByQuery = (query: string) =>
    `https://www.google.com/maps?output=embed&q=${encodeURIComponent(query)}`;
  const cleanTrackingParams = (url: URL) => {
    const clone = new URL(url.toString());
    clone.searchParams.delete('g_st');
    clone.searchParams.delete('entry');
    clone.searchParams.delete('utm_source');
    clone.searchParams.delete('utm_medium');
    clone.searchParams.delete('utm_campaign');
    return clone.toString();
  };

  if (/^geo:/i.test(mapLink)) {
    const raw = mapLink.replace(/^geo:/i, '');
    const [coordsPart, searchPart] = raw.split('?');
    const searchParams = new URLSearchParams(searchPart ?? '');
    const q = searchParams.get('q')?.trim();
    if (q) return toEmbedByQuery(q);
    if (coordsPart?.trim()) return toEmbedByQuery(coordsPart.trim());
    return null;
  }

  try {
    const parsed = new URL(mapLink);
    const hostname = parsed.hostname.toLowerCase();
    const q =
      parsed.searchParams.get('q')?.trim() ||
      parsed.searchParams.get('query')?.trim() ||
      parsed.searchParams.get('destination')?.trim() ||
      parsed.searchParams.get('daddr')?.trim() ||
      parsed.searchParams.get('ll')?.trim();

    if (q) return toEmbedByQuery(q);

    const atCoordMatch = parsed.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (atCoordMatch) {
      return toEmbedByQuery(`${atCoordMatch[1]},${atCoordMatch[2]}`);
    }

    const placeMatch = parsed.pathname.match(/\/maps\/place\/([^/]+)/i);
    if (placeMatch?.[1]) {
      return toEmbedByQuery(decodeURIComponent(placeMatch[1]));
    }

    // Short Google map links (maps.app.goo.gl / goo.gl/maps) usually cannot be embedded directly
    // without first resolving redirects server-side. Returning null avoids a broken "world map" preview.
    if (
      hostname.includes('maps.app.goo.gl') ||
      hostname === 'goo.gl' ||
      hostname.endsWith('.goo.gl')
    ) {
      return null;
    }

    // For Google map URLs that don't expose query/place/coords, do not force embed with raw URL.
    // That produces inaccurate world-map previews.
    if (hostname.includes('google.') || hostname.includes('maps.google.')) {
      const cleaned = cleanTrackingParams(parsed);
      const reparsed = new URL(cleaned);
      const fallbackQuery =
        reparsed.searchParams.get('q')?.trim() ||
        reparsed.searchParams.get('query')?.trim() ||
        reparsed.searchParams.get('destination')?.trim() ||
        reparsed.searchParams.get('daddr')?.trim() ||
        reparsed.searchParams.get('ll')?.trim();
      return fallbackQuery ? toEmbedByQuery(fallbackQuery) : null;
    }

    return null;
  } catch {
    return null;
  }
};

const extractMapCandidates = (obj?: Record<string, unknown> | null): Array<string | null | undefined> => {
  if (!obj || typeof obj !== 'object') return [];

  const candidates: Array<string | null | undefined> = [];

  for (const [key, val] of Object.entries(obj)) {
    if (typeof val !== 'string' && val !== null && val !== undefined) continue;
    const k = key.toLowerCase();
    if (
      k.includes('map') ||
      k.includes('location') ||
      k === 'latlng' ||
      k === 'latitude' ||
      k === 'longitude'
    ) {
      candidates.push(val as string | null | undefined);
    }
  }

  // Common explicit keys with different casing/words
  const explicitKeys = [
    'installationMapLink',
    'installationMaplink',
    'installationMapUrl',
    'billingMapLink',
    'billingMaplink',
    'billingMapUrl',
    'mapLink',
    'mapUrl',
    'googleMapLink',
    'googleMapsLink',
    'googleMapUrl',
    'googleMapsUrl',
    'locationMapLink',
    'locationLink',
  ] as const;

  for (const key of explicitKeys) {
    const val = obj[key];
    if (typeof val === 'string' || val === null || val === undefined) {
      candidates.push(val as string | null | undefined);
    }
  }

  return candidates;
};

const getMapLocationLink = (
  value?: MapLinkSource | null,
) => {
  const rootObj = (value as unknown as Record<string, unknown>) ?? null;
  const addressInfoObj = ((value as { addressInformation?: Record<string, unknown> } | null | undefined)
    ?.addressInformation ?? null) as Record<string, unknown> | null;

  const candidates = [
    // Prefer billing map link first when present
    (value as { billingMapLink?: string | null } | null | undefined)?.billingMapLink,
    (value as { addressInformation?: { billingMapLink?: string | null } } | null | undefined)
      ?.addressInformation?.billingMapLink,
    (value as { billingMapUrl?: string | null } | null | undefined)?.billingMapUrl,
    (value as { addressInformation?: { billingMapUrl?: string | null } } | null | undefined)
      ?.addressInformation?.billingMapUrl,
    ...(extractMapCandidates(rootObj) ?? []),
    ...(extractMapCandidates(addressInfoObj) ?? []),
  ];

  for (const candidate of candidates) {
    const normalized = normalizeExternalLink(candidate);
    if (normalized) return normalized;
  }
  return null;
};

const resolveMapLocationLink = (
  ...sources: Array<MapLinkSource | null | undefined>
): string | null => {
  for (const source of sources) {
    const candidate = getMapLocationLink(source);
    if (candidate) return candidate;
  }
  return null;
};

const getAddressMapSearchLink = (address?: string | null): string | null => {
  const raw = String(address ?? '').trim();
  if (!raw) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(raw)}`;
};

const getPreferredAddress = (
  value?: { billingAddress?: string | null; installationAddress?: string | null } | null,
) => String(value?.billingAddress ?? '').trim() || String(value?.installationAddress ?? '').trim() || '';

const getPhoneDialLink = (phone?: string | null): string | null => {
  const raw = String(phone ?? '').trim();
  if (!raw) return null;
  const digitsOnly = raw.replace(/\D/g, '');
  if (!digitsOnly) return null;

  let normalized = digitsOnly;
  if (normalized.startsWith('09')) {
    // keep as-is
  } else if (normalized.startsWith('9')) {
    normalized = `0${normalized}`;
  }

  return `tel:${normalized}`;
};

const getLocalizedInvoiceStatusLabel = (
  status: string | null | undefined,
  copy: Record<string, string>,
) => {
  const normalized = String(status ?? '').trim().toLowerCase();
  if (normalized === 'paid') return copy.statusPaid || 'Paid';
  if (normalized === 'overdue') return copy.statusOverdue || 'Overdue';
  if (normalized === 'cancelled' || normalized === 'canceled') return copy.statusCancelled || 'Cancelled';
  return copy.statusUnpaid || 'Unpaid';
};

const getLocalizedCollectorStatusLabel = (
  status: string | null | undefined,
  copy: Record<string, string>,
) => {
  const normalized = String(status ?? '').trim().toLowerCase();
  if (normalized === 'enable') return copy.collectorStatusEnable || 'Enable';
  if (normalized === 'disable') return copy.collectorStatusDisable || 'Disable';
  if (normalized === 'takeoff') return copy.collectorStatusTakeoff || 'Takeoff';
  return copy.collectorStatusUnknown || 'Unknown';
};

const getLocalizedCollectionStatusLabel = (
  status: CollectionWorkflowStatus,
  copy: Record<string, string>,
) => {
  if (status === 'en_route') return copy.collectionStatusEnRoute || 'On the way';
  if (status === 'arrived') return copy.collectionStatusArrived || 'Arrived';
  if (status === 'rescheduled') return copy.collectionStatusRescheduled || 'Rescheduled';
  if (status === 'office_transfer') return copy.collectionStatusOfficeTransfer || 'Office Transfer';
  if (status === 'collected_pending_admin') return copy.collectionStatusCollectedPendingAdmin || 'Collected';
  if (status === 'completed') return copy.collectionStatusCompleted || 'Completed';
  return copy.collectionStatusNotStarted || getCollectionWorkflowStatusLabel(status);
};

export default function CollectorDashboard() {
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>('en');
  const [dashboardCopy, setDashboardCopy] = useState(() => ({
    en: { ...DEFAULT_COLLECTOR_DASHBOARD_COPY.en },
    mm: { ...DEFAULT_COLLECTOR_DASHBOARD_COPY.mm },
  }));
  const isBurmeseLanguage = user?.role === 'collector' && uiLanguage === 'mm';
  const copy = isBurmeseLanguage ? dashboardCopy.mm : dashboardCopy.en;
  const assignedBillsLabel = copy.assignedBillsLabel || 'Assigned Bills';
  const collectedBillsLabel = copy.collectedBillsLabel || 'Collected Bills';
  const collectTodayLabel = copy.collectTodayLabel || 'To Collect Today';
  const markCollectTodayLabel = copy.markCollectTodayLabel || 'Mark Collect Today';
  const selectedBillsLabel = copy.selectedBillsLabel || 'Selected Bills';
  const clearQueueLabel = copy.clearQueueLabel || 'Clear Today Queue';
  const removeFromQueueLabel = copy.removeFromQueueLabel || 'Remove from Today';
  const collectTodayEmptyMessage = copy.collectTodayEmptyMessage || 'No bills marked for collection today.';
  const reorderQueueHintLabel = copy.reorderQueueHintLabel || 'Drag and drop bills to re-order today queue';
  const queuedTagLabel = copy.queuedTagLabel || 'Queued Today';
  const noCollectedBillsMessage = copy.noCollectedBillsMessage || 'No collected bills found.';
  const selectMenuMessage = copy.selectMenuMessage || 'Select a section from the sidebar to view details.';
  const initiatedStatusLabel = copy.initiatedStatusLabel || 'Initiated';
  const calledStatusLabel = copy.calledStatusLabel || 'Call Completed';
  const startCollectionNowLabel = copy.startCollectionNowLabel || 'Start Collection';
  const callCompletedButtonLabel = copy.callCompletedButtonLabel || 'Call Completed';
  const collectFromCustomerLabel = copy.collectFromCustomerLabel || 'Collect from Customer';
  const payToAdminLabel = copy.payToAdminLabel || 'Pay to Admin';
  const paymentMethodLabel = copy.paymentMethodLabel || 'Payment Method';
  const paymentAccountLabel = copy.paymentAccountLabel || 'Payment Account';
  const choosePaymentMethodLabel = copy.choosePaymentMethodLabel || 'Choose payment method';
  const choosePaymentAccountLabel = copy.choosePaymentAccountLabel || 'Choose payment account';
  const cashLabel = copy.cashLabel || 'Cash';
  const walletLabel = copy.walletLabel || 'Wallet';
  const accountLabel = copy.accountLabel || 'Bank Account';
  const initiatedEventLabel = copy.initiatedEventLabel || 'Collection workflow initiated.';
  const callCompletedEventLabel = copy.callCompletedEventLabel || 'Customer call completed.';
  const choosePaymentMethodFirstLabel = copy.choosePaymentMethodFirstLabel || 'Please choose payment method first.';
  const choosePaymentAccountFirstLabel = copy.choosePaymentAccountFirstLabel || 'Please choose payment account for selected payment method.';
  const noPaymentAccountsLabel = copy.noPaymentAccountsLabel || 'No active payment accounts for selected method.';
  const showPaymentDetailsLabel = copy.showPaymentDetailsLabel || 'Show Payment Details';
  const paymentDetailsDialogTitle = copy.paymentDetailsDialogTitle || 'Customer Payment Details';
  const paymentTypeLabel = copy.paymentTypeLabel || 'Type';
  const paymentProviderLabel = copy.paymentProviderLabel || 'Provider / Bank';
  const accountNameLabel = copy.accountNameLabel || 'Account Name';
  const accountNumberLabel = copy.accountNumberLabel || 'Account Number';
  const qrCodeLabel = copy.qrCodeLabel || 'QR Code';
  const copiedLabel = copy.copiedLabel || 'Copied';
  const copyFailedLabel = copy.copyFailedLabel || 'Copy failed';
  const notAvailableLabel = copy.notAvailableLabel || 'N/A';
  const closeLabel = copy.closeLabel || 'Close';

  const [searchTerm, setSearchTerm] = useState('');
  const [activeView, setActiveView] = useState<CollectorDashboardView>('dashboard');
  const [selectedDueBillIds, setSelectedDueBillIds] = useState<string[]>([]);
  const [collectTodayQueueIds, setCollectTodayQueueIds] = useState<string[]>([]);
  const [draggingQueueBillId, setDraggingQueueBillId] = useState<string | null>(null);
  const [dragOverQueueBillId, setDragOverQueueBillId] = useState<string | null>(null);
  const [selectedCollectionInvoice, setSelectedCollectionInvoice] = useState<InvoiceRecord | null>(null);
  const [selectedBillDetails, setSelectedBillDetails] = useState<InvoiceRecord | null>(null);
  const [selectedCustomerDetails, setSelectedCustomerDetails] = useState<{
    customer: CollectorCustomer;
    lastInvoice?: InvoiceRecord;
  } | null>(null);
  const [collectionNote, setCollectionNote] = useState('');

  const [customers, setCustomers] = useState<CollectorCustomer[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [customerDetailsById, setCustomerDetailsById] = useState<Record<string, MapLinkSource>>({});
  const [customerProfilesById, setCustomerProfilesById] = useState<Record<string, MapLinkSource>>({});
  const [customerProfilesByCode, setCustomerProfilesByCode] = useState<Record<string, MapLinkSource>>({});
  const [collectionMap, setCollectionMap] = useState<CollectionWorkflowMap>({});
  const [forceReleasedInvoiceIds, setForceReleasedInvoiceIds] = useState<Record<string, boolean>>({});
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [isUpdatingCollection, setIsUpdatingCollection] = useState(false);
  const [isLoadingPaymentAccounts, setIsLoadingPaymentAccounts] = useState(false);
  const [selectedCollectionMapLocationLink, setSelectedCollectionMapLocationLink] = useState<string | null>(null);
  const [selectedCollectionResolvedMapLocationLink, setSelectedCollectionResolvedMapLocationLink] =
    useState<string | null>(null);
  const [isResolvingSelectedCollectionMapLink, setIsResolvingSelectedCollectionMapLink] = useState(false);
  const [callCompletedByInvoiceId, setCallCompletedByInvoiceId] = useState<Record<string, boolean>>({});
  const [collectJourneyStartedByInvoiceId, setCollectJourneyStartedByInvoiceId] = useState<Record<string, boolean>>(
    {},
  );
  const [paymentMethodByInvoiceId, setPaymentMethodByInvoiceId] = useState<
    Record<string, CollectorPaymentMethod>
  >({});
  const [paymentAccountIdByInvoiceId, setPaymentAccountIdByInvoiceId] = useState<Record<string, string>>({});
  const [paymentSlipFileByInvoiceId, setPaymentSlipFileByInvoiceId] = useState<Record<string, File | null>>({});
  const [paymentSlipFileNameByInvoiceId, setPaymentSlipFileNameByInvoiceId] = useState<Record<string, string>>({});
  const [isPaymentDetailsOpen, setIsPaymentDetailsOpen] = useState(false);

  const resolveShortGoogleMapLink = useCallback(async (shortLink: string): Promise<string | null> => {
    try {
      const response = await fetch(`/api/maps/resolve?url=${encodeURIComponent(shortLink)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) return null;
      const data = await response.json().catch(() => null);
      const resolved = normalizeExternalLink(String(data?.resolvedUrl ?? ''));
      return resolved || null;
    } catch {
      return null;
    }
  }, []);

  const collectorTodayQueueStorageKey = useMemo(() => {
    const collectorKey =
      normalizeKey(user?.collectorProfile?.id) ||
      normalizeKey(user?.id) ||
      normalizeKey(user?.collectorProfile?.collectorCode) ||
      normalizeKey(user?.username) ||
      'unknown';
    return `${COLLECTOR_TODAY_QUEUE_STORAGE_PREFIX}_${collectorKey}`;
  }, [user?.collectorProfile?.collectorCode, user?.collectorProfile?.id, user?.id, user?.username]);

  useEffect(() => {
    if (user?.role !== 'collector') {
      setUiLanguage('en');
      return;
    }
    setUiLanguage(readUiLanguage(user.collectorProfile?.language));
  }, [user?.role, user?.collectorProfile?.language]);

  useEffect(() => {
    if (typeof window === 'undefined' || user?.role !== 'collector') return;

    const syncLanguage = () => {
      setUiLanguage(readUiLanguage(user.collectorProfile?.language));
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === UI_LANGUAGE_STORAGE_KEY) {
        syncLanguage();
      }
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener(UI_LANGUAGE_UPDATED_EVENT, syncLanguage as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(UI_LANGUAGE_UPDATED_EVENT, syncLanguage as EventListener);
    };
  }, [user?.role, user?.collectorProfile?.language]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncActiveView = () => {
      const hashView = window.location.hash.replace('#', '').trim();
      const paramView = searchParams.get('view');
      const nextView = normalizeCollectorDashboardView(hashView || paramView);
      setActiveView(nextView);
    };
    syncActiveView();
    window.addEventListener('hashchange', syncActiveView);
    return () => {
      window.removeEventListener('hashchange', syncActiveView);
    };
  }, [searchParams]);

  useEffect(() => {
    if (typeof window === 'undefined' || user?.role !== 'collector') return;
    try {
      const raw = window.localStorage.getItem(collectorTodayQueueStorageKey);
      if (!raw) {
        setCollectTodayQueueIds([]);
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const ids = parsed
          .map((value) => String(value).trim())
          .filter(Boolean);
        setCollectTodayQueueIds(Array.from(new Set(ids)));
      } else {
        setCollectTodayQueueIds([]);
      }
    } catch {
      setCollectTodayQueueIds([]);
    }
  }, [collectorTodayQueueStorageKey, user?.role]);

  useEffect(() => {
    if (typeof window === 'undefined' || user?.role !== 'collector') return;
    try {
      window.localStorage.setItem(collectorTodayQueueStorageKey, JSON.stringify(collectTodayQueueIds));
    } catch {
      // ignore storage write errors
    }
  }, [collectorTodayQueueStorageKey, collectTodayQueueIds, user?.role]);

  useEffect(() => {
    if (typeof window === 'undefined' || user?.role !== 'collector') return;
    let active = true;

    const loadDashboardCopy = async () => {
      try {
        const response = await fetch('/api/reference-data/collector-dashboard-copy', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) return;
        const data = await response.json().catch(() => null);
        if (!active) return;
        setDashboardCopy(normalizeCollectorDashboardCopy(data?.copy));
      } catch {
        // keep default copy if reference data endpoint fails
      }
    };

    const syncDashboardCopy = () => {
      void loadDashboardCopy();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === COLLECTOR_DASHBOARD_COPY_UPDATED_AT_STORAGE_KEY) {
        syncDashboardCopy();
      }
    };

    void loadDashboardCopy();
    window.addEventListener(COLLECTOR_DASHBOARD_COPY_UPDATED_EVENT, syncDashboardCopy as EventListener);
    window.addEventListener('storage', onStorage);

    return () => {
      active = false;
      window.removeEventListener(
        COLLECTOR_DASHBOARD_COPY_UPDATED_EVENT,
        syncDashboardCopy as EventListener,
      );
      window.removeEventListener('storage', onStorage);
    };
  }, [user?.role]);

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
    if (!user || user.role !== 'collector') return;
    let mounted = true;

    const fetchPaymentAccounts = async () => {
      setIsLoadingPaymentAccounts(true);
      try {
        const response = await fetch(`${API_BASE_URL}/billing/payment-accounts`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(
            Array.isArray(payload?.message)
              ? payload.message.join(', ')
              : payload?.message ?? 'Failed to load payment accounts',
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
              qrCodeDataUrl: item?.qrCodeDataUrl ?? null,
              isActive: Boolean(item?.isActive ?? true),
            } as PaymentAccount;
          })
          .filter((item) => item.id && item.accountName);

        if (mounted) {
          setPaymentAccounts(normalized);
        }
      } catch {
        if (mounted) {
          setPaymentAccounts([]);
        }
      } finally {
        if (mounted) {
          setIsLoadingPaymentAccounts(false);
        }
      }
    };

    void fetchPaymentAccounts();
    return () => {
      mounted = false;
    };
  }, [user?.id, user?.role]);

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
          throw new Error(data?.message ?? copy.failedToLoadCustomers);
        }

        if (!invoicesResponse.ok) {
          const data = await invoicesResponse.json().catch(() => null);
          throw new Error(data?.message ?? copy.failedToLoadInvoices);
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

        const normalizedCustomers = customerList as CollectorCustomer[];
        setCustomers(normalizedCustomers);
        setInvoices(normalizedInvoices);

        const assignedCustomers = normalizedCustomers.filter((customer) => {
          const assignmentKeys = [
            customer.collectorCode,
            customer.collectorId,
            customer.collector?.id,
            customer.collector?.collectorCode,
          ]
            .map((value) => normalizeKey(value))
            .filter(Boolean);
          if (assignmentKeys.length === 0) return false;
          return assignmentKeys.some((key) => collectorIdentityKeys.has(key));
        });

        try {
          const detailEntries = await Promise.all(
            assignedCustomers.map(async (customer) => {
              const customerId = String(customer.id || '').trim();
              if (!customerId) return null;
              try {
                const detailResponse = await fetch(`${API_BASE_URL}/customers/${customerId}`, {
                  method: 'GET',
                  headers: { 'Content-Type': 'application/json' },
                });
                if (!detailResponse.ok) return null;
                const detailData = await detailResponse.json().catch(() => null);
                const detail =
                  detailData && typeof detailData === 'object'
                    ? ((detailData.customer ??
                        detailData.data ??
                        detailData) as Record<string, unknown>)
                    : null;
                if (!detail || typeof detail !== 'object') return null;
                return [normalizeKey(customerId), detail as MapLinkSource] as const;
              } catch {
                return null;
              }
            }),
          );

          if (mounted) {
            const detailMap: Record<string, MapLinkSource> = {};
            for (const entry of detailEntries) {
              if (!entry) continue;
              detailMap[entry[0]] = entry[1];
            }
            setCustomerDetailsById(detailMap);
          }
        } catch {
          if (mounted) {
            setCustomerDetailsById({});
          }
        }

        try {
          const usersResponse = await fetch(`${API_BASE_URL}/users`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });

          if (usersResponse.ok) {
            const usersData = await usersResponse.json().catch(() => []);
            const usersList = Array.isArray(usersData)
              ? usersData
              : Array.isArray(usersData?.users)
                ? usersData.users
                : Array.isArray(usersData?.data)
                  ? usersData.data
                  : [];

            const byId: Record<string, MapLinkSource> = {};
            const byCode: Record<string, MapLinkSource> = {};

            for (const userItem of usersList) {
              const customerProfile = userItem?.customer;
              if (!customerProfile || typeof customerProfile !== 'object') continue;

              const idKey = normalizeKey(String(customerProfile?.id ?? ''));
              const codeKey = normalizeKey(String(customerProfile?.customerCode ?? ''));
              const mergedProfile: MapLinkSource = {
                ...customerProfile,
                addressInformation:
                  (customerProfile as { addressInformation?: MapLinkSource['addressInformation'] }).addressInformation ??
                  undefined,
              };

              if (idKey) byId[idKey] = mergedProfile;
              if (codeKey) byCode[codeKey] = mergedProfile;
            }

            if (mounted) {
              setCustomerProfilesById(byId);
              setCustomerProfilesByCode(byCode);
            }
          } else if (mounted) {
            setCustomerProfilesById({});
            setCustomerProfilesByCode({});
          }
        } catch {
          if (mounted) {
            setCustomerProfilesById({});
            setCustomerProfilesByCode({});
          }
        }
      } catch (error) {
        if (!mounted) return;
        setLoadError(error instanceof Error ? error.message : copy.failedToLoadDashboardData);
        setCustomers([]);
        setInvoices([]);
        setCustomerDetailsById({});
        setCustomerProfilesById({});
        setCustomerProfilesByCode({});
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
  }, [user?.id, user?.role, collectorIdentityKeys]);

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
    const name = getCustomerDisplayName(customer, copy.unknownCustomer).toLowerCase();
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
  const filteredDueBills = dueBills.filter((bill) => {
    const linkedCustomer = findCustomerForInvoice(bill);
    const name = linkedCustomer
      ? getCustomerDisplayName(linkedCustomer, copy.unknownCustomer).toLowerCase()
      : getCustomerDisplayName(
          {
            personalName: bill.customer?.personalName,
            companyName: bill.customer?.companyName,
          },
          copy.unknownCustomer,
        ).toLowerCase();
    const phone = (linkedCustomer?.primaryPhone ?? bill.customer?.primaryPhone ?? '').toLowerCase();
    const code = (linkedCustomer?.customerCode ?? bill.customer?.customerCode ?? '').toLowerCase();
    const query = searchTerm.toLowerCase();
    return name.includes(query) || phone.includes(query) || code.includes(query);
  });
  const queuedDueBills = useMemo(() => {
    const dueBillById = new Map(dueBills.map((bill) => [bill.id, bill] as const));
    return collectTodayQueueIds
      .map((invoiceId) => dueBillById.get(invoiceId))
      .filter((bill): bill is InvoiceRecord => Boolean(bill));
  }, [collectTodayQueueIds, dueBills]);
  const isBillQueuedToday = (invoiceId: string) => collectTodayQueueIds.includes(invoiceId);

  const toggleDueBillSelection = (invoiceId: string, checked: boolean) => {
    setSelectedDueBillIds((prev) => {
      if (checked) {
        if (prev.includes(invoiceId)) return prev;
        return [...prev, invoiceId];
      }
      return prev.filter((id) => id !== invoiceId);
    });
  };
  const getSelectedDueBillOrder = (invoiceId: string) => {
    const index = selectedDueBillIds.indexOf(invoiceId);
    return index === -1 ? null : index + 1;
  };

  const markSelectedBillsCollectToday = () => {
    if (selectedDueBillIds.length === 0) return;
    setCollectTodayQueueIds((prev) => Array.from(new Set([...prev, ...selectedDueBillIds])));
    setSelectedDueBillIds([]);
  };

  const removeBillFromTodayQueue = (invoiceId: string) => {
    setCollectTodayQueueIds((prev) => prev.filter((id) => id !== invoiceId));
    setSelectedDueBillIds((prev) => prev.filter((id) => id !== invoiceId));
  };

  const clearTodayQueue = () => {
    setCollectTodayQueueIds([]);
    setSelectedDueBillIds([]);
    setDraggingQueueBillId(null);
    setDragOverQueueBillId(null);
  };

  const reorderTodayQueue = (dragId: string, targetId: string) => {
    if (!dragId || !targetId || dragId === targetId) return;
    setCollectTodayQueueIds((prev) => {
      const fromIndex = prev.indexOf(dragId);
      const toIndex = prev.indexOf(targetId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  useEffect(() => {
    const dueBillIdSet = new Set(dueBills.map((bill) => bill.id));
    setSelectedDueBillIds((prev) => prev.filter((id) => dueBillIdSet.has(id)));
    setCollectTodayQueueIds((prev) => prev.filter((id) => dueBillIdSet.has(id)));
    setDraggingQueueBillId((prev) => (prev && dueBillIdSet.has(prev) ? prev : null));
    setDragOverQueueBillId((prev) => (prev && dueBillIdSet.has(prev) ? prev : null));
  }, [dueBills]);

  const collectedBills = myInvoices.filter((bill) => {
    const collectionStatus = getCollectionStatusForInvoice(bill);
    return (
      bill.status === 'paid' ||
      collectionStatus === 'collected_pending_admin' ||
      collectionStatus === 'office_transfer' ||
      collectionStatus === 'completed'
    );
  });
  const filteredCollectedBills = collectedBills.filter((bill) => {
    const linkedCustomer = findCustomerForInvoice(bill);
    const name = linkedCustomer
      ? getCustomerDisplayName(linkedCustomer, copy.unknownCustomer).toLowerCase()
      : getCustomerDisplayName(
          {
            personalName: bill.customer?.personalName,
            companyName: bill.customer?.companyName,
          },
          copy.unknownCustomer,
        ).toLowerCase();
    const phone = (linkedCustomer?.primaryPhone ?? bill.customer?.primaryPhone ?? '').toLowerCase();
    const code = (linkedCustomer?.customerCode ?? bill.customer?.customerCode ?? '').toLowerCase();
    const query = searchTerm.toLowerCase();
    return name.includes(query) || phone.includes(query) || code.includes(query);
  });

  const findCustomerProfile = (
    customerId?: string | null,
    customerCode?: string | null,
  ): MapLinkSource | null => {
    const idKey = normalizeKey(customerId);
    if (idKey && customerDetailsById[idKey]) return customerDetailsById[idKey];
    if (idKey && customerProfilesById[idKey]) return customerProfilesById[idKey];
    const codeKey = normalizeKey(customerCode);
    if (codeKey && customerProfilesByCode[codeKey]) return customerProfilesByCode[codeKey];
    return null;
  };

  useEffect(() => {
    if (!selectedCollectionInvoice) {
      setSelectedCollectionMapLocationLink(null);
      setSelectedCollectionResolvedMapLocationLink(null);
      setIsResolvingSelectedCollectionMapLink(false);
      return;
    }

    let active = true;
    const selectedLinkedCustomer = findCustomerForInvoice(selectedCollectionInvoice);
    const selectedLinkedProfile = selectedLinkedCustomer
      ? findCustomerProfile(selectedLinkedCustomer.id, selectedLinkedCustomer.customerCode)
      : findCustomerProfile(
          getInvoiceCustomerId(selectedCollectionInvoice),
          getInvoiceCustomerCode(selectedCollectionInvoice),
        );
    const rawMapLink =
      resolveMapLocationLink(
        selectedLinkedProfile,
        selectedLinkedCustomer,
        selectedCollectionInvoice.customer,
      ) ||
      getAddressMapSearchLink(
        getPreferredAddress(selectedLinkedCustomer) ||
          getPreferredAddress(selectedCollectionInvoice.customer),
      );

    setSelectedCollectionMapLocationLink(rawMapLink);
    setSelectedCollectionResolvedMapLocationLink(
      rawMapLink && !isShortGoogleMapLink(rawMapLink) ? rawMapLink : null,
    );

    const resolve = async () => {
      if (!rawMapLink || !isShortGoogleMapLink(rawMapLink)) return;
      setIsResolvingSelectedCollectionMapLink(true);
      const resolved = await resolveShortGoogleMapLink(rawMapLink);
      if (!active) return;
      setSelectedCollectionResolvedMapLocationLink(resolved);
      setIsResolvingSelectedCollectionMapLink(false);
    };

    void resolve();

    return () => {
      active = false;
    };
  }, [
    selectedCollectionInvoice,
    customers,
    customerDetailsById,
    customerProfilesById,
    customerProfilesByCode,
    resolveShortGoogleMapLink,
  ]);

  const selectedCollectionStatus: CollectionWorkflowStatus = selectedCollectionInvoice
    ? getCollectionStatusForInvoice(selectedCollectionInvoice)
    : 'idle';
  const selectedCollectionInvoiceId = selectedCollectionInvoice?.id ?? '';
  const isCallCompleted =
    selectedCollectionInvoiceId ? Boolean(callCompletedByInvoiceId[selectedCollectionInvoiceId]) : false;
  const isCollectJourneyStarted = selectedCollectionInvoiceId
    ? Boolean(collectJourneyStartedByInvoiceId[selectedCollectionInvoiceId])
    : false;
  const selectedPaymentMethod: CollectorPaymentMethod =
    selectedCollectionInvoiceId && paymentMethodByInvoiceId[selectedCollectionInvoiceId]
      ? paymentMethodByInvoiceId[selectedCollectionInvoiceId]
      : 'cash';
  const selectedPaymentAccountId = selectedCollectionInvoiceId
    ? paymentAccountIdByInvoiceId[selectedCollectionInvoiceId] ?? ''
    : '';
  const availablePaymentAccounts = paymentAccounts.filter(
    (account) => account.isActive !== false && account.kind === selectedPaymentMethod,
  );
  const selectedPaymentAccount = availablePaymentAccounts.find(
    (account) => account.id === selectedPaymentAccountId,
  );
  const selectedPaymentSlipFile = selectedCollectionInvoiceId
    ? paymentSlipFileByInvoiceId[selectedCollectionInvoiceId] ?? null
    : null;
  const selectedPaymentSlipFileName = selectedCollectionInvoiceId
    ? paymentSlipFileNameByInvoiceId[selectedCollectionInvoiceId] ?? ''
    : '';
  const selectedCollectionRecord: CollectionWorkflowRecord | null = selectedCollectionInvoice
    ? collectionMap[selectedCollectionInvoice.id] ?? null
    : null;
  const selectedCollectionTimeline =
    selectedCollectionInvoice && Array.isArray(selectedCollectionInvoice.collectionEvents)
      ? selectedCollectionInvoice.collectionEvents
      : selectedCollectionRecord?.events ?? [];

  useEffect(() => {
    if (!selectedCollectionInvoiceId) return;
    setPaymentMethodByInvoiceId((prev) =>
      prev[selectedCollectionInvoiceId]
        ? prev
        : { ...prev, [selectedCollectionInvoiceId]: 'cash' },
    );
    if (selectedCollectionStatus === 'arrived') {
      setCallCompletedByInvoiceId((prev) => ({ ...prev, [selectedCollectionInvoiceId]: true }));
      setCollectJourneyStartedByInvoiceId((prev) => ({ ...prev, [selectedCollectionInvoiceId]: false }));
    }
  }, [selectedCollectionInvoiceId, selectedCollectionStatus]);

  useEffect(() => {
    if (!selectedCollectionInvoiceId) {
      setIsPaymentDetailsOpen(false);
      return;
    }
    if (selectedPaymentMethod === 'cash' || !selectedPaymentAccount) {
      setIsPaymentDetailsOpen(false);
    }
  }, [selectedCollectionInvoiceId, selectedPaymentMethod, selectedPaymentAccount]);

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
      note?: string;
      paymentMethod?: string;
      paymentSlipFile?: File | null;
    },
  ): Promise<boolean> => {
    if (isUpdatingCollection) return false;
    setIsUpdatingCollection(true);

    try {
      const noteValue = (payload.note ?? collectionNote) || undefined;
      const response = await fetch(`${API_BASE_URL}/billing/invoices/${invoice.id}/collection-workflow`, {
        method: 'POST',
        ...(payload.paymentSlipFile
          ? {
              body: (() => {
                const formData = new FormData();
                formData.append('status', payload.status);
                formData.append('type', payload.type);
                formData.append('label', payload.label);
                if (noteValue) formData.append('note', noteValue);
                if (payload.paymentMethod) formData.append('paymentMethod', payload.paymentMethod);
                if (user?.name) formData.append('actorName', user.name);
                if (user?.role) formData.append('actorRole', user.role);
                formData.append('paymentSlip', payload.paymentSlipFile);
                return formData;
              })(),
            }
          : {
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                status: payload.status,
                type: payload.type,
                label: payload.label,
                note: noteValue,
                paymentMethod: payload.paymentMethod || undefined,
                actorName: user?.name || undefined,
                actorRole: user?.role || undefined,
              }),
            }),
      });

      const updatedData = await response.json().catch(() => null);
      if (!response.ok) {
        const message = Array.isArray(updatedData?.message)
          ? updatedData.message.join(', ')
          : updatedData?.message ?? copy.failedToUpdateCollectionWorkflow;
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
          note: noteValue,
          paymentMethod: payload.paymentMethod || undefined,
        },
      });

      setCollectionNote('');

      toast({
        title: payload.title,
        description: copy.collectionLogUpdated,
      });
      return true;
    } catch (error) {
      toast({
        title: copy.collectionUpdateFailed,
        description:
          error instanceof Error ? error.message : copy.failedToUpdateCollectionWorkflow,
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsUpdatingCollection(false);
    }
  };

  const handleStartCollection = async () => {
    if (!selectedCollectionInvoice) return;
    const ok = await applyCollectionAction(selectedCollectionInvoice, {
      status: 'en_route',
      type: 'en_route',
      label: initiatedEventLabel,
      title: initiatedStatusLabel,
    });
    if (!ok) return;
    setCallCompletedByInvoiceId((prev) => ({ ...prev, [selectedCollectionInvoice.id]: false }));
    setCollectJourneyStartedByInvoiceId((prev) => ({ ...prev, [selectedCollectionInvoice.id]: false }));
    setPaymentMethodByInvoiceId((prev) => ({ ...prev, [selectedCollectionInvoice.id]: 'cash' }));
    setPaymentAccountIdByInvoiceId((prev) => ({ ...prev, [selectedCollectionInvoice.id]: '' }));
    setPaymentSlipFileByInvoiceId((prev) => ({ ...prev, [selectedCollectionInvoice.id]: null }));
    setPaymentSlipFileNameByInvoiceId((prev) => ({ ...prev, [selectedCollectionInvoice.id]: '' }));
  };

  const handleCallCompleted = async () => {
    if (!selectedCollectionInvoice) return;
    const ok = await applyCollectionAction(selectedCollectionInvoice, {
      status: 'en_route',
      type: 'en_route',
      label: callCompletedEventLabel,
      title: calledStatusLabel,
    });
    if (!ok) return;
    setCallCompletedByInvoiceId((prev) => ({ ...prev, [selectedCollectionInvoice.id]: true }));
    setCollectJourneyStartedByInvoiceId((prev) => ({ ...prev, [selectedCollectionInvoice.id]: false }));
  };

  const handleChooseCollectFromCustomer = async () => {
    if (!selectedCollectionInvoice) return;
    const ok = await applyCollectionAction(selectedCollectionInvoice, {
      status: 'en_route',
      type: 'en_route',
      label: copy.enRouteLabel,
      title: copy.collectionStarted,
    });
    if (!ok) return;
    setCallCompletedByInvoiceId((prev) => ({ ...prev, [selectedCollectionInvoice.id]: true }));
    setCollectJourneyStartedByInvoiceId((prev) => ({ ...prev, [selectedCollectionInvoice.id]: true }));
  };

  const handleChoosePayToAdmin = async () => {
    if (!selectedCollectionInvoice) return;
    const ok = await applyCollectionAction(selectedCollectionInvoice, {
      status: 'office_transfer',
      type: 'office_transfer',
      label: copy.officeTransferLabel,
      title: copy.transferredToOfficeFlow,
    });
    if (!ok) return;
    setCallCompletedByInvoiceId((prev) => ({ ...prev, [selectedCollectionInvoice.id]: true }));
    setCollectJourneyStartedByInvoiceId((prev) => ({ ...prev, [selectedCollectionInvoice.id]: false }));
  };

  const handleMarkArrived = async () => {
    if (!selectedCollectionInvoice) return;
    const ok = await applyCollectionAction(selectedCollectionInvoice, {
      status: 'arrived',
      type: 'arrived',
      label: copy.arrivedLabel,
      title: copy.arrivalRecorded,
    });
    if (!ok) return;
    setCollectJourneyStartedByInvoiceId((prev) => ({ ...prev, [selectedCollectionInvoice.id]: false }));
  };

  const handleMarkCollected = async () => {
    if (!selectedCollectionInvoice) return;
    if (!selectedPaymentMethod) {
      toast({
        title: choosePaymentMethodFirstLabel,
        variant: 'destructive',
      });
      return;
    }
    if (
      (selectedPaymentMethod === 'wallet' || selectedPaymentMethod === 'account') &&
      !selectedPaymentAccount
    ) {
      toast({
        title: choosePaymentAccountFirstLabel,
        variant: 'destructive',
      });
      return;
    }
    if (
      (selectedPaymentMethod === 'wallet' || selectedPaymentMethod === 'account') &&
      !selectedPaymentSlipFile
    ) {
      toast({
        title: 'Upload payment receipt',
        description: 'Please upload payment receipt/slip image before submit.',
        variant: 'destructive',
      });
      return;
    }

    const paymentMethodName =
      selectedPaymentMethod === 'cash'
        ? 'Cash'
        : selectedPaymentMethod === 'wallet'
          ? 'Wallet'
          : 'Bank Account';
    const accountInfo = selectedPaymentAccount
      ? `${selectedPaymentAccount.accountName} (${selectedPaymentAccount.accountNumber})`
      : '';
    const paymentNoteParts = [
      collectionNote.trim(),
      `Payment Method: ${paymentMethodName}`,
      accountInfo ? `Payment Account: ${accountInfo}` : '',
    ].filter(Boolean);

    await applyCollectionAction(selectedCollectionInvoice, {
      status: 'collected_pending_admin',
      type: 'collector_collected',
      label: copy.collectorCollectedLabel,
      title: copy.markedAsCollected,
      note: paymentNoteParts.join(' | '),
      paymentMethod: paymentMethodName,
      paymentSlipFile:
        selectedPaymentMethod === 'wallet' || selectedPaymentMethod === 'account'
          ? selectedPaymentSlipFile
          : null,
    });
  };

  const copyPaymentText = async (value: string, label: string) => {
    const text = value.trim();
    if (!text) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else if (typeof document !== 'undefined') {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      } else {
        throw new Error('Clipboard not available');
      }
      toast({
        title: copiedLabel,
        description: `${label} ${copiedLabel.toLowerCase()}`,
      });
    } catch {
      toast({
        title: copyFailedLabel,
        variant: 'destructive',
      });
    }
  };

  if (authLoading) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  if (!user || user.role !== 'collector') {
    return <div>{copy.accessDenied}</div>;
  }

  if (isCollectorSuspended(user.status)) {
    return <div>Collector account is suspended. Please contact admin.</div>;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{copy.dashboardTitle}</h1>
          <p className="text-gray-600">
            {copy.welcomeBack}, {user.name}
          </p>
        </div>

        {isLoading && (
          <Card>
            <CardContent className="pt-6 text-sm text-slate-600">{copy.loadingInvoicesAndCustomers}</CardContent>
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
              <CardTitle className="text-sm font-medium">{copy.assignedCustomers}</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAssigned}</div>
              <p className="text-xs text-muted-foreground">{copy.totalCustomersAssigned}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{copy.todaysCollection}</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatMoney(todayCollection)}</div>
              <p className="text-xs text-muted-foreground">{copy.collectedToday}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{copy.pendingBills}</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingBills}</div>
              <p className="text-xs text-muted-foreground">{copy.billsToCollect}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{copy.overdueBills}</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{overdueBills}</div>
              <p className="text-xs text-muted-foreground">{copy.requiresImmediateAttention}</p>
            </CardContent>
          </Card>
        </div>

        {activeView !== 'dashboard' && (
          <Card>
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder={copy.searchCustomersPlaceholder}
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {activeView === 'dashboard' && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>
                  {collectTodayLabel} ({queuedDueBills.length})
                </CardTitle>
                {queuedDueBills.length > 0 && (
                  <Button variant="outline" size="sm" onClick={clearTodayQueue}>
                    {clearQueueLabel}
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {queuedDueBills.length === 0 ? (
                  <p className="text-sm text-slate-600">{collectTodayEmptyMessage}</p>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500">{reorderQueueHintLabel}</p>
                    {queuedDueBills.map((bill, index) => {
                      const linkedCustomer = findCustomerForInvoice(bill);
                      const displayName = linkedCustomer
                        ? getCustomerDisplayName(linkedCustomer, copy.unknownCustomer)
                        : getCustomerDisplayName(
                            {
                              personalName: bill.customer?.personalName,
                              companyName: bill.customer?.companyName,
                            },
                            copy.unknownCustomer,
                          );
                      return (
                        <div
                          key={bill.id}
                          className={`rounded-md border p-3 transition-colors ${
                            dragOverQueueBillId === bill.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-slate-200 bg-white'
                          }`}
                          draggable
                          onDragStart={(event) => {
                            setDraggingQueueBillId(bill.id);
                            event.dataTransfer.effectAllowed = 'move';
                            event.dataTransfer.setData('text/plain', bill.id);
                          }}
                          onDragOver={(event) => {
                            event.preventDefault();
                            if (draggingQueueBillId && draggingQueueBillId !== bill.id) {
                              event.dataTransfer.dropEffect = 'move';
                              setDragOverQueueBillId(bill.id);
                            }
                          }}
                          onDragLeave={() => {
                            if (dragOverQueueBillId === bill.id) {
                              setDragOverQueueBillId(null);
                            }
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            const sourceId = draggingQueueBillId || event.dataTransfer.getData('text/plain') || '';
                            reorderTodayQueue(sourceId, bill.id);
                            setDraggingQueueBillId(null);
                            setDragOverQueueBillId(null);
                          }}
                          onDragEnd={() => {
                            setDraggingQueueBillId(null);
                            setDragOverQueueBillId(null);
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-slate-900">
                                <span className="mr-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-100 px-1 text-xs font-semibold text-blue-700">
                                  {index + 1}
                                </span>
                                {displayName}
                              </p>
                              <p className="text-sm text-slate-500">
                                {copy.invoice}: {getInvoicePeriodLabel(bill)}
                              </p>
                              <p className="text-sm text-slate-500">
                                {copy.due}: {formatDisplayDate(bill.dueDate, '-')}
                              </p>
                            </div>
                            <p className="text-lg font-semibold text-green-700">
                              {formatMoney(bill.totalAmount, bill.currency || 'MMK')}
                            </p>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => setSelectedBillDetails(bill)}>
                              <Eye className="mr-2 h-4 w-4" />
                              {copy.details}
                            </Button>
                            <Button size="sm" onClick={() => setSelectedCollectionInvoice(bill)}>
                              {copy.collectionFlow}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => removeBillFromTodayQueue(bill.id)}
                            >
                              {removeFromQueueLabel}
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
              <CardContent className="pt-6 text-sm text-slate-600">{selectMenuMessage}</CardContent>
            </Card>
          </div>
        )}

        {activeView === 'assigned_bills' && (
          <Card>
            <CardHeader className="gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>
                  {assignedBillsLabel} ({filteredDueBills.length})
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {selectedBillsLabel}: {selectedDueBillIds.length}
                  </Badge>
                  <Button
                    size="sm"
                    onClick={markSelectedBillsCollectToday}
                    disabled={selectedDueBillIds.length === 0}
                  >
                    {markCollectTodayLabel}
                  </Button>
                  {collectTodayQueueIds.length > 0 && (
                    <Button size="sm" variant="outline" onClick={clearTodayQueue}>
                      {clearQueueLabel}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredDueBills.length === 0 ? (
                <p className="text-sm text-slate-500">{copy.noUnpaidInvoices}</p>
              ) : (
                <div className="space-y-4">
                  {filteredDueBills.map((bill) => {
                    const linkedCustomer = findCustomerForInvoice(bill);
                    const linkedProfile = linkedCustomer
                      ? findCustomerProfile(linkedCustomer.id, linkedCustomer.customerCode)
                      : findCustomerProfile(getInvoiceCustomerId(bill), getInvoiceCustomerCode(bill));
                    const mapLocationLink =
                      resolveMapLocationLink(linkedProfile, linkedCustomer, bill.customer) ||
                      getAddressMapSearchLink(
                        getPreferredAddress(linkedCustomer) || getPreferredAddress(bill.customer),
                      );
                    const collectionStatus = getCollectionStatusForInvoice(bill);
                    const displayName = linkedCustomer
                      ? getCustomerDisplayName(linkedCustomer, copy.unknownCustomer)
                      : getCustomerDisplayName(
                          {
                            personalName: bill.customer?.personalName,
                            companyName: bill.customer?.companyName,
                          },
                          copy.unknownCustomer,
                        );

                    const selectionOrder = getSelectedDueBillOrder(bill.id);

                    return (
                      <div key={bill.id} className="space-y-3 rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              className={`mt-0.5 flex h-7 w-7 min-h-7 min-w-7 shrink-0 items-center justify-center rounded-md border-2 text-xs font-bold leading-none transition-colors ${
                                selectionOrder
                                  ? 'border-blue-700 bg-blue-700 text-white shadow-sm'
                                  : 'border-slate-400 bg-white text-slate-600 hover:border-blue-500 hover:text-blue-700'
                              }`}
                              onClick={() =>
                                toggleDueBillSelection(
                                  bill.id,
                                  !selectedDueBillIds.includes(bill.id),
                                )
                              }
                              aria-label={
                                selectionOrder
                                  ? `Selected as number ${selectionOrder}`
                                  : 'Select bill'
                              }
                            >
                              {selectionOrder ? String(selectionOrder) : ''}
                            </button>
                            <div>
                              <h3 className="text-lg font-medium">{displayName}</h3>
                              <p className="text-sm text-gray-500">
                                {copy.invoice}: {getInvoicePeriodLabel(bill)}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {isBillQueuedToday(bill.id) && (
                              <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                                {queuedTagLabel}
                              </Badge>
                            )}
                            <p className="text-sm text-gray-500">
                              {copy.due}: {formatDisplayDate(bill.dueDate, '-')}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="text-2xl font-bold text-green-600">
                            {formatMoney(bill.totalAmount, bill.currency || 'MMK')}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={bill.status === 'overdue' ? 'destructive' : 'secondary'}>
                              {getLocalizedInvoiceStatusLabel(bill.status, copy)}
                            </Badge>
                            <Badge
                              variant="secondary"
                              className={getCollectionWorkflowStatusClassName(collectionStatus)}
                            >
                              {getLocalizedCollectionStatusLabel(collectionStatus, copy)}
                            </Badge>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => setSelectedBillDetails(bill)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            {copy.details}
                          </Button>
                          <Button size="sm" className="flex-1" onClick={() => setSelectedCollectionInvoice(bill)}>
                            {copy.collectionFlow}
                          </Button>
                          {isBillQueuedToday(bill.id) && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => removeBillFromTodayQueue(bill.id)}
                            >
                              {removeFromQueueLabel}
                            </Button>
                          )}
                          {mapLocationLink ? (
                            <Button size="sm" variant="outline" asChild className="flex-1">
                              <a href={mapLocationLink} target="_blank" rel="noopener noreferrer">
                                <MapPin className="mr-2 h-4 w-4" />
                                {copy.viewMapLocation}
                              </a>
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" className="flex-1" disabled>
                              <MapPin className="mr-2 h-4 w-4" />
                              {copy.viewMapLocation}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeView === 'assigned_customers' && (
          <Card>
            <CardHeader>
              <CardTitle>
                {copy.assignedCustomers} ({filteredCustomers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredCustomers.length === 0 ? (
                <p className="text-sm text-slate-500">{copy.noCustomersAssigned}</p>
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
                      copy.noData;
                    const monthlyFee = customer.subscription?.plan?.monthlyFee;

                    return (
                      <div key={customer.id} className="space-y-3 rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-medium">
                              {getCustomerDisplayName(customer, copy.unknownCustomer)}
                            </h3>
                            <p className="text-sm text-gray-500">{packageName}</p>
                          </div>
                          <Badge variant={customer.status === 'enable' ? 'default' : 'secondary'}>
                            {getLocalizedCollectorStatusLabel(customer.status, copy)}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="text-lg font-bold">
                            {formatMoney(monthlyFee, customer.subscription?.plan?.currency || 'MMK')}
                            {copy.perMonth}
                          </div>
                          <div className="text-sm text-gray-500">
                            {copy.lastPayment}:{' '}
                            {lastInvoice?.paidAt ? formatDisplayDate(lastInvoice.paidAt, '-') : copy.none}
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => setSelectedCustomerDetails({ customer, lastInvoice })}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          {copy.viewDetails}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeView === 'collected_bills' && (
          <Card>
            <CardHeader>
              <CardTitle>
                {collectedBillsLabel} ({filteredCollectedBills.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredCollectedBills.length === 0 ? (
                <p className="text-sm text-slate-500">{noCollectedBillsMessage}</p>
              ) : (
                <div className="space-y-4">
                  {filteredCollectedBills.map((bill) => {
                    const linkedCustomer = findCustomerForInvoice(bill);
                    const linkedProfile = linkedCustomer
                      ? findCustomerProfile(linkedCustomer.id, linkedCustomer.customerCode)
                      : findCustomerProfile(getInvoiceCustomerId(bill), getInvoiceCustomerCode(bill));
                    const mapLocationLink =
                      resolveMapLocationLink(linkedProfile, linkedCustomer, bill.customer) ||
                      getAddressMapSearchLink(
                        getPreferredAddress(linkedCustomer) || getPreferredAddress(bill.customer),
                      );
                    const collectionStatus = getCollectionStatusForInvoice(bill);
                    const displayName = linkedCustomer
                      ? getCustomerDisplayName(linkedCustomer, copy.unknownCustomer)
                      : getCustomerDisplayName(
                          {
                            personalName: bill.customer?.personalName,
                            companyName: bill.customer?.companyName,
                          },
                          copy.unknownCustomer,
                        );

                    return (
                      <div key={bill.id} className="space-y-3 rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-medium">{displayName}</h3>
                            <p className="text-sm text-gray-500">
                              {copy.invoice}: {getInvoicePeriodLabel(bill)}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge variant={bill.status === 'paid' ? 'default' : 'secondary'}>
                              {getLocalizedInvoiceStatusLabel(bill.status, copy)}
                            </Badge>
                            <Badge
                              variant="secondary"
                              className={getCollectionWorkflowStatusClassName(collectionStatus)}
                            >
                              {getLocalizedCollectionStatusLabel(collectionStatus, copy)}
                            </Badge>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="text-2xl font-bold text-green-600">
                            {formatMoney(bill.totalAmount, bill.currency || 'MMK')}
                          </div>
                          <div className="text-sm text-gray-500">
                            {copy.due}: {formatDisplayDate(bill.dueDate, '-')}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => setSelectedBillDetails(bill)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            {copy.details}
                          </Button>
                          {bill.status !== 'paid' && (
                            <Button
                              size="sm"
                              className="flex-1"
                              onClick={() => setSelectedCollectionInvoice(bill)}
                            >
                              {copy.collectionFlow}
                            </Button>
                          )}
                          {mapLocationLink ? (
                            <Button size="sm" variant="outline" asChild className="flex-1">
                              <a href={mapLocationLink} target="_blank" rel="noopener noreferrer">
                                <MapPin className="mr-2 h-4 w-4" />
                                {copy.viewMapLocation}
                              </a>
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" className="flex-1" disabled>
                              <MapPin className="mr-2 h-4 w-4" />
                              {copy.viewMapLocation}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Dialog
          open={!!selectedCollectionInvoice}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedCollectionInvoice(null);
              setCollectionNote('');
              setIsPaymentDetailsOpen(false);
            }
          }}
        >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{copy.collectionWorkflow}</DialogTitle>
          </DialogHeader>
          {selectedCollectionInvoice && (
            <div className="space-y-4">
              {(() => {
                const callLink = getPhoneDialLink(selectedCollectionInvoice.customer?.primaryPhone);
                const selectedLinkedCustomer = findCustomerForInvoice(selectedCollectionInvoice);
                const selectedLinkedProfile = selectedLinkedCustomer
                  ? findCustomerProfile(selectedLinkedCustomer.id, selectedLinkedCustomer.customerCode)
                  : findCustomerProfile(
                      getInvoiceCustomerId(selectedCollectionInvoice),
                      getInvoiceCustomerCode(selectedCollectionInvoice),
                    );
                const mapLinkForCollectionFlow =
                  selectedCollectionResolvedMapLocationLink || selectedCollectionMapLocationLink;
                const selectedCollectionAddressMapLink = getAddressMapSearchLink(
                  getPreferredAddress(selectedLinkedCustomer) ||
                    getPreferredAddress(selectedCollectionInvoice.customer),
                );
                const selectedCollectionMapEmbedLink =
                  getGoogleMapEmbedLink(mapLinkForCollectionFlow) ||
                  getGoogleMapEmbedLink(selectedCollectionAddressMapLink);
                return (
                  <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label>{copy.customer}</Label>
                    <p className="font-medium">
                      {getCustomerDisplayName({
                        personalName: selectedCollectionInvoice.customer?.personalName,
                        companyName: selectedCollectionInvoice.customer?.companyName
                      }, copy.unknownCustomer)}
                    </p>
                  </div>
                  <div>
                    <Label>{copy.phone}</Label>
                    <p>{selectedCollectionInvoice.customer?.primaryPhone || '-'}</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  {callLink ? (
                    <Button asChild variant="outline">
                      <a href={callLink}>
                        <Phone className="mr-2 h-4 w-4" />
                        {copy.callCustomer}
                      </a>
                    </Button>
                  ) : (
                    <Button variant="outline" disabled>
                      <Phone className="mr-2 h-4 w-4" />
                      {copy.callCustomer}
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{copy.invoice}</Label>
                    <p className="font-mono">{selectedCollectionInvoice.invoiceNo || selectedCollectionInvoice.id}</p>
                    <p className="text-xs text-slate-500">{getInvoicePeriodLabel(selectedCollectionInvoice)}</p>
                  </div>
                  <div>
                    <Label>{copy.amount}</Label>
                    <p className="text-lg font-bold">
                      {formatMoney(selectedCollectionInvoice.totalAmount, selectedCollectionInvoice.currency || 'MMK')}
                    </p>
                  </div>
                </div>

                {selectedCollectionMapEmbedLink ? (
                  <div className="space-y-2">
                    <Label>{copy.viewMapLocation}</Label>
                    <div className="overflow-hidden rounded-md border">
                      <iframe
                        title="Collector customer map"
                        src={selectedCollectionMapEmbedLink}
                        className="h-72 w-full"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    </div>
                    {mapLinkForCollectionFlow || selectedCollectionAddressMapLink ? (
                      <div className="flex justify-end">
                        <Button variant="outline" asChild size="sm">
                          <a
                            href={mapLinkForCollectionFlow || selectedCollectionAddressMapLink || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <MapPin className="mr-2 h-4 w-4" />
                            {copy.viewMapLocation}
                          </a>
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : mapLinkForCollectionFlow || selectedCollectionAddressMapLink ? (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500">
                      {copy.mapLinkNotAvailable}
                    </p>
                    {isResolvingSelectedCollectionMapLink ? (
                      <p className="text-xs text-slate-500">Resolving map link...</p>
                    ) : null}
                    <div className="flex justify-end">
                      <Button variant="outline" asChild size="sm">
                        <a
                          href={mapLinkForCollectionFlow || selectedCollectionAddressMapLink || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MapPin className="mr-2 h-4 w-4" />
                          {copy.viewMapLocation}
                        </a>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">{copy.mapLinkNotAvailable}</p>
                )}

                <div className="rounded-md border bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{copy.currentCollectionStatus}</p>
                  <Badge
                    variant="secondary"
                    className={`mt-1 ${getCollectionWorkflowStatusClassName(selectedCollectionStatus)}`}
                  >
                    {selectedCollectionStatus === 'en_route' && !isCallCompleted
                      ? initiatedStatusLabel
                      : selectedCollectionStatus === 'en_route' && isCallCompleted && !isCollectJourneyStarted
                        ? calledStatusLabel
                        : getLocalizedCollectionStatusLabel(selectedCollectionStatus, copy)}
                  </Badge>
                </div>

                <div>
                  <Label>{copy.noteOptional}</Label>
                  <Input
                    value={collectionNote}
                    onChange={(event) => setCollectionNote(event.target.value)}
                    placeholder={copy.optionalNotePlaceholder}
                  />
                </div>

                <div className="space-y-2">
                  {(selectedCollectionStatus === 'idle' ||
                    selectedCollectionStatus === 'rescheduled') && (
                    <Button
                      className="w-full"
                      disabled={isUpdatingCollection || selectedCollectionInvoice.status === 'paid'}
                      onClick={handleStartCollection}
                    >
                      {startCollectionNowLabel}
                    </Button>
                  )}

                  {selectedCollectionStatus === 'en_route' && !isCallCompleted && (
                    <Button
                      className="w-full"
                      disabled={isUpdatingCollection || selectedCollectionInvoice.status === 'paid'}
                      onClick={handleCallCompleted}
                    >
                      {callCompletedButtonLabel}
                    </Button>
                  )}

                  {selectedCollectionStatus === 'en_route' && isCallCompleted && !isCollectJourneyStarted && (
                    <div className="grid gap-2 md:grid-cols-2">
                      <Button
                        variant="outline"
                        disabled={isUpdatingCollection}
                        onClick={handleChoosePayToAdmin}
                      >
                        {payToAdminLabel}
                      </Button>
                      <Button
                        disabled={isUpdatingCollection}
                        onClick={handleChooseCollectFromCustomer}
                      >
                        {collectFromCustomerLabel}
                      </Button>
                    </div>
                  )}

                  {selectedCollectionStatus === 'en_route' && isCollectJourneyStarted && (
                    <Button
                      className="w-full"
                      disabled={isUpdatingCollection || selectedCollectionInvoice.status === 'paid'}
                      onClick={handleMarkArrived}
                    >
                      {copy.markArrived}
                    </Button>
                  )}

                  {selectedCollectionStatus === 'arrived' && (
                    <div className="space-y-3 rounded-md border p-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>{paymentMethodLabel}</Label>
                          <Select
                            value={selectedPaymentMethod}
                            onValueChange={(value) => {
                              const nextMethod: CollectorPaymentMethod =
                                value === 'wallet' || value === 'account' ? value : 'cash';
                              if (!selectedCollectionInvoice) return;
                              setPaymentMethodByInvoiceId((prev) => ({
                                ...prev,
                                [selectedCollectionInvoice.id]: nextMethod,
                              }));
                              setPaymentAccountIdByInvoiceId((prev) => ({
                                ...prev,
                                [selectedCollectionInvoice.id]: '',
                              }));
                              if (nextMethod === 'cash') {
                                setIsPaymentDetailsOpen(false);
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={choosePaymentMethodLabel} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cash">{cashLabel}</SelectItem>
                              <SelectItem value="wallet">{walletLabel}</SelectItem>
                              <SelectItem value="account">{accountLabel}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {(selectedPaymentMethod === 'wallet' || selectedPaymentMethod === 'account') && (
                          <div className="space-y-2">
                            <Label>{paymentAccountLabel}</Label>
                            <Select
                              value={selectedPaymentAccountId}
                              onValueChange={(value) => {
                                if (!selectedCollectionInvoice) return;
                                setPaymentAccountIdByInvoiceId((prev) => ({
                                  ...prev,
                                  [selectedCollectionInvoice.id]: value,
                                }));
                                setIsPaymentDetailsOpen(true);
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={choosePaymentAccountLabel} />
                              </SelectTrigger>
                              <SelectContent>
                                {availablePaymentAccounts.length === 0 ? (
                                  <SelectItem value="__no_accounts__" disabled>
                                    {isLoadingPaymentAccounts ? copy.loadingLabel || 'Loading...' : noPaymentAccountsLabel}
                                  </SelectItem>
                                ) : (
                                  availablePaymentAccounts.map((account) => (
                                    <SelectItem key={account.id} value={account.id}>
                                      {account.kind === 'wallet'
                                        ? `${account.walletType || walletLabel} - ${account.accountName} (${account.accountNumber})`
                                        : `${account.bankType || (copy.bankLabel || 'Bank')} - ${account.accountName} (${account.accountNumber})`}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>

                      {(selectedPaymentMethod === 'wallet' || selectedPaymentMethod === 'account') && selectedPaymentAccount && (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => setIsPaymentDetailsOpen(true)}
                        >
                          {showPaymentDetailsLabel}
                        </Button>
                      )}

                      {(selectedPaymentMethod === 'wallet' || selectedPaymentMethod === 'account') && (
                        <div className="space-y-2">
                          <Label>Payment Receipt / Slip</Label>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(event) => {
                              if (!selectedCollectionInvoice) return;
                              const file = event.target.files?.[0] ?? null;
                              setPaymentSlipFileByInvoiceId((prev) => ({
                                ...prev,
                                [selectedCollectionInvoice.id]: file,
                              }));
                              setPaymentSlipFileNameByInvoiceId((prev) => ({
                                ...prev,
                                [selectedCollectionInvoice.id]: file?.name ?? '',
                              }));
                            }}
                          />
                          {selectedPaymentSlipFileName ? (
                            <p className="text-xs text-slate-500">Selected: {selectedPaymentSlipFileName}</p>
                          ) : (
                            <p className="text-xs text-slate-500">
                              Upload payment receipt/slip image after customer pays.
                            </p>
                          )}
                        </div>
                      )}

                      <div className="grid gap-2 md:grid-cols-2">
                        <Button
                          variant="outline"
                          disabled={isUpdatingCollection}
                          onClick={() =>
                            applyCollectionAction(selectedCollectionInvoice, {
                              status: 'rescheduled',
                              type: 'rescheduled',
                              label: copy.rescheduledLabel,
                              title: copy.collectionRescheduled,
                            })
                          }
                        >
                          {copy.reschedule}
                        </Button>
                        <Button
                          disabled={isUpdatingCollection}
                          onClick={handleMarkCollected}
                        >
                          {copy.collected}
                        </Button>
                      </div>
                    </div>
                  )}

                  {selectedCollectionStatus === 'collected_pending_admin' && (
                    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      {copy.waitingAdminConfirmation}
                    </p>
                  )}

                  {selectedCollectionStatus === 'office_transfer' && (
                    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      {copy.waitingOfficePayment}
                    </p>
                  )}

                  {(selectedCollectionStatus === 'completed' || selectedCollectionInvoice.status === 'paid') && (
                    <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                      {copy.invoiceCompleted}
                    </p>
                  )}
                </div>

                <div className="space-y-2 rounded-md border p-3">
                  <p className="text-sm font-medium text-slate-700">{copy.collectionTimeline}</p>
                  {selectedCollectionTimeline.length === 0 ? (
                    <p className="text-sm text-slate-500">{copy.noCollectionUpdates}</p>
                  ) : (
                    <div className="max-h-44 space-y-2 overflow-y-auto">
                      {selectedCollectionTimeline
                        .slice()
                        .reverse()
                        .map((event) => (
                          <div key={event.id} className="rounded border bg-slate-50 p-2">
                            <p className="text-sm font-medium text-slate-800">{event.label}</p>
                            {event.note && (
                              <p className="text-xs text-slate-600">
                                {copy.note}: {event.note}
                              </p>
                            )}
                            <p className="text-xs text-slate-500">
                              {formatDateTime(event.timestamp)}
                              {event.actorName ? ` • ${event.actorName}` : ''}
                            </p>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
                  </>
                );
              })()}
            </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={isPaymentDetailsOpen} onOpenChange={setIsPaymentDetailsOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{paymentDetailsDialogTitle}</DialogTitle>
            </DialogHeader>
            {selectedPaymentAccount ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">{paymentTypeLabel}</p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {selectedPaymentAccount.kind === 'wallet' ? walletLabel : accountLabel}
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
                      <p className="text-xs text-slate-500">{paymentProviderLabel}</p>
                      <p className="font-medium text-slate-900">
                        {selectedPaymentAccount.kind === 'wallet'
                          ? selectedPaymentAccount.walletType || notAvailableLabel
                          : selectedPaymentAccount.bankType || notAvailableLabel}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">{accountNameLabel}</p>
                      <p className="text-base font-semibold text-slate-900">{selectedPaymentAccount.accountName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">{accountNumberLabel}</p>
                      <p className="text-lg font-bold tracking-wide text-slate-900">{selectedPaymentAccount.accountNumber}</p>
                    </div>
                  </div>

                  {selectedPaymentAccount.qrCodeDataUrl ? (
                    <div className="mt-4 rounded-lg border bg-white p-3">
                      <p className="mb-2 text-xs text-slate-500">{qrCodeLabel}</p>
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
                    onClick={() => copyPaymentText(selectedPaymentAccount.accountName, accountNameLabel)}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    {accountNameLabel}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => copyPaymentText(selectedPaymentAccount.accountNumber, accountNumberLabel)}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    {accountNumberLabel}
                  </Button>
                </div>

                <Button type="button" onClick={() => setIsPaymentDetailsOpen(false)}>
                  {closeLabel}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-slate-500">{noPaymentAccountsLabel}</p>
            )}
          </DialogContent>
        </Dialog>


        <Dialog open={!!selectedBillDetails} onOpenChange={(open) => !open && setSelectedBillDetails(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{copy.invoiceDetails}</DialogTitle>
            </DialogHeader>
            {selectedBillDetails && (
              <div className="space-y-4">
                {(() => {
                  const selectedLinkedCustomer = findCustomerForInvoice(selectedBillDetails);
                  const selectedLinkedProfile = selectedLinkedCustomer
                    ? findCustomerProfile(selectedLinkedCustomer.id, selectedLinkedCustomer.customerCode)
                    : findCustomerProfile(
                        getInvoiceCustomerId(selectedBillDetails),
                        getInvoiceCustomerCode(selectedBillDetails),
                      );
                  const selectedBillMapLocationLink =
                    resolveMapLocationLink(
                      selectedLinkedProfile,
                      selectedLinkedCustomer,
                      selectedBillDetails.customer,
                    ) ||
                    getAddressMapSearchLink(
                      getPreferredAddress(selectedLinkedCustomer) ||
                        getPreferredAddress(selectedBillDetails.customer),
                    );
                  return (
                    <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">{copy.customerName}</Label>
                    <p className="font-medium">
                      {getCustomerDisplayName({
                        personalName: selectedBillDetails.customer?.personalName,
                        companyName: selectedBillDetails.customer?.companyName
                      }, copy.unknownCustomer)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">{copy.invoiceId}</Label>
                    <p className="font-mono text-sm">{selectedBillDetails.invoiceNo || selectedBillDetails.id}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">{copy.billingPeriod}</Label>
                    <p>{getInvoicePeriodLabel(selectedBillDetails)}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">{copy.dueDate}</Label>
                    <p>{formatDisplayDate(selectedBillDetails.dueDate, '-')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">{copy.amount}</Label>
                    <p className="text-2xl font-bold text-green-600">
                      {formatMoney(selectedBillDetails.totalAmount, selectedBillDetails.currency || 'MMK')}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">{copy.status}</Label>
                    <Badge variant={selectedBillDetails.status === 'overdue' ? 'destructive' : 'secondary'}>
                      {getLocalizedInvoiceStatusLabel(selectedBillDetails.status, copy)}
                    </Badge>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-500">{copy.customerContact}</Label>
                  <div className="mt-1 flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span>{selectedBillDetails.customer?.primaryPhone || '-'}</span>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-500">{copy.address}</Label>
                  <div className="mt-1 flex items-start space-x-2">
                    <MapPin className="mt-0.5 h-4 w-4 text-gray-400" />
                    <span className="text-sm">{getPreferredAddress(selectedBillDetails.customer) || '-'}</span>
                  </div>
                </div>

                {selectedBillMapLocationLink ? (
                  <Button variant="outline" asChild className="w-full">
                    <a href={selectedBillMapLocationLink} target="_blank" rel="noopener noreferrer">
                      <MapPin className="mr-2 h-4 w-4" />
                      {copy.viewMapLocation}
                    </a>
                  </Button>
                ) : (
                  <p className="text-xs text-slate-500">{copy.mapLinkNotAvailable}</p>
                )}

                {selectedBillDetails.status !== 'paid' && (
                  <Button
                    onClick={() => {
                      setSelectedCollectionInvoice(selectedBillDetails);
                      setSelectedBillDetails(null);
                    }}
                    className="w-full"
                  >
                    {copy.openCollectionWorkflow}
                  </Button>
                )}
                    </>
                  );
                })()}
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
              <DialogTitle>{copy.customerDetails}</DialogTitle>
            </DialogHeader>
            {selectedCustomerDetails && (
              <div className="space-y-4">
                {(() => {
                  const selectedCustomerProfile = findCustomerProfile(
                    selectedCustomerDetails.customer.id,
                    selectedCustomerDetails.customer.customerCode,
                  );
                  const selectedCustomerMapLocationLink =
                    resolveMapLocationLink(selectedCustomerProfile, selectedCustomerDetails.customer) ||
                    getAddressMapSearchLink(getPreferredAddress(selectedCustomerDetails.customer));
                  return (
                    <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">{copy.customerName}</Label>
                    <p className="font-medium">
                      {getCustomerDisplayName(selectedCustomerDetails.customer, copy.unknownCustomer)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">{copy.customerCode}</Label>
                    <p className="font-mono text-sm">
                      {selectedCustomerDetails.customer.customerCode || selectedCustomerDetails.customer.id}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">{copy.package}</Label>
                    <p>
                      {selectedCustomerDetails.customer.subscription?.plan?.planName ||
                        selectedCustomerDetails.customer.subscription?.plan?.planCode ||
                        copy.noData}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">{copy.monthlyFee}</Label>
                    <p className="text-lg font-bold">
                      {formatMoney(
                        selectedCustomerDetails.customer.subscription?.plan?.monthlyFee,
                        selectedCustomerDetails.customer.subscription?.plan?.currency || 'MMK'
                      )}
                    </p>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-500">{copy.phoneNumber}</Label>
                  <div className="mt-1 flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span>{selectedCustomerDetails.customer.primaryPhone || '-'}</span>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-500">{copy.address}</Label>
                  <div className="mt-1 flex items-start space-x-2">
                    <MapPin className="mt-0.5 h-4 w-4 text-gray-400" />
                    <span className="text-sm">{getPreferredAddress(selectedCustomerDetails.customer) || '-'}</span>
                  </div>
                </div>

                {selectedCustomerMapLocationLink ? (
                  <Button variant="outline" asChild className="w-full">
                    <a href={selectedCustomerMapLocationLink} target="_blank" rel="noopener noreferrer">
                      <MapPin className="mr-2 h-4 w-4" />
                      {copy.viewMapLocation}
                    </a>
                  </Button>
                ) : (
                  <p className="text-xs text-slate-500">{copy.mapLinkNotAvailable}</p>
                )}

                <div>
                  <Label className="text-sm font-medium text-gray-500">{copy.lastPayment}</Label>
                  <p className="text-sm">
                    {selectedCustomerDetails.lastInvoice?.paidAt
                      ? `${formatDisplayDate(selectedCustomerDetails.lastInvoice.paidAt, '-')} - ${formatMoney(
                          selectedCustomerDetails.lastInvoice.totalAmount,
                          selectedCustomerDetails.lastInvoice.currency || 'MMK'
                        )}`
                      : copy.noPaymentYet}
                  </p>
                </div>
                    </>
                  );
                })()}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
