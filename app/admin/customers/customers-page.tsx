'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar as DateCalendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Search, Edit, Phone, MapPin, FilePlus2, Plus, Minus, Trash2, CalendarDays } from 'lucide-react';
import { useData, Customer } from '../../contexts/data-context';
import { useAuth } from '../../contexts/auth-context';
import Layout from '../../components/layout';
import { useRouter } from 'next/navigation';
import nrcData from '@/lib/nrc-data.json';
import townshipData from '@/lib/township.json';
import { useToast } from '@/hooks/use-toast';
import {
  DEFAULT_FIXED_BILLING_WINDOW,
  FirstInvoiceMode,
  FixedBillingWindow,
  getFixedBillingWindow
} from '@/lib/billing-config';
import { formatDisplayDate, formatDisplayDateRange } from '@/lib/date-format';
import { appendActivityLog } from '@/lib/activity-log';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
const CUSTOMER_CREATE_DRAFT_STORAGE_KEY = 'billpro_customer_create_draft_v1';
const CUSTOMER_LIST_DRAFTS_STORAGE_KEY = 'billpro_customer_list_drafts_v1';
const CONTINUE_DRAFT_SESSION_KEY = 'billpro_customer_continue_draft_v1';
const POST_CREATE_INVOICE_PROMPT_SESSION_KEY = 'billpro_post_create_invoice_prompt_customer_v1';
const CUSTOMER_BILLING_FEE_CACHE_STORAGE_KEY = 'billpro_customer_billing_fee_cache_v1';

type SelectOption = { value: string; label: string };
type PlanOption = {
  id: string;
  planCode: string;
  planName: string;
  bandwidthPlan?: string | null;
  monthlyFee?: number | string;
  currency?: string;
  isActive?: boolean;
};

type BillingRule = {
  id: string;
  name: string;
  billingModel: 'recurring' | 'usage';
  billingType: 'fixed' | 'anniversary';
  billingMode: string;
  fixedBillingDay?: string;
  dueAfterDays?: string;
  customMonths?: string;
  isActive: boolean;
  version: number;
};

type AdjustmentType = 'plus' | 'minus';
type AdjustmentValueType = 'fixed' | 'percent';

type InvoiceAdjustmentInput = {
  description: string;
  type: AdjustmentType;
  valueType: AdjustmentValueType;
  value: string;
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

type GeneratedInvoice = {
  id: string;
  invoiceNo?: string | null;
  invoiceType?: string | null;
  invoiceDate?: string | null;
  billingPeriodFrom?: string | null;
  billingPeriodTo?: string | null;
  dueDate?: string | null;
  status?: 'paid' | 'unpaid' | 'overdue' | 'cancelled';
  paymentMethod?: string | null;
  receiptNo?: string | null;
  paidAt?: string | null;
  currency?: string;
  monthlyFee?: string | number | null;
  installationFee?: string | number | null;
  additionalFees?: string | number | null;
  subtotalAmount?: string | number | null;
  plusAmount?: string | number | null;
  minusAmount?: string | number | null;
  totalAmount?: string | number | null;
  customer?: {
    id?: string;
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
    } | null;
  } | null;
  adjustments?: Array<{
    id?: string;
    description?: string | null;
    type?: AdjustmentType;
    valueType?: AdjustmentValueType;
    value?: string | number | null;
    amount?: string | number | null;
  }>;
};

type CustomerCreateDraft = {
  draftId: string;
  savedAt: string;
  customerType: 'individual' | 'business';
  userStatus: 'enable' | 'disable' | 'takeoff';
  newCustomer: {
    name: string;
    phone: string;
    address: string;
    package: string;
    monthlyFee: number;
    status: 'active' | 'inactive';
    collectorId: string;
    joinDate: string;
  };
  nrcState: string;
  nrcTownship: string;
  nrcType: string;
  nrcNumber: string;
  companyName: string;
  businessRegNo: string;
  taxId: string;
  contactPerson: string;
  contactNrcState: string;
  contactNrcTownship: string;
  contactNrcType: string;
  contactNrcNumber: string;
  primaryPhone: string;
  secondaryPhone: string;
  contactEmail: string;
  installationRegion: string;
  installationDistrict: string;
  installationTownship: string;
  installationCity: string;
  installationWard: string;
  installationPostalCode: string;
  installationStreet: string;
  installationBuilding: string;
  installationMapLink: string;
  billingSameAsInstallation: 'yes' | 'no';
  billingRegion: string;
  billingDistrict: string;
  billingTownship: string;
  billingCity: string;
  billingWard: string;
  billingPostalCode: string;
  billingStreet: string;
  billingBuilding: string;
  billingMapLink: string;
  serviceId: string;
  serviceType: string;
  packageName: string;
  selectedPlanCode: string;
  bandwidthPlan: string;
  serviceStartDate: string;
  contractStartDate: string;
  contractEndDate: string;
  installationDate: string;
  ipType: string;
  staticIpAddress: string;
  routerId: string;
  macAddress: string;
  onuSerial: string;
  vlanPort: string;
  networkZone: string;
  billingCycle: string;
  customBillingMonths: string;
  installationFee: string;
  additionalFees: string;
  collectionService: 'yes' | 'no';
  collectionFee: string;
  discountApplied: 'yes' | 'no';
  discountAmount: string;
  discountPeriod: string;
};

type CustomerListRow = Customer & {
  code?: string;
  isDraft?: boolean;
  draftId?: string;
  customerType?: 'individual' | 'business';
};

type CustomerBillingFeeCache = {
  monthlySubscriptionFee: number;
  installationFee: number;
  additionalFees: number;
  discountApplied: 'yes' | 'no';
  discountAmount: number;
  discountPeriod: string;
  collectionService?: 'yes' | 'no';
  collectionFee?: number;
  updatedAt: string;
};

type BillingFeeCacheLookupInput = {
  customerId?: string | null;
  customerCode?: string | null;
  customerPhone?: string | null;
};

const createDefaultNewCustomer = () => ({
  name: '',
  phone: '',
  address: '',
  package: '',
  monthlyFee: 0,
  status: 'active' as const,
  collectorId: '',
  joinDate: new Date().toISOString().split('T')[0]
});

const createDraftId = () =>
  `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const toNumber = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeCollectionServiceValue = (value: unknown): 'yes' | 'no' | null => {
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (['yes', 'true', '1', 'enable', 'enabled', 'active', 'on'].includes(normalized)) {
    return 'yes';
  }
  if (['no', 'false', '0', 'disable', 'disabled', 'off'].includes(normalized)) {
    return 'no';
  }
  return null;
};

const normalizePhoneCacheKey = (value: string | null | undefined) =>
  String(value || '')
    .replace(/\D/g, '')
    .trim();

const sanitizeDateInput = (value: string) =>
  value.replace(/[^\d/]/g, '').slice(0, 10);

const formatIsoDateForInput = (value: string) => {
  if (!value) return '';
  const trimmed = value.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${day}/${month}/${year}`;
  }
  const ddMmMatch = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (ddMmMatch) {
    const [, day, month, year] = ddMmMatch;
    return `${day}/${month}/${year}`;
  }
  return trimmed;
};

const parseDdMmYyyyToIso = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const match = trimmed.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (!match) return null;
  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  if (
    !Number.isInteger(day) ||
    !Number.isInteger(month) ||
    !Number.isInteger(year) ||
    day < 1 ||
    month < 1 ||
    month > 12 ||
    year < 1900
  ) {
    return null;
  }
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() + 1 !== month ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }
  return `${yearText}-${monthText}-${dayText}`;
};

const formatDateToIso = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDdMmYyyyToDate = (value: string) => {
  const iso = parseDdMmYyyyToIso(value);
  if (!iso) return undefined;
  const [yearText, monthText, dayText] = iso.split('-');
  const year = Number.parseInt(yearText ?? '', 10);
  const month = Number.parseInt(monthText ?? '', 10);
  const day = Number.parseInt(dayText ?? '', 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return undefined;
  }
  return new Date(year, month - 1, day);
};

const formatMoney = (value: string | number | null | undefined, currency = 'MMK') =>
  `${toNumber(value).toLocaleString()} ${currency}`;

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

const parseIsoDateOnly = (value?: string | null) => {
  if (!value) return null;
  const match = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1) return null;
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

const daysBetweenInclusive = (start: Date, end: Date) => {
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  const diff = Math.floor((endUtc - startUtc) / (1000 * 60 * 60 * 24)) + 1;
  return diff > 0 ? diff : 1;
};

const dateAtDay = (year: number, monthIndex: number, day: number) => {
  const firstDayOfMonth = new Date(year, monthIndex, 1);
  const monthDays = new Date(firstDayOfMonth.getFullYear(), firstDayOfMonth.getMonth() + 1, 0).getDate();
  const safeDay = Math.min(Math.max(day, 1), monthDays);
  return new Date(firstDayOfMonth.getFullYear(), firstDayOfMonth.getMonth(), safeDay);
};

const getNextFixedCycleStartDate = (anchor: Date, fixedStartDay: number) => {
  const current = dateAtDay(anchor.getFullYear(), anchor.getMonth(), fixedStartDay);
  if (current > anchor) return current;
  return dateAtDay(anchor.getFullYear(), anchor.getMonth() + 1, fixedStartDay);
};

const inferCustomMonthsFromRuleName = (ruleName?: string | null) => {
  if (!ruleName) return null;
  const match = ruleName.match(/(\d+)\s*month/i);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder,
  id,
  disabled = false
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder: string;
  id: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const filtered = options.filter((option) =>
    option.label.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <Select
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      onOpenChange={(open) => {
        if (!open) {
          setQuery('');
          return;
        }
        setTimeout(() => {
          inputRef.current?.focus();
        }, 0);
      }}
    >
      <SelectTrigger id={id}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <div className="p-2">
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            className="h-8"
            autoFocus
            disabled={disabled}
            onKeyDown={(event) => event.stopPropagation()}
            onKeyDownCapture={(event) => event.stopPropagation()}
            onKeyUp={(event) => event.stopPropagation()}
            onKeyUpCapture={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          />
        </div>
        {filtered.length === 0 ? (
          <div className="px-3 py-2 text-xs text-slate-500">No results</div>
        ) : (
          filtered.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}

type CustomersPageProps = {
  openNew?: boolean;
  inlineForm?: boolean;
  listPath?: string;
};

export default function CustomersPage({
  openNew = false,
  inlineForm = false,
  listPath = '/admin/customers/customer-list'
}: CustomersPageProps) {
  const { addCustomer, updateCustomer } = useData();
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [remoteCustomers, setRemoteCustomers] = useState<Customer[]>([]);
  const [customerSummaryById, setCustomerSummaryById] = useState<Record<string, any>>({});
  const [customerProfileById, setCustomerProfileById] = useState<Record<string, any>>({});
  const [customerBillingFeeCacheById, setCustomerBillingFeeCacheById] = useState<
    Record<string, CustomerBillingFeeCache>
  >({});
  const [hasFetchedCustomers, setHasFetchedCustomers] = useState(false);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersError, setCustomersError] = useState('');
  const [remoteCollectors, setRemoteCollectors] = useState<Array<{ id: string; name: string; code?: string }>>([]);
  const [hasFetchedCollectors, setHasFetchedCollectors] = useState(false);
  const [collectorsLoading, setCollectorsLoading] = useState(false);
  const [collectorsError, setCollectorsError] = useState('');
  const [customerTypeById, setCustomerTypeById] = useState<Record<string, 'individual' | 'business'>>({});
  const [customerTypeFilter, setCustomerTypeFilter] = useState<'all' | 'individual' | 'business'>('all');
  const [customerListView, setCustomerListView] = useState<'customers' | 'drafts'>('customers');
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [isUpdatingCustomer, setIsUpdatingCustomer] = useState(false);
  const [manualInvoicePromptOpen, setManualInvoicePromptOpen] = useState(false);
  const [manualInvoiceCustomerId, setManualInvoiceCustomerId] = useState<string | null>(null);
  const [postCreateInvoicePromptOpen, setPostCreateInvoicePromptOpen] = useState(false);
  const [postCreateInvoiceCustomerId, setPostCreateInvoiceCustomerId] = useState<string | null>(null);
  const [manualInvoiceAdjustmentRows, setManualInvoiceAdjustmentRows] = useState<InvoiceAdjustmentInput[]>([]);
  const [globalAdjustments, setGlobalAdjustments] = useState<GlobalAdjustmentOption[]>([]);
  const [globalAdjustmentsLoading, setGlobalAdjustmentsLoading] = useState(false);
  const [globalAdjustmentsError, setGlobalAdjustmentsError] = useState('');
  const [selectedGlobalAdjustmentIds, setSelectedGlobalAdjustmentIds] = useState<string[]>([]);
  const [generatedInvoicePreview, setGeneratedInvoicePreview] = useState<GeneratedInvoice | null>(null);
  const [generatedInvoiceDialogOpen, setGeneratedInvoiceDialogOpen] = useState(false);
  const [latestInvoiceByCustomerId, setLatestInvoiceByCustomerId] = useState<Record<string, GeneratedInvoice>>({});
  const [generatedInvoicePaymentMethod, setGeneratedInvoicePaymentMethod] = useState('KBZPay');
  const [generatedInvoiceReceiptNo, setGeneratedInvoiceReceiptNo] = useState('');
  const [isMarkingGeneratedInvoicePaid, setIsMarkingGeneratedInvoicePaid] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<Record<string, boolean>>({});
  const [isAssigningCollector, setIsAssigningCollector] = useState<Record<string, boolean>>({});
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState<Record<string, boolean>>({});
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [billingRules, setBillingRules] = useState<BillingRule[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [billingRulesLoading, setBillingRulesLoading] = useState(false);
  const [plansError, setPlansError] = useState('');
  const [billingRulesError, setBillingRulesError] = useState('');
  const [selectedPlanCode, setSelectedPlanCode] = useState('');
  const [manualInvoiceSelectedRuleId, setManualInvoiceSelectedRuleId] = useState('');
  const [customerType, setCustomerType] = useState<'individual' | 'business'>('individual');
  const [userStatus, setUserStatus] = useState<'enable' | 'disable' | 'takeoff'>('enable');
  const [nrcState, setNrcState] = useState('');
  const [nrcTownship, setNrcTownship] = useState('');
  const [nrcType, setNrcType] = useState('');
  const [nrcNumber, setNrcNumber] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [businessRegNo, setBusinessRegNo] = useState('');
  const [taxId, setTaxId] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactNrcState, setContactNrcState] = useState('');
  const [contactNrcTownship, setContactNrcTownship] = useState('');
  const [contactNrcType, setContactNrcType] = useState('');
  const [contactNrcNumber, setContactNrcNumber] = useState('');
  const [primaryPhone, setPrimaryPhone] = useState('');
  const [secondaryPhone, setSecondaryPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [installationRegion, setInstallationRegion] = useState('');
  const [installationDistrict, setInstallationDistrict] = useState('');
  const [installationTownship, setInstallationTownship] = useState('');
  const [installationCity, setInstallationCity] = useState('');
  const [installationWard, setInstallationWard] = useState('');
  const [installationPostalCode, setInstallationPostalCode] = useState('');
  const [installationStreet, setInstallationStreet] = useState('');
  const [installationBuilding, setInstallationBuilding] = useState('');
  const [installationMapLink, setInstallationMapLink] = useState('');
  const [billingSameAsInstallation, setBillingSameAsInstallation] = useState<'yes' | 'no'>('yes');
  const [billingRegion, setBillingRegion] = useState('');
  const [billingDistrict, setBillingDistrict] = useState('');
  const [billingTownship, setBillingTownship] = useState('');
  const [billingCity, setBillingCity] = useState('');
  const [billingWard, setBillingWard] = useState('');
  const [billingPostalCode, setBillingPostalCode] = useState('');
  const [billingStreet, setBillingStreet] = useState('');
  const [billingBuilding, setBillingBuilding] = useState('');
  const [billingMapLink, setBillingMapLink] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [packageName, setPackageName] = useState('');
  const [bandwidthPlan, setBandwidthPlan] = useState('');
  const [serviceStartDate, setServiceStartDate] = useState('');
  const [serviceStartDateInput, setServiceStartDateInput] = useState('');
  const [contractStartDate, setContractStartDate] = useState('');
  const [contractStartDateInput, setContractStartDateInput] = useState('');
  const [contractEndDate, setContractEndDate] = useState('');
  const [contractEndDateInput, setContractEndDateInput] = useState('');
  const [installationDate, setInstallationDate] = useState('');
  const [installationDateInput, setInstallationDateInput] = useState('');
  const [ipType, setIpType] = useState('');
  const [staticIpAddress, setStaticIpAddress] = useState('');
  const [routerId, setRouterId] = useState('');
  const [macAddress, setMacAddress] = useState('');
  const [onuSerial, setOnuSerial] = useState('');
  const [vlanPort, setVlanPort] = useState('');
  const [networkZone, setNetworkZone] = useState('');
  const [billingCycle, setBillingCycle] = useState('Monthly');
  const [fixedBillingWindow, setFixedBillingWindow] = useState<FixedBillingWindow>(
    DEFAULT_FIXED_BILLING_WINDOW
  );
  const [customBillingMonths, setCustomBillingMonths] = useState('');
  const [installationFee, setInstallationFee] = useState('');
  const [additionalFees, setAdditionalFees] = useState('');
  const [collectionService, setCollectionService] = useState<'yes' | 'no'>('yes');
  const [collectionFee, setCollectionFee] = useState('');
  const [discountApplied, setDiscountApplied] = useState<'yes' | 'no'>('no');
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountPeriod, setDiscountPeriod] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newCustomer, setNewCustomer] = useState<{
    name: string;
    phone: string;
    address: string;
    package: string;
    monthlyFee: number;
    status: 'active' | 'inactive';
    collectorId: string;
    joinDate: string;
  }>(() => createDefaultNewCustomer());
  const [draftRestoredAt, setDraftRestoredAt] = useState<string | null>(null);
  const [activeDraftId, setActiveDraftId] = useState<string>(() => createDraftId());
  const [customerListDrafts, setCustomerListDrafts] = useState<CustomerCreateDraft[]>([]);

  const logAdminActivity = (
    action: string,
    description: string,
    targetType: string,
    targetId?: string,
    targetName?: string,
    metadata?: Record<string, unknown>
  ) => {
    appendActivityLog({
      module: 'customer',
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

  const clearFieldError = (field: string) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const { [field]: _removed, ...rest } = prev;
      return rest;
    });
  };

  useEffect(() => {
    setServiceStartDateInput(formatIsoDateForInput(serviceStartDate));
  }, [serviceStartDate]);

  useEffect(() => {
    setContractStartDateInput(formatIsoDateForInput(contractStartDate));
  }, [contractStartDate]);

  useEffect(() => {
    setContractEndDateInput(formatIsoDateForInput(contractEndDate));
  }, [contractEndDate]);

  useEffect(() => {
    setInstallationDateInput(formatIsoDateForInput(installationDate));
  }, [installationDate]);

  useEffect(() => {
    setCustomerBillingFeeCacheById(readCustomerBillingFeeCache());
  }, []);

  const readCustomerListDrafts = (): CustomerCreateDraft[] => {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(CUSTOMER_LIST_DRAFTS_STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((item): item is CustomerCreateDraft => Boolean(item && typeof item === 'object'))
        .map((item) => ({
          ...item,
          draftId:
            typeof item.draftId === 'string' && item.draftId.length > 0
              ? item.draftId
              : createDraftId()
        }));
    } catch {
      return [];
    }
  };

  const persistCustomerListDrafts = (drafts: CustomerCreateDraft[]) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(CUSTOMER_LIST_DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
    setCustomerListDrafts(drafts);
  };

  const readCustomerBillingFeeCache = (): Record<string, CustomerBillingFeeCache> => {
    if (typeof window === 'undefined') return {};
    const raw = window.localStorage.getItem(CUSTOMER_BILLING_FEE_CACHE_STORAGE_KEY);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as Record<string, CustomerBillingFeeCache>;
      if (!parsed || typeof parsed !== 'object') return {};
      return parsed;
    } catch {
      return {};
    }
  };

  const persistCustomerBillingFeeCache = (cache: Record<string, CustomerBillingFeeCache>) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(CUSTOMER_BILLING_FEE_CACHE_STORAGE_KEY, JSON.stringify(cache));
    setCustomerBillingFeeCacheById(cache);
  };

  const resolveCustomerBillingFeeCache = ({
    customerId,
    customerCode,
    customerPhone
  }: BillingFeeCacheLookupInput): CustomerBillingFeeCache | null => {
    const normalizedId = String(customerId || '').trim();
    const normalizedCode = String(customerCode || '').trim();
    const normalizedPhone = normalizePhoneCacheKey(customerPhone);

    const lookupKeys = [
      normalizedId,
      normalizedId ? `id:${normalizedId}` : '',
      normalizedCode,
      normalizedCode ? `code:${normalizedCode}` : '',
      normalizedPhone,
      normalizedPhone ? `phone:${normalizedPhone}` : ''
    ].filter(Boolean);

    for (const key of lookupKeys) {
      const matched = customerBillingFeeCacheById[key];
      if (matched) return matched;
    }

    return null;
  };

  const upsertCustomerBillingFeeCache = (
    identifiers: BillingFeeCacheLookupInput,
    value: Omit<CustomerBillingFeeCache, 'updatedAt'>
  ) => {
    if (typeof window === 'undefined') return;
    const normalizedId = String(identifiers.customerId || '').trim();
    const normalizedCode = String(identifiers.customerCode || '').trim();
    const normalizedPhone = normalizePhoneCacheKey(identifiers.customerPhone);
    const targetKeys = [
      normalizedId,
      normalizedId ? `id:${normalizedId}` : '',
      normalizedCode,
      normalizedCode ? `code:${normalizedCode}` : '',
      normalizedPhone,
      normalizedPhone ? `phone:${normalizedPhone}` : ''
    ].filter(Boolean);
    if (targetKeys.length === 0) return;

    const current = readCustomerBillingFeeCache();
    const existingEntry = targetKeys
      .map((key) => current[key])
      .find((entry): entry is CustomerBillingFeeCache => Boolean(entry));
    const nextEntry: CustomerBillingFeeCache = {
      ...(existingEntry ?? {}),
      ...value,
      updatedAt: new Date().toISOString()
    };
    const next: Record<string, CustomerBillingFeeCache> = {
      ...current
    };
    targetKeys.forEach((key) => {
      next[key] = nextEntry;
    });
    persistCustomerBillingFeeCache(next);
  };

  const clearCustomerCreateDraft = () => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(CUSTOMER_CREATE_DRAFT_STORAGE_KEY);
    const nextDrafts = readCustomerListDrafts().filter((draft) => draft.draftId !== activeDraftId);
    persistCustomerListDrafts(nextDrafts);
    setDraftRestoredAt(null);
    setActiveDraftId(createDraftId());
  };

  const removeDraftById = (draftId: string) => {
    if (typeof window === 'undefined' || !draftId) return;

    const nextDrafts = readCustomerListDrafts().filter((draft) => draft.draftId !== draftId);
    persistCustomerListDrafts(nextDrafts);

    const activeDraftRaw = window.localStorage.getItem(CUSTOMER_CREATE_DRAFT_STORAGE_KEY);
    if (activeDraftRaw) {
      try {
        const parsed = JSON.parse(activeDraftRaw) as Partial<CustomerCreateDraft>;
        if (parsed?.draftId === draftId) {
          window.localStorage.removeItem(CUSTOMER_CREATE_DRAFT_STORAGE_KEY);
          setDraftRestoredAt(null);
          setActiveDraftId(createDraftId());
        }
      } catch {
        // ignore malformed draft payload
      }
    }
  };

  const clearAllDrafts = () => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(CUSTOMER_CREATE_DRAFT_STORAGE_KEY);
    window.localStorage.removeItem(CUSTOMER_LIST_DRAFTS_STORAGE_KEY);
    setCustomerListDrafts([]);
    setDraftRestoredAt(null);
    setActiveDraftId(createDraftId());
  };

  const townshipOptions = useMemo(() => {
    return nrcData.nrcTownships
      .filter((township) => township.stateCode === nrcState)
      .slice()
      .sort((a, b) => a.name.en.localeCompare(b.name.en));
  }, [nrcState]);
  const contactTownshipOptions = useMemo(() => {
    return nrcData.nrcTownships
      .filter((township) => township.stateCode === contactNrcState)
      .slice()
      .sort((a, b) => a.name.en.localeCompare(b.name.en));
  }, [contactNrcState]);
  const typeOptions = nrcData.nrcTypes;
  const stateOptions = nrcData.nrcStates;
  const regionOptions = useMemo(() => Object.keys(townshipData).sort(), []);
  const installationDistrictOptions = useMemo(() => {
    if (!installationRegion) return [];
    return Object.keys(townshipData[installationRegion as keyof typeof townshipData]).sort();
  }, [installationRegion]);
  const installationDistrictTownshipMap = useMemo(() => {
    if (!installationRegion) return {} as Record<string, string[]>;
    return (
      (townshipData[installationRegion as keyof typeof townshipData] as Record<string, string[]>) ?? {}
    );
  }, [installationRegion]);
  const installationTownshipOptions = useMemo(() => {
    if (!installationRegion) return [];
    const list = installationDistrict
      ? installationDistrictTownshipMap?.[installationDistrict] ?? []
      : Object.values(installationDistrictTownshipMap).flatMap((items) => items);
    return Array.from(new Set(list)).sort();
  }, [installationRegion, installationDistrict, installationDistrictTownshipMap]);
  const installationTownshipToDistrictMap = useMemo(() => {
    const map: Record<string, string> = {};
    Object.entries(installationDistrictTownshipMap).forEach(([district, townships]) => {
      townships.forEach((township) => {
        if (!map[township]) {
          map[township] = district;
        }
      });
    });
    return map;
  }, [installationDistrictTownshipMap]);
  const billingDistrictOptions = useMemo(() => {
    if (!billingRegion) return [];
    return Object.keys(townshipData[billingRegion as keyof typeof townshipData]).sort();
  }, [billingRegion]);
  const billingDistrictTownshipMap = useMemo(() => {
    if (!billingRegion) return {} as Record<string, string[]>;
    return (townshipData[billingRegion as keyof typeof townshipData] as Record<string, string[]>) ?? {};
  }, [billingRegion]);
  const billingTownshipOptions = useMemo(() => {
    if (!billingRegion) return [];
    const list = billingDistrict
      ? billingDistrictTownshipMap?.[billingDistrict] ?? []
      : Object.values(billingDistrictTownshipMap).flatMap((items) => items);
    return Array.from(new Set(list)).sort();
  }, [billingRegion, billingDistrict, billingDistrictTownshipMap]);
  const billingTownshipToDistrictMap = useMemo(() => {
    const map: Record<string, string> = {};
    Object.entries(billingDistrictTownshipMap).forEach(([district, townships]) => {
      townships.forEach((township) => {
        if (!map[township]) {
          map[township] = district;
        }
      });
    });
    return map;
  }, [billingDistrictTownshipMap]);
  const activePlans = useMemo(
    () => plans.filter((plan) => plan.isActive !== false),
    [plans]
  );
  const activeBillingRules = useMemo(
    () => billingRules.filter((rule) => rule.isActive !== false),
    [billingRules]
  );
  const selectedManualInvoiceRule = useMemo(
    () => activeBillingRules.find((rule) => rule.id === manualInvoiceSelectedRuleId) ?? null,
    [activeBillingRules, manualInvoiceSelectedRuleId]
  );
  const serviceTypeOptions = ['Fiber', 'DSL', 'Wireless'];
  const ipTypeOptions = ['Static', 'Dynamic'];
  const activeGlobalAdjustments = useMemo(
    () => globalAdjustments.filter((item) => item.isActive),
    [globalAdjustments]
  );
  const userStatusOptions = [
    { value: 'enable', label: 'Enable' },
    { value: 'disable', label: 'Disable' },
    { value: 'takeoff', label: 'Take off' }
  ];
  const getGlobalAdjustmentKey = (item: GlobalAdjustmentOption, index: number) =>
    item.id ?? `idx-${index}`;

  const nrcStateOptions = useMemo<SelectOption[]>(
    () =>
      stateOptions.map((state) => ({
        value: state.number.en,
        label: `${state.number.en} - ${state.name.en}`
      })),
    [stateOptions]
  );
  const nrcTypeOptions = useMemo<SelectOption[]>(
    () => typeOptions.map((type) => ({ value: type.name.en, label: type.name.en })),
    [typeOptions]
  );
  const nrcTownshipOptions = useMemo<SelectOption[]>(
    () =>
      townshipOptions.map((option) => ({
        value: option.short.en,
        label: `${option.short.en} - ${option.name.en}`
      })),
    [townshipOptions]
  );
  const contactNrcTownshipSelectOptions = useMemo<SelectOption[]>(
    () =>
      contactTownshipOptions.map((option) => ({
        value: option.short.en,
        label: `${option.short.en} - ${option.name.en}`
      })),
    [contactTownshipOptions]
  );
  const regionSelectOptions = useMemo<SelectOption[]>(
    () => regionOptions.map((region) => ({ value: region, label: region })),
    [regionOptions]
  );
  const installationDistrictSelectOptions = useMemo<SelectOption[]>(
    () => installationDistrictOptions.map((district) => ({ value: district, label: district })),
    [installationDistrictOptions]
  );
  const installationTownshipSelectOptions = useMemo<SelectOption[]>(
    () => installationTownshipOptions.map((township) => ({ value: township, label: township })),
    [installationTownshipOptions]
  );
  const billingDistrictSelectOptions = useMemo<SelectOption[]>(
    () => billingDistrictOptions.map((district) => ({ value: district, label: district })),
    [billingDistrictOptions]
  );
  const billingTownshipSelectOptions = useMemo<SelectOption[]>(
    () => billingTownshipOptions.map((township) => ({ value: township, label: township })),
    [billingTownshipOptions]
  );
  const serviceTypeSelectOptions = useMemo<SelectOption[]>(
    () => serviceTypeOptions.map((option) => ({ value: option, label: option })),
    [serviceTypeOptions]
  );
  const serviceIdSelectOptions = useMemo<SelectOption[]>(
    () =>
      activePlans.map((plan) => ({
        value: plan.planCode,
        label: `${plan.planCode} • ${plan.planName}`
      })),
    [activePlans]
  );
  const packagePlanSelectOptions = useMemo<SelectOption[]>(
    () =>
      activePlans.map((plan) => ({
        value: plan.planCode,
        label: `${plan.planName} (${plan.planCode})`
      })),
    [activePlans]
  );
  const bandwidthSelectOptions = useMemo<SelectOption[]>(
    () => {
      const list = activePlans
        .map((plan) => plan.bandwidthPlan)
        .filter((value): value is string => Boolean(value));
      const unique = Array.from(new Set(list));
      return unique.map((option) => ({ value: option, label: option }));
    },
    [activePlans]
  );
  const ipTypeSelectOptions = useMemo<SelectOption[]>(
    () => ipTypeOptions.map((option) => ({ value: option, label: option })),
    [ipTypeOptions]
  );
  const userStatusSelectOptions = useMemo<SelectOption[]>(
    () => userStatusOptions,
    []
  );
  const collectorSelectOptions = useMemo<SelectOption[]>(
    () =>
      remoteCollectors.map((collector) => ({
        value: collector.code || collector.id,
        label: collector.code ? `${collector.name} (${collector.code})` : collector.name
      })),
    [remoteCollectors]
  );
  const collectorSelectOptionsWithUnassigned = useMemo<SelectOption[]>(
    () => [{ value: 'unassigned', label: 'Unassigned' }, ...collectorSelectOptions],
    [collectorSelectOptions]
  );
  const selectedPlan = useMemo(
    () => activePlans.find((plan) => plan.planCode === selectedPlanCode),
    [activePlans, selectedPlanCode]
  );

  const monthlyFee =
    selectedPlan?.monthlyFee !== undefined && selectedPlan?.monthlyFee !== null
      ? String(selectedPlan.monthlyFee)
      : '';

  useEffect(() => {
    if (billingCycle !== 'Custom') {
      setCustomBillingMonths('');
    }
  }, [billingCycle]);

  useEffect(() => {
    if (collectionService !== 'no') return;
    setCollectionFee('');
    setErrors((prev) => {
      if (!prev.collectionFee) return prev;
      const { collectionFee: _removed, ...rest } = prev;
      return rest;
    });
    setNewCustomer((prev) => {
      if (!prev.collectorId) return prev;
      return { ...prev, collectorId: '' };
    });
  }, [collectionService]);

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

    const syncDrafts = () => {
      setCustomerListDrafts(readCustomerListDrafts());
    };

    syncDrafts();
    window.addEventListener('storage', syncDrafts);
    window.addEventListener('focus', syncDrafts);

    return () => {
      window.removeEventListener('storage', syncDrafts);
      window.removeEventListener('focus', syncDrafts);
    };
  }, []);

  useEffect(() => {
    if (inlineForm || typeof window === 'undefined') return;
    const pendingCustomerId = window.sessionStorage.getItem(
      POST_CREATE_INVOICE_PROMPT_SESSION_KEY
    );
    if (!pendingCustomerId) return;
    window.sessionStorage.removeItem(POST_CREATE_INVOICE_PROMPT_SESSION_KEY);
    setPostCreateInvoiceCustomerId(pendingCustomerId);
    setPostCreateInvoicePromptOpen(true);
  }, [inlineForm]);

  useEffect(() => {
    if (!inlineForm || editingCustomer || typeof window === 'undefined') return;

    const continueDraftId = window.sessionStorage.getItem(CONTINUE_DRAFT_SESSION_KEY);
    window.sessionStorage.removeItem(CONTINUE_DRAFT_SESSION_KEY);
    if (!continueDraftId) {
      window.localStorage.removeItem(CUSTOMER_CREATE_DRAFT_STORAGE_KEY);
      setDraftRestoredAt(null);
      setActiveDraftId(createDraftId());
      return;
    }

    const selectedDraft = readCustomerListDrafts().find(
      (item) => item.draftId === continueDraftId
    );
    if (!selectedDraft) {
      window.localStorage.removeItem(CUSTOMER_CREATE_DRAFT_STORAGE_KEY);
      setDraftRestoredAt(null);
      setActiveDraftId(createDraftId());
      toast({
        title: 'Draft not found',
        description: 'Please select draft again from customer list.',
        variant: 'destructive'
      });
      return;
    }
    window.localStorage.setItem(
      CUSTOMER_CREATE_DRAFT_STORAGE_KEY,
      JSON.stringify(selectedDraft)
    );

    try {
      const draft = selectedDraft as Partial<CustomerCreateDraft>;
      if (!draft || typeof draft !== 'object') return;
      const restoredDraftId =
        typeof draft.draftId === 'string' && draft.draftId.trim().length > 0
          ? draft.draftId
          : createDraftId();
      setActiveDraftId(restoredDraftId);

      setCustomerType(draft.customerType === 'business' ? 'business' : 'individual');
      setUserStatus(
        draft.userStatus === 'disable' || draft.userStatus === 'takeoff' ? draft.userStatus : 'enable'
      );
      if (draft.newCustomer) {
        setNewCustomer({
          name: draft.newCustomer.name ?? '',
          phone: draft.newCustomer.phone ?? '',
          address: draft.newCustomer.address ?? '',
          package: draft.newCustomer.package ?? '',
          monthlyFee: Number(draft.newCustomer.monthlyFee ?? 0) || 0,
          status: draft.newCustomer.status === 'inactive' ? 'inactive' : 'active',
          collectorId: draft.newCustomer.collectorId ?? '',
          joinDate: draft.newCustomer.joinDate ?? createDefaultNewCustomer().joinDate
        });
      }
      setNrcState(draft.nrcState ?? '');
      setNrcTownship(draft.nrcTownship ?? '');
      setNrcType(draft.nrcType ?? '');
      setNrcNumber(draft.nrcNumber ?? '');
      setCompanyName(draft.companyName ?? '');
      setBusinessRegNo(draft.businessRegNo ?? '');
      setTaxId(draft.taxId ?? '');
      setContactPerson(draft.contactPerson ?? '');
      setContactNrcState(draft.contactNrcState ?? '');
      setContactNrcTownship(draft.contactNrcTownship ?? '');
      setContactNrcType(draft.contactNrcType ?? '');
      setContactNrcNumber(draft.contactNrcNumber ?? '');
      setPrimaryPhone(draft.primaryPhone ?? '');
      setSecondaryPhone(draft.secondaryPhone ?? '');
      setContactEmail(draft.contactEmail ?? '');
      setInstallationRegion(draft.installationRegion ?? '');
      setInstallationDistrict(draft.installationDistrict ?? '');
      setInstallationTownship(draft.installationTownship ?? '');
      setInstallationCity(draft.installationCity ?? '');
      setInstallationWard(draft.installationWard ?? '');
      setInstallationPostalCode(draft.installationPostalCode ?? '');
      setInstallationStreet(draft.installationStreet ?? '');
      setInstallationBuilding(draft.installationBuilding ?? '');
      setInstallationMapLink(draft.installationMapLink ?? '');
      setBillingSameAsInstallation(draft.billingSameAsInstallation === 'no' ? 'no' : 'yes');
      setBillingRegion(draft.billingRegion ?? '');
      setBillingDistrict(draft.billingDistrict ?? '');
      setBillingTownship(draft.billingTownship ?? '');
      setBillingCity(draft.billingCity ?? '');
      setBillingWard(draft.billingWard ?? '');
      setBillingPostalCode(draft.billingPostalCode ?? '');
      setBillingStreet(draft.billingStreet ?? '');
      setBillingBuilding(draft.billingBuilding ?? '');
      setBillingMapLink(draft.billingMapLink ?? '');
      setServiceId(draft.serviceId ?? '');
      setServiceType(draft.serviceType ?? '');
      setPackageName(draft.packageName ?? '');
      setSelectedPlanCode(draft.selectedPlanCode ?? '');
      setBandwidthPlan(draft.bandwidthPlan ?? '');
      setServiceStartDate(draft.serviceStartDate ?? '');
      setContractStartDate(draft.contractStartDate ?? '');
      setContractEndDate(draft.contractEndDate ?? '');
      setInstallationDate(draft.installationDate ?? '');
      setIpType(draft.ipType ?? '');
      setStaticIpAddress(draft.staticIpAddress ?? '');
      setRouterId(draft.routerId ?? '');
      setMacAddress(draft.macAddress ?? '');
      setOnuSerial(draft.onuSerial ?? '');
      setVlanPort(draft.vlanPort ?? '');
      setNetworkZone(draft.networkZone ?? '');
      setBillingCycle(draft.billingCycle ?? 'Monthly');
      setCustomBillingMonths(draft.customBillingMonths ?? '');
      setInstallationFee(draft.installationFee ?? '');
      setAdditionalFees(draft.additionalFees ?? '');
      setCollectionService(draft.collectionService === 'no' ? 'no' : 'yes');
      setCollectionFee(draft.collectionFee ?? '');
      setDiscountApplied(draft.discountApplied === 'yes' ? 'yes' : 'no');
      setDiscountAmount(draft.discountAmount ?? '');
      setDiscountPeriod(draft.discountPeriod ?? '');
      setDraftRestoredAt(draft.savedAt ?? new Date().toISOString());
      toast({
        title: 'Draft restored',
        description: 'Unfinished customer form has been restored.'
      });
    } catch {
      // ignore malformed draft data
    }
  }, [inlineForm, editingCustomer, toast]);

  useEffect(() => {
    if (!inlineForm || editingCustomer || typeof window === 'undefined') return;

    const timer = window.setTimeout(() => {
      const hasAnyInput = Boolean(
        newCustomer.name.trim() ||
          newCustomer.phone.trim() ||
          primaryPhone.trim() ||
          companyName.trim() ||
          nrcNumber.trim() ||
          contactEmail.trim() ||
          installationRegion.trim() ||
          installationDistrict.trim() ||
          installationTownship.trim() ||
          installationWard.trim() ||
          selectedPlanCode.trim() ||
          serviceStartDate.trim() ||
          contractStartDate.trim() ||
          contractEndDate.trim() ||
          installationDate.trim() ||
          collectionFee.trim()
      );

      if (!hasAnyInput) {
        window.localStorage.removeItem(CUSTOMER_CREATE_DRAFT_STORAGE_KEY);
        const nextDrafts = readCustomerListDrafts().filter((draft) => draft.draftId !== activeDraftId);
        persistCustomerListDrafts(nextDrafts);
        return;
      }

      const draft: CustomerCreateDraft = {
        draftId: activeDraftId,
        savedAt: new Date().toISOString(),
        customerType,
        userStatus,
        newCustomer,
        nrcState,
        nrcTownship,
        nrcType,
        nrcNumber,
        companyName,
        businessRegNo,
        taxId,
        contactPerson,
        contactNrcState,
        contactNrcTownship,
        contactNrcType,
        contactNrcNumber,
        primaryPhone,
        secondaryPhone,
        contactEmail,
        installationRegion,
        installationDistrict,
        installationTownship,
        installationCity,
        installationWard,
        installationPostalCode,
        installationStreet,
        installationBuilding,
        installationMapLink,
        billingSameAsInstallation,
        billingRegion,
        billingDistrict,
        billingTownship,
        billingCity,
        billingWard,
        billingPostalCode,
        billingStreet,
        billingBuilding,
        billingMapLink,
        serviceId,
        serviceType,
        packageName,
        selectedPlanCode,
        bandwidthPlan,
        serviceStartDate,
        contractStartDate,
        contractEndDate,
        installationDate,
        ipType,
        staticIpAddress,
        routerId,
        macAddress,
        onuSerial,
        vlanPort,
        networkZone,
        billingCycle,
        customBillingMonths,
        installationFee,
        additionalFees,
        collectionService,
        collectionFee,
        discountApplied,
        discountAmount,
        discountPeriod
      };
      window.localStorage.setItem(CUSTOMER_CREATE_DRAFT_STORAGE_KEY, JSON.stringify(draft));
      const existingDrafts = readCustomerListDrafts().filter(
        (item) => item.draftId !== draft.draftId
      );
      persistCustomerListDrafts([draft, ...existingDrafts]);
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    inlineForm,
    editingCustomer,
    customerType,
    userStatus,
    newCustomer,
    nrcState,
    nrcTownship,
    nrcType,
    nrcNumber,
    companyName,
    businessRegNo,
    taxId,
    contactPerson,
    contactNrcState,
    contactNrcTownship,
    contactNrcType,
    contactNrcNumber,
    primaryPhone,
    secondaryPhone,
    contactEmail,
    installationRegion,
    installationDistrict,
    installationTownship,
    installationCity,
    installationWard,
    installationPostalCode,
    installationStreet,
    installationBuilding,
    installationMapLink,
    billingSameAsInstallation,
    billingRegion,
    billingDistrict,
    billingTownship,
    billingCity,
    billingWard,
    billingPostalCode,
    billingStreet,
    billingBuilding,
    billingMapLink,
    serviceId,
    serviceType,
    packageName,
    selectedPlanCode,
    bandwidthPlan,
    serviceStartDate,
    contractStartDate,
    contractEndDate,
    installationDate,
    ipType,
    staticIpAddress,
    routerId,
    macAddress,
    onuSerial,
    vlanPort,
    networkZone,
    billingCycle,
    customBillingMonths,
    installationFee,
    additionalFees,
    collectionService,
    collectionFee,
    discountApplied,
    discountAmount,
    discountPeriod,
    activeDraftId
  ]);

  const formatAddress = (address: {
    building: string;
    street: string;
    ward: string;
    city: string;
    township: string;
    district: string;
    region: string;
    postalCode?: string;
  }) => {
    const base = [
      address.building,
      address.street,
      address.ward,
      address.city,
      address.township,
      address.district,
      address.region
    ]
      .filter((value) => value.trim())
      .join(', ');
    if (!address.postalCode?.trim()) {
      return base;
    }
    return base ? `${base}, ${address.postalCode}` : address.postalCode;
  };

  const parseNrcValue = (value: string | null | undefined) => {
    if (!value || typeof value !== 'string') {
      return { state: '', township: '', type: '', number: '' };
    }

    const cleaned = value.trim();
    const matched = cleaned.match(/^([^/]+)\/([^()]+)\(([^)]+)\)(.+)$/);
    if (!matched) {
      return { state: '', township: '', type: '', number: '' };
    }

    return {
      state: matched[1]?.trim() ?? '',
      township: matched[2]?.trim() ?? '',
      type: matched[3]?.trim() ?? '',
      number: matched[4]?.trim() ?? ''
    };
  };

  const parseAddressValue = (value: string | null | undefined) => {
    const fallback = {
      region: '',
      district: '',
      township: '',
      city: '',
      ward: '',
      street: '',
      building: '',
      postalCode: ''
    };

    if (!value || typeof value !== 'string') {
      return fallback;
    }

    const tokens = value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

    if (tokens.length === 0) {
      return fallback;
    }

    const working = [...tokens];
    let postalCode = '';
    const postalCandidate = working.at(-1) ?? '';
    if (/^\d{4,8}$/.test(postalCandidate)) {
      postalCode = postalCandidate;
      working.pop();
    }

    let region = '';
    for (let i = working.length - 1; i >= 0; i -= 1) {
      const candidate = working[i];
      if (regionOptions.includes(candidate)) {
        region = candidate;
        working.splice(i, 1);
        break;
      }
    }

    let district = '';
    if (region) {
      const districtList = Object.keys(
        townshipData[region as keyof typeof townshipData] ?? {}
      );
      for (let i = working.length - 1; i >= 0; i -= 1) {
        const candidate = working[i];
        if (districtList.includes(candidate)) {
          district = candidate;
          working.splice(i, 1);
          break;
        }
      }
    }

    let township = '';
    if (region && district) {
      const townshipList =
        ((townshipData[region as keyof typeof townshipData] as Record<string, string[]> | undefined)?.[
          district
        ] ?? []);
      for (let i = working.length - 1; i >= 0; i -= 1) {
        const candidate = working[i];
        if (townshipList.includes(candidate)) {
          township = candidate;
          working.splice(i, 1);
          break;
        }
      }
    }

    const localParts = [...working];
    const city = localParts.pop() ?? '';
    const ward = localParts.pop() ?? '';
    const street = localParts.pop() ?? '';
    const building = localParts.join(', ').trim();

    return {
      region,
      district,
      township,
      city,
      ward,
      street,
      building,
      postalCode
    };
  };

  const resolveBillingDayByMode = (mode: FirstInvoiceMode) => {
    if (mode === 'fixed') {
      return fixedBillingWindow.dueDay;
    }

    const baseDate = serviceStartDate || installationDate;
    if (!baseDate) {
      return fixedBillingWindow.dueDay;
    }

    const parsed = new Date(baseDate);
    if (Number.isNaN(parsed.getTime())) {
      return fixedBillingWindow.dueDay;
    }

    return parsed.getDate();
  };

  const normalizeStatus = (status: 'enable' | 'disable' | 'takeoff') =>
    status === 'enable' ? 'active' : 'inactive';

  const isCollectionServiceEnabledForCustomer = (customer: CustomerListRow) => {
    const summary = customerSummaryById[customer.id] ?? {};
    const explicit = normalizeCollectionServiceValue(
      summary?.collectionService ??
        summary?.collectionServiceEnabled ??
        summary?.billingInformation?.collectionService ??
        summary?.customer?.collectionService ??
        summary?.customer?.collectionServiceEnabled
    );
    if (explicit) {
      return explicit === 'yes';
    }

    const cached = resolveCustomerBillingFeeCache({
      customerId: customer.id,
      customerCode: String(customer.code ?? summary?.customerCode ?? '').trim(),
      customerPhone: customer.phone
    });
    if (cached?.collectionService) {
      return cached.collectionService === 'yes';
    }

    return true;
  };

  const toSelectStatus = (status: 'active' | 'inactive' | 'enable' | 'disable' | 'takeoff') => {
    if (status === 'enable') return 'enable';
    if (status === 'takeoff') return 'takeoff';
    return status === 'active' ? 'enable' : 'disable';
  };

  const updateRemoteCustomerStatus = (id: string, status: 'enable' | 'disable' | 'takeoff') => {
    setRemoteCustomers((prev) =>
      prev.map((customer) =>
        customer.id === id ? { ...customer, status: normalizeStatus(status) } : customer
      )
    );
  };

  const updateRemoteCustomerCollector = (id: string, collectorId: string) => {
    setRemoteCustomers((prev) =>
      prev.map((customer) =>
        customer.id === id ? { ...customer, collectorId } : customer
      )
    );
  };

  const draftRows = useMemo<CustomerListRow[]>(
    () =>
      customerListDrafts.map((draft, index) => {
        const draftName =
          draft.customerType === 'business'
            ? draft.companyName.trim()
            : draft.newCustomer.name.trim();
        const draftAddress = formatAddress({
          building: draft.installationBuilding ?? '',
          street: draft.installationStreet ?? '',
          ward: draft.installationWard ?? '',
          city: draft.installationCity ?? '',
          township: draft.installationTownship ?? '',
          district: draft.installationDistrict ?? '',
          region: draft.installationRegion ?? '',
          postalCode: draft.installationPostalCode ?? ''
        });
        const planFee =
          activePlans.find((plan) => plan.planCode === draft.selectedPlanCode)?.monthlyFee ?? 0;

        return {
          id: `draft-${draft.draftId}`,
          code: `DRAFT-${String(index + 1).padStart(3, '0')}`,
          name: draftName || 'Untitled Draft',
          phone: draft.primaryPhone || draft.newCustomer.phone || '—',
          address: draftAddress || '—',
          package: draft.selectedPlanCode || draft.packageName || '—',
          monthlyFee: toNumber(planFee),
          status: 'inactive',
          collectorId: draft.newCustomer.collectorId || '',
          joinDate: draft.savedAt,
          isDraft: true,
          draftId: draft.draftId,
          customerType: draft.customerType
        };
      }),
    [activePlans, customerListDrafts]
  );

  const liveRows = useMemo<CustomerListRow[]>(
    () =>
      hasFetchedCustomers
        ? remoteCustomers.map((customer) => ({
            ...customer,
            isDraft: false,
            customerType: customerTypeById[customer.id]
          }))
        : [],
    [customerTypeById, hasFetchedCustomers, remoteCustomers]
  );

  const customersSource = useMemo<CustomerListRow[]>(
    () => [...draftRows, ...liveRows],
    [draftRows, liveRows]
  );

  const filteredDraftRows = useMemo(
    () =>
      draftRows.filter((customer) => {
        const matchesSearch =
          customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          customer.phone.includes(searchTerm) ||
          customer.id.includes(searchTerm);
        const matchesStatus = true;
        const matchesType =
          customerTypeFilter === 'all' ? true : customer.customerType === customerTypeFilter;
        return matchesSearch && matchesStatus && matchesType;
      }),
    [customerTypeFilter, draftRows, searchTerm, selectedStatus]
  );

  const filteredLiveCustomers = useMemo(
    () =>
      liveRows.filter((customer) => {
        const matchesSearch =
          customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          customer.phone.includes(searchTerm) ||
          customer.id.includes(searchTerm);
        const matchesStatus = selectedStatus === 'all' || customer.status === selectedStatus;
        const typeValue = customerTypeById[customer.id];
        const matchesType = customerTypeFilter === 'all' ? true : typeValue === customerTypeFilter;
        return matchesSearch && matchesStatus && matchesType;
      }),
    [customerTypeById, customerTypeFilter, liveRows, searchTerm, selectedStatus]
  );
  const postCreatePromptCustomer = useMemo(
    () =>
      postCreateInvoiceCustomerId
        ? customersSource.find((customer) => customer.id === postCreateInvoiceCustomerId) ?? null
        : null,
    [customersSource, postCreateInvoiceCustomerId]
  );

  const handleStatusChange = async (id: string, status: 'enable' | 'disable' | 'takeoff') => {
    if (isUpdatingStatus[id]) return;
    setIsUpdatingStatus((prev) => ({ ...prev, [id]: true }));
    updateRemoteCustomerStatus(id, status);

    try {
      const response = await fetch(`${API_BASE_URL}/customers/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const message = data?.message ?? 'Failed to update status';
        console.error(message, data);
      } else {
        const customerName = customersSource.find((item) => item.id === id)?.name;
        logAdminActivity(
          'customer_status_changed',
          `Customer status changed to ${status}.`,
          'customer',
          id,
          customerName,
          { status }
        );
      }
    } catch (error) {
      console.error('Failed to update status', error);
    } finally {
      setIsUpdatingStatus((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleAssignCollector = async (customerId: string, collectorCode: string) => {
    if (isAssigningCollector[customerId]) return;
    setIsAssigningCollector((prev) => ({ ...prev, [customerId]: true }));
    const normalizedCollectorCode = collectorCode === 'unassigned' ? '' : collectorCode;
    updateRemoteCustomerCollector(customerId, normalizedCollectorCode);

    try {
      const response = await fetch(`${API_BASE_URL}/customers/${customerId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ collectorCode: normalizedCollectorCode || null })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const message = data?.message ?? 'Failed to assign collector';
        console.error(message, data);
      } else {
        const customerName = customersSource.find((item) => item.id === customerId)?.name;
        const collectorName =
          normalizedCollectorCode === ''
            ? 'Unassigned'
            : remoteCollectors.find((collector) => collector.code === normalizedCollectorCode)?.name ||
              normalizedCollectorCode;
        logAdminActivity(
          'customer_collector_assigned',
          normalizedCollectorCode
            ? 'Collector assigned to customer.'
            : 'Collector unassigned from customer.',
          'customer',
          customerId,
          customerName,
          { collectorCode: normalizedCollectorCode || null, collectorName }
        );
      }
    } catch (error) {
      console.error('Failed to assign collector', error);
    } finally {
      setIsAssigningCollector((prev) => ({ ...prev, [customerId]: false }));
    }
  };

  const handleContinueDraft = (draftId: string | undefined) => {
    if (!draftId || typeof window === 'undefined') return;
    const selectedDraft = readCustomerListDrafts().find((draft) => draft.draftId === draftId);
    if (!selectedDraft) {
      toast({
        title: 'Draft not found',
        description: 'This draft was removed or expired.',
        variant: 'destructive'
      });
      return;
    }
    window.sessionStorage.setItem(CONTINUE_DRAFT_SESSION_KEY, draftId);
    router.replace('/admin/customers/new-customer');
  };

  const closePostCreateInvoicePrompt = () => {
    setPostCreateInvoicePromptOpen(false);
    setPostCreateInvoiceCustomerId(null);
  };

  const handleCreateInvoiceAfterCustomerCreate = () => {
    if (!postCreateInvoiceCustomerId) {
      closePostCreateInvoicePrompt();
      return;
    }
    const nextCustomerId = postCreateInvoiceCustomerId;
    closePostCreateInvoicePrompt();
    openManualInvoicePrompt(nextCustomerId);
  };

  const handleClearDraftRow = (draftId: string | undefined) => {
    if (!draftId) return;
    removeDraftById(draftId);
    toast({
      title: 'Draft cleared',
      description: 'Selected draft has been removed.'
    });
  };

  const handleClearAllDraftRows = () => {
    if (customerListDrafts.length === 0) return;
    clearAllDrafts();
    toast({
      title: 'All drafts cleared',
      description: 'All customer drafts have been removed.'
    });
  };

  const saveDraftAndReturnToList = () => {
    if (typeof window === 'undefined') {
      router.replace(listPath);
      return;
    }
    const hasAnyInput = Boolean(
      newCustomer.name.trim() ||
        newCustomer.phone.trim() ||
        primaryPhone.trim() ||
        companyName.trim() ||
        nrcNumber.trim() ||
        contactEmail.trim() ||
        installationRegion.trim() ||
        installationDistrict.trim() ||
        installationTownship.trim() ||
        installationWard.trim() ||
        selectedPlanCode.trim() ||
        serviceStartDate.trim() ||
        contractStartDate.trim() ||
        contractEndDate.trim() ||
        installationDate.trim() ||
        collectionFee.trim()
    );

    if (hasAnyInput) {
      const immediateDraft: CustomerCreateDraft = {
        draftId: activeDraftId,
        savedAt: new Date().toISOString(),
        customerType,
        userStatus,
        newCustomer,
        nrcState,
        nrcTownship,
        nrcType,
        nrcNumber,
        companyName,
        businessRegNo,
        taxId,
        contactPerson,
        contactNrcState,
        contactNrcTownship,
        contactNrcType,
        contactNrcNumber,
        primaryPhone,
        secondaryPhone,
        contactEmail,
        installationRegion,
        installationDistrict,
        installationTownship,
        installationCity,
        installationWard,
        installationPostalCode,
        installationStreet,
        installationBuilding,
        installationMapLink,
        billingSameAsInstallation,
        billingRegion,
        billingDistrict,
        billingTownship,
        billingCity,
        billingWard,
        billingPostalCode,
        billingStreet,
        billingBuilding,
        billingMapLink,
        serviceId,
        serviceType,
        packageName,
        selectedPlanCode,
        bandwidthPlan,
        serviceStartDate,
        contractStartDate,
        contractEndDate,
        installationDate,
        ipType,
        staticIpAddress,
        routerId,
        macAddress,
        onuSerial,
        vlanPort,
        networkZone,
        billingCycle,
        customBillingMonths,
        installationFee,
        additionalFees,
        collectionService,
        collectionFee,
        discountApplied,
        discountAmount,
        discountPeriod
      };
      window.localStorage.setItem(
        CUSTOMER_CREATE_DRAFT_STORAGE_KEY,
        JSON.stringify(immediateDraft)
      );
      const otherDrafts = readCustomerListDrafts().filter(
        (draft) => draft.draftId !== immediateDraft.draftId
      );
      persistCustomerListDrafts([immediateDraft, ...otherDrafts]);
      toast({
        title: 'Draft saved',
        description: 'Customer list now includes this draft.'
      });
    } else {
      clearCustomerCreateDraft();
    }

    router.replace(listPath);
  };

  useEffect(() => {
    let isMounted = true;

    const fetchCustomers = async () => {
      setHasFetchedCustomers(false);
      setCustomersLoading(true);
      setCustomersError('');
      try {
        const response = await fetch(`${API_BASE_URL}/customers`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          const message = data?.message ?? 'Failed to load customers';
          throw new Error(message);
        }

        const data = await response.json().catch(() => ({}));
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.customers)
          ? data.customers
          : Array.isArray(data?.data)
          ? data.data
          : [];

        const typesMap: Record<string, 'individual' | 'business'> = {};
        const summaryById: Record<string, any> = {};
        const normalized = list.map((item: any, index: number) => {
          const rawType = String(item?.customerType ?? '').toLowerCase();
          const customerTypeValue: 'individual' | 'business' =
            rawType === 'business' ? 'business' : 'individual';
          const name =
            item?.personalName ||
            item?.companyName ||
            item?.name ||
            'Unknown';
          const phone =
            item?.primaryPhone ||
            item?.contactInformation?.primaryPhone ||
            item?.phone ||
            '';
          const address =
            item?.installationAddress ||
            item?.addressInformation?.installation ||
            item?.address ||
            '';
          const packageNameValue =
            item?.subscription?.plan?.planCode ||
            item?.services?.packageName ||
            item?.package ||
            item?.services?.serviceId ||
            '';
          const monthlyFeeValue =
            item?.subscription?.plan?.monthlyFee ??
            item?.billingInformation?.monthlySubscriptionFee ??
            item?.monthlyFee ??
            0;
          const statusValue =
            item?.status
              ? normalizeStatus(item.status)
              : item?.userStatus
              ? normalizeStatus(item.userStatus)
              : item?.status === 'inactive'
              ? 'inactive'
              : 'active';

          const id = String(item?.id ?? item?._id ?? index + 1);
          const collectorIdRaw =
            item?.collectorCode ?? item?.collectorId ?? item?.collector?.id ?? '';
          const collectorId = collectorIdRaw ? String(collectorIdRaw) : '';
          typesMap[id] = customerTypeValue;
          summaryById[id] = item;

          return {
            id,
            code: String(item?.customerCode ?? ''),
            name,
            phone,
            address,
            package: packageNameValue,
            monthlyFee: Number(monthlyFeeValue) || 0,
            status: statusValue,
            collectorId,
            joinDate: item?.createdAt ?? new Date().toISOString().split('T')[0]
          } as Customer & { code?: string };
        });

        if (isMounted) {
          setRemoteCustomers(normalized);
          setCustomerTypeById(typesMap);
          setCustomerSummaryById(summaryById);
          setHasFetchedCustomers(true);
        }

        try {
          const usersResponse = await fetch(`${API_BASE_URL}/users`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          });

          if (usersResponse.ok) {
            const usersData = await usersResponse.json().catch(() => ({}));
            const usersList = Array.isArray(usersData)
              ? usersData
              : Array.isArray(usersData?.users)
              ? usersData.users
              : Array.isArray(usersData?.data)
              ? usersData.data
              : [];

            const profileMap: Record<string, any> = {};
            for (const userItem of usersList) {
              const customerProfile = userItem?.customer;
              const customerId = customerProfile?.id;
              if (!customerId) continue;
              profileMap[String(customerId)] = {
                ...(customerProfile || {}),
                user: {
                  id: userItem?.id,
                  name: userItem?.name,
                  phone: userItem?.phone,
                  email: userItem?.email,
                  username: userItem?.username
                }
              };
            }

            if (isMounted) {
              setCustomerProfileById(profileMap);
            }
          } else if (isMounted) {
            setCustomerProfileById({});
          }
        } catch {
          if (isMounted) {
            setCustomerProfileById({});
          }
        }
      } catch (error) {
        if (isMounted) {
          setCustomersError(error instanceof Error ? error.message : 'Failed to load customers');
          setRemoteCustomers([]);
          setCustomerTypeById({});
          setCustomerSummaryById({});
          setCustomerProfileById({});
          setHasFetchedCustomers(true);
        }
      } finally {
        if (isMounted) {
          setCustomersLoading(false);
        }
      }
    };

    fetchCustomers();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const normalizeRules = (rawList: any[]) =>
      rawList
        .map((item, index) => {
          const billingModel = String(item?.billingModel ?? item?.model ?? 'recurring').toLowerCase();
          const billingType = String(item?.billingType ?? item?.type ?? 'fixed').toLowerCase();
          return {
            id: String(item?.id ?? index + 1),
            name: String(item?.name ?? item?.ruleName ?? `Rule ${index + 1}`),
            billingModel: billingModel === 'usage' ? 'usage' : 'recurring',
            billingType: billingType === 'anniversary' ? 'anniversary' : 'fixed',
            billingMode: String(item?.billingMode ?? item?.cycle ?? 'monthly'),
            fixedBillingDay: String(item?.fixedBillingDay ?? item?.config?.fixedBillingDay ?? ''),
            dueAfterDays: String(item?.dueAfterDays ?? item?.config?.dueAfterDays ?? ''),
            customMonths: String(item?.customMonths ?? item?.config?.customMonths ?? ''),
            isActive: item?.isActive !== false,
            version: Number(item?.version ?? 1) || 1
          } as BillingRule;
        })
        .sort((a, b) => a.name.localeCompare(b.name));

    const fetchBillingRules = async () => {
      setBillingRulesLoading(true);
      setBillingRulesError('');
      try {
        const response = await fetch(`${API_BASE_URL}/billing/rules`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
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

        if (isMounted) {
          setBillingRules(normalized);
        }
      } catch (error) {
        if (isMounted) {
          setBillingRules([]);
          setBillingRulesError(error instanceof Error ? error.message : 'Failed to load billing rules');
        }
      } finally {
        if (isMounted) {
          setBillingRulesLoading(false);
        }
      }
    };

    fetchBillingRules();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchLatestInvoices = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/billing/invoices`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          return;
        }

        const data = await response.json().catch(() => []);
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.invoices)
          ? data.invoices
          : [];

        if (!isMounted) return;

        const latestByCustomer: Record<string, GeneratedInvoice> = {};
        for (const item of list) {
          const invoice = item as GeneratedInvoice;
          const customerId = invoice.customer?.id;
          if (!customerId) continue;
          if (!latestByCustomer[customerId]) {
            latestByCustomer[customerId] = invoice;
          }
        }
        setLatestInvoiceByCustomerId(latestByCustomer);
      } catch {
        if (!isMounted) return;
      }
    };

    fetchLatestInvoices();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchPlans = async () => {
      setPlansLoading(true);
      setPlansError('');
      try {
        const response = await fetch(`${API_BASE_URL}/plans`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          const message = data?.message ?? 'Failed to load plans';
          throw new Error(message);
        }

        const data = await response.json().catch(() => ([]));
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.plans)
          ? data.plans
          : [];

        const normalized = list.map((item: any, index: number) => ({
          id: String(item?.id ?? index + 1),
          planCode: String(item?.planCode ?? ''),
          planName: String(item?.planName ?? ''),
          bandwidthPlan: item?.bandwidthPlan ?? null,
          monthlyFee: item?.monthlyFee ?? 0,
          currency: item?.currency ?? 'MMK',
          isActive: item?.isActive ?? true
        })) as PlanOption[];

        if (isMounted) {
          setPlans(normalized);
        }
      } catch (error) {
        if (isMounted) {
          setPlansError(error instanceof Error ? error.message : 'Failed to load plans');
          setPlans([]);
        }
      } finally {
        if (isMounted) {
          setPlansLoading(false);
        }
      }
    };

    fetchPlans();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchCollectors = async () => {
      setHasFetchedCollectors(false);
      setCollectorsLoading(true);
      setCollectorsError('');
      try {
        const response = await fetch(`${API_BASE_URL}/collectors`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          const message = data?.message ?? 'Failed to load collectors';
          throw new Error(message);
        }

        const data = await response.json().catch(() => ([]));
        const list = Array.isArray(data) ? data : Array.isArray(data?.collectors) ? data.collectors : [];
        const normalized = list.map((item: any, index: number) => ({
          id: String(item?.id ?? index + 1),
          name: item?.user?.name ?? 'Unknown',
          code: item?.collectorCode ?? item?.user?.username ?? ''
        }));

        if (isMounted) {
          setRemoteCollectors(normalized);
          setHasFetchedCollectors(true);
        }
      } catch (error) {
        if (isMounted) {
          setCollectorsError(error instanceof Error ? error.message : 'Failed to load collectors');
          setRemoteCollectors([]);
          setHasFetchedCollectors(true);
        }
      } finally {
        if (isMounted) {
          setCollectorsLoading(false);
        }
      }
    };

    fetchCollectors();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchGlobalAdjustments = async () => {
      setGlobalAdjustmentsLoading(true);
      setGlobalAdjustmentsError('');

      try {
        const response = await fetch(`${API_BASE_URL}/billing/global-adjustments`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.message ?? 'Failed to load global adjustments');
        }

        const data = await response.json().catch(() => []);
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.adjustments)
          ? data.adjustments
          : [];

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
              sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item.sortOrder) : index
            };
          })
          .filter((item) => item.description.trim().length > 0)
          .sort((a, b) => a.sortOrder - b.sortOrder);

        if (!isMounted) return;
        setGlobalAdjustments(normalized);
      } catch (error) {
        if (!isMounted) return;
        setGlobalAdjustments([]);
        setGlobalAdjustmentsError(
          error instanceof Error ? error.message : 'Failed to load global adjustments'
        );
      } finally {
        if (isMounted) {
          setGlobalAdjustmentsLoading(false);
        }
      }
    };

    fetchGlobalAdjustments();

    return () => {
      isMounted = false;
    };
  }, []);

  if (authLoading) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  if (!user || user.role !== 'admin') {
    return <div>Access denied</div>;
  }

  const handleAddCustomer = async () => {
    const nextErrors: Record<string, string> = {};
    if (!customerType) {
      nextErrors.customerType = 'Select customer type.';
    }
    if (!userStatus) {
      nextErrors.userStatus = 'Select status.';
    }
    if (customerType === 'individual') {
      if (!newCustomer.name.trim()) {
        nextErrors.individualName = 'Customer name is required.';
      }
      if (!nrcState) {
        nextErrors.nrcState = 'Select NRC state.';
      }
      if (!nrcTownship) {
        nextErrors.nrcTownship = 'Select NRC township.';
      }
      if (!nrcType) {
        nextErrors.nrcType = 'Select NRC type.';
      }
      if (nrcNumber.trim().length !== 6) {
        nextErrors.nrcNumber = 'Enter 6-digit NRC number.';
      }
    }
    if (customerType === 'business') {
      if (!companyName.trim()) {
        nextErrors.companyName = 'Company name is required.';
      }
      if (!businessRegNo.trim()) {
        nextErrors.businessRegNo = 'Registration number is required.';
      }
      if (!taxId.trim()) {
        nextErrors.taxId = 'Tax ID is required.';
      }
      if (!contactPerson.trim()) {
        nextErrors.contactPerson = 'Contact person is required.';
      }
      if (!contactNrcState) {
        nextErrors.contactNrcState = 'Select NRC state.';
      }
      if (!contactNrcTownship) {
        nextErrors.contactNrcTownship = 'Select NRC township.';
      }
      if (!contactNrcType) {
        nextErrors.contactNrcType = 'Select NRC type.';
      }
      if (contactNrcNumber.trim().length !== 6) {
        nextErrors.contactNrcNumber = 'Enter 6-digit NRC number.';
      }
    }
    if (primaryPhone.trim().length < 6 || primaryPhone.trim().length > 11) {
      nextErrors.primaryPhone = 'Enter 6-11 digits.';
    }
    if (contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      nextErrors.contactEmail = 'Enter a valid email address.';
    }
    if (!installationRegion) {
      nextErrors.installationRegion = 'Select region.';
    }
    if (!installationDistrict) {
      nextErrors.installationDistrict = 'Select district.';
    }
    if (!installationTownship) {
      nextErrors.installationTownship = 'Select township.';
    }
    if (!installationWard.trim()) {
      nextErrors.installationWard = 'Ward is required.';
    }
    if (billingSameAsInstallation === 'no') {
      if (!billingRegion) {
        nextErrors.billingRegion = 'Select region.';
      }
      if (!billingDistrict) {
        nextErrors.billingDistrict = 'Select district.';
      }
      if (!billingTownship) {
        nextErrors.billingTownship = 'Select township.';
      }
      if (!billingWard.trim()) {
        nextErrors.billingWard = 'Ward is required.';
      }
    }
    if (!packageName) {
      nextErrors.packageName = 'Select package plan.';
    }
    if (!bandwidthPlan) {
      nextErrors.bandwidthPlan = 'Select bandwidth.';
    }
    if (!selectedPlanCode) {
      nextErrors.packageName = 'Select package plan.';
    }
    if (!serviceType.trim()) {
      nextErrors.serviceType = 'Select service type.';
    }
    if (ipType === 'Static' && !staticIpAddress.trim()) {
      nextErrors.staticIpAddress = 'Static IP address is required for Static IP type.';
    }
    const normalizedServiceStartDate = parseDdMmYyyyToIso(serviceStartDateInput);
    const normalizedContractStartDate = parseDdMmYyyyToIso(contractStartDateInput);
    const normalizedContractEndDate = parseDdMmYyyyToIso(contractEndDateInput);
    const normalizedInstallationDate = parseDdMmYyyyToIso(installationDateInput);

    if (!serviceStartDateInput.trim()) {
      nextErrors.serviceStartDate = 'Enter service start date.';
    } else if (!normalizedServiceStartDate) {
      nextErrors.serviceStartDate = 'Use dd/mm/yyyy format.';
    }
    if (!contractStartDateInput.trim()) {
      nextErrors.contractStartDate = 'Enter contract start date.';
    } else if (!normalizedContractStartDate) {
      nextErrors.contractStartDate = 'Use dd/mm/yyyy format.';
    }
    if (!contractEndDateInput.trim()) {
      nextErrors.contractEndDate = 'Enter contract end date.';
    } else if (!normalizedContractEndDate) {
      nextErrors.contractEndDate = 'Use dd/mm/yyyy format.';
    }
    if (!installationDateInput.trim()) {
      nextErrors.installationDate = 'Enter installation date.';
    } else if (!normalizedInstallationDate) {
      nextErrors.installationDate = 'Use dd/mm/yyyy format.';
    }
    if (!installationFee.trim()) {
      nextErrors.installationFee = 'Installation fee is required.';
    }
    if (collectionService === 'yes' && !collectionFee.trim()) {
      nextErrors.collectionFee = 'Collection fee is required when collection service is enabled.';
    }
    if (discountApplied === 'yes') {
      if (!discountAmount.trim()) {
        nextErrors.discountAmount = 'Enter discount amount.';
      }
      if (!discountPeriod.trim()) {
        nextErrors.discountPeriod = 'Enter discount period.';
      }
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      const firstErrorMessage = Object.values(nextErrors)[0] ?? 'Please fill required fields.';
      toast({
        title: 'Required fields missing',
        description: firstErrorMessage,
        variant: 'destructive'
      });
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    if (isAddingCustomer) return;
    setIsAddingCustomer(true);

    const formatNrc = (state: string, township: string, type: string, number: string) => {
      if (!state || !township || !type || !number) return '';
      return `${state}/${township}(${type})${number}`;
    };

    const toNumber = (value: string | number) => {
      const parsed = Number(value);
      return Number.isNaN(parsed) ? 0 : parsed;
    };
    const billingDayForPayload = resolveBillingDayByMode('fixed');
    const baseAdditionalFees = toNumber(additionalFees);
    const collectionFeeValue = collectionService === 'yes' ? toNumber(collectionFee) : 0;

    const payload = {
      customer: {
        createInvoiceNow: false,
        customerType,
        userStatus,
        personalInformation:
          customerType === 'individual'
            ? {
                name: newCustomer.name,
                nrc: formatNrc(nrcState, nrcTownship, nrcType, nrcNumber)
              }
            : null,
        businessInformation:
          customerType === 'business'
            ? {
                companyName,
                businessRegistrationNumber: businessRegNo,
                taxIdentificationNumber: taxId,
                authorizedContactPerson: contactPerson,
                contactNrc: formatNrc(
                  contactNrcState,
                  contactNrcTownship,
                  contactNrcType,
                  contactNrcNumber
                )
              }
            : null,
        contactInformation: {
          primaryPhone,
          secondaryPhone,
          ...(contactEmail.trim() ? { email: contactEmail.trim() } : {})
        },
        addressInformation: {
          installation: formatAddress({
            building: installationBuilding,
            street: installationStreet,
            ward: installationWard,
            city: installationCity,
            township: installationTownship,
            district: installationDistrict,
            region: installationRegion,
            postalCode: installationPostalCode
          }),
          installationMapLink: installationMapLink.trim(),
          billing:
            billingSameAsInstallation === 'yes'
              ? 'Same as installation'
              : formatAddress({
                  building: billingBuilding,
                  street: billingStreet,
                  ward: billingWard,
                  city: billingCity,
                  township: billingTownship,
                  district: billingDistrict,
                  region: billingRegion,
                  postalCode: billingPostalCode
                }),
          billingMapLink:
            billingSameAsInstallation === 'yes'
              ? installationMapLink.trim()
              : billingMapLink.trim()
        },
        services: {
          serviceId,
          serviceType,
          packageName,
          bandwidthPlan,
          serviceStartDate: normalizedServiceStartDate ?? '',
          contractStartDate: normalizedContractStartDate ?? '',
          contractEndDate: normalizedContractEndDate ?? '',
          installationDate: normalizedInstallationDate ?? '',
          ipType,
          staticIpAddress: staticIpAddress.trim()
        },
        networkTechnical: {
          routerId,
          macAddress,
          onuSerial,
          vlanPort,
          networkZone
        },
        billingInformation: {
          firstInvoiceMode: undefined,
          fixedStartDay: fixedBillingWindow.startDay,
          fixedDueDay: fixedBillingWindow.dueDay,
          billingCycle,
          customBillingMonths,
          billingDay: billingDayForPayload,
          currency: 'MMK',
          monthlySubscriptionFee: toNumber(monthlyFee),
          installationFee: toNumber(installationFee),
          additionalFees: baseAdditionalFees,
          collectionService,
          collectionFee: collectionFeeValue,
          discountApplied,
          discountAmount: discountApplied === 'yes' ? toNumber(discountAmount) : 0,
          discountPeriod: discountApplied === 'yes' ? discountPeriod : ''
        }
      }
    };

    console.log('Add customer payload:', JSON.stringify(payload, null, 2));

    let createdCustomerId: string | null = null;
    let createdCustomerCode: string | null = null;
    try {
      const response = await fetch(`${API_BASE_URL}/auth/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          Array.isArray(data?.message)
            ? data.message.join(', ')
            : data?.message ?? data?.error ?? 'Failed to create customer';
        console.error(message, data);
        toast({
          title: 'Create customer failed',
          description: String(message),
          variant: 'destructive'
        });
        setIsAddingCustomer(false);
        return;
      }

      const extractCustomerId = (input: any): string | null => {
        if (!input || typeof input !== 'object') return null;
        const directId = input?.id ?? input?.customerId;
        if (directId) return String(directId);
        if (input?.customer?.id) return String(input.customer.id);
        if (input?.data?.id) return String(input.data.id);
        if (input?.data?.customer?.id) return String(input.data.customer.id);
        return null;
      };
      const extractCustomerCode = (input: any): string | null => {
        if (!input || typeof input !== 'object') return null;
        const directCode = input?.customerCode ?? input?.code;
        if (directCode) return String(directCode);
        if (input?.customer?.customerCode) return String(input.customer.customerCode);
        if (input?.data?.customerCode) return String(input.data.customerCode);
        if (input?.data?.customer?.customerCode) return String(input.data.customer.customerCode);
        return null;
      };

      createdCustomerId = extractCustomerId(data);
      createdCustomerCode = extractCustomerCode(data);
      upsertCustomerBillingFeeCache(
        {
          customerId: createdCustomerId,
          customerCode: createdCustomerCode,
          customerPhone: primaryPhone.trim()
        },
        {
        monthlySubscriptionFee: toNumber(monthlyFee),
        installationFee: toNumber(installationFee),
        additionalFees: baseAdditionalFees,
        collectionService,
        collectionFee: collectionFeeValue,
        discountApplied,
        discountAmount: discountApplied === 'yes' ? toNumber(discountAmount) : 0,
        discountPeriod: discountApplied === 'yes' ? discountPeriod : ''
      }
      );

      const selectedCollectorCode =
        collectionService === 'yes' ? String(newCustomer.collectorId || '').trim() : '';
      if (selectedCollectorCode) {
        let assignmentTargetCustomerId = createdCustomerId;

        if (!assignmentTargetCustomerId && createdCustomerCode) {
          try {
            const customersResponse = await fetch(`${API_BASE_URL}/customers`, {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' }
            });
            const customersData = await customersResponse.json().catch(() => null);
            if (customersResponse.ok) {
              const customersList: Array<{ id?: string; customerCode?: string }> = Array.isArray(customersData)
                ? customersData
                : Array.isArray(customersData?.customers)
                  ? customersData.customers
                  : [];
              const matched = customersList.find(
                (item) => String(item?.customerCode ?? '').trim() === createdCustomerCode
              );
              if (matched?.id) {
                assignmentTargetCustomerId = String(matched.id);
              }
            }
          } catch {
            // ignore fallback lookup errors and allow manual assignment from list
          }
        }

        if (assignmentTargetCustomerId) {
          const resolvedTargetId = assignmentTargetCustomerId;
          const assignResponse = await fetch(
            `${API_BASE_URL}/customers/${resolvedTargetId}`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ collectorCode: selectedCollectorCode })
            }
          );
          const assignData = await assignResponse.json().catch(() => null);
          if (!assignResponse.ok) {
            const message =
              Array.isArray(assignData?.message)
                ? assignData.message.join(', ')
                : assignData?.message ?? assignData?.error ?? 'Failed to assign collector';
            toast({
              title: 'Customer created',
              description: `Customer is created, but collector assignment failed: ${String(message)}`,
              variant: 'destructive'
            });
          } else {
            createdCustomerId = resolvedTargetId;
            updateRemoteCustomerCollector(resolvedTargetId, selectedCollectorCode);
            setCustomerSummaryById((prev) => ({
              ...prev,
              [resolvedTargetId]: {
                ...(prev[resolvedTargetId] ?? {}),
                collectorCode: selectedCollectorCode
              }
            }));
          }
        } else {
          toast({
            title: 'Customer created',
            description: 'Customer is created, but auto collector assignment could not be resolved.',
            variant: 'destructive'
          });
        }
      }

      const customerName =
        payload.customer.customerType === 'business'
          ? payload.customer.businessInformation?.companyName
          : payload.customer.personalInformation?.name;
      logAdminActivity(
        'customer_created',
        'New customer created.',
        'customer',
        createdCustomerId ?? undefined,
        customerName || undefined,
        {
          customerType: payload.customer.customerType,
          status: payload.customer.userStatus
        }
      );
    } catch (error) {
      console.error('Failed to create customer', error);
      toast({
        title: 'Network error',
        description: error instanceof Error ? error.message : 'Failed to create customer',
        variant: 'destructive'
      });
      setIsAddingCustomer(false);
      return;
    }

    addCustomer({
      ...newCustomer,
      status: normalizeStatus(userStatus)
    });
    clearCustomerCreateDraft();
    setCustomerType('individual');
    setUserStatus('enable');
    setNrcState('');
    setNrcTownship('');
    setNrcType('');
    setNrcNumber('');
    setCompanyName('');
    setBusinessRegNo('');
    setTaxId('');
    setContactPerson('');
    setContactNrcState('');
    setContactNrcTownship('');
    setContactNrcType('');
    setContactNrcNumber('');
    setPrimaryPhone('');
    setSecondaryPhone('');
    setContactEmail('');
    setInstallationRegion('');
    setInstallationDistrict('');
    setInstallationTownship('');
    setInstallationCity('');
    setInstallationWard('');
    setInstallationPostalCode('');
    setInstallationStreet('');
    setInstallationBuilding('');
    setInstallationMapLink('');
    setBillingSameAsInstallation('yes');
    setBillingRegion('');
    setBillingDistrict('');
    setBillingTownship('');
    setBillingCity('');
    setBillingWard('');
    setBillingPostalCode('');
    setBillingStreet('');
    setBillingBuilding('');
    setBillingMapLink('');
    setServiceId('');
    setServiceType('');
    setPackageName('');
    setSelectedPlanCode('');
    setBandwidthPlan('');
    setServiceStartDate('');
    setContractStartDate('');
    setContractEndDate('');
    setInstallationDate('');
    setIpType('');
    setStaticIpAddress('');
    setRouterId('');
    setMacAddress('');
    setOnuSerial('');
    setVlanPort('');
    setNetworkZone('');
    setBillingCycle('Monthly');
    setCustomBillingMonths('');
    setInstallationFee('');
    setAdditionalFees('');
    setCollectionService('yes');
    setCollectionFee('');
    setDiscountApplied('no');
    setDiscountAmount('');
    setDiscountPeriod('');
    setErrors({});
    setNewCustomer(createDefaultNewCustomer());

    if (createdCustomerId && typeof window !== 'undefined') {
      window.sessionStorage.setItem(
        POST_CREATE_INVOICE_PROMPT_SESSION_KEY,
        createdCustomerId
      );
    }

    toast({
      title: 'Customer added',
      description: 'Redirecting to customer list...'
    });

    setTimeout(() => {
      router.replace(listPath);
    }, 300);

    setIsAddingCustomer(false);
  };

  const addManualAdjustmentRow = (type: AdjustmentType) => {
    setManualInvoiceAdjustmentRows((prev) => [
      ...prev,
      {
        description: '',
        type,
        valueType: 'fixed',
        value: '',
        sortOrder: prev.length
      }
    ]);
  };

  const updateManualAdjustmentRow = <K extends keyof InvoiceAdjustmentInput>(
    index: number,
    key: K,
    value: InvoiceAdjustmentInput[K]
  ) => {
    setManualInvoiceAdjustmentRows((prev) =>
      prev.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row))
    );
  };

  const removeManualAdjustmentRow = (index: number) => {
    setManualInvoiceAdjustmentRows((prev) =>
      prev
        .filter((_, rowIndex) => rowIndex !== index)
        .map((row, rowIndex) => ({ ...row, sortOrder: rowIndex }))
    );
  };

  const addSelectedGlobalAdjustmentsToManual = () => {
    if (selectedGlobalAdjustmentIds.length === 0) {
      toast({
        title: 'Choose adjustment',
        description: 'Select one or more global adjustments first.',
        variant: 'destructive'
      });
      return;
    }

    const selectedItems = activeGlobalAdjustments.filter((item, index) =>
      selectedGlobalAdjustmentIds.includes(getGlobalAdjustmentKey(item, index))
    );

    if (selectedItems.length === 0) {
      toast({
        title: 'Not found',
        description: 'Selected adjustments are no longer available. Please refresh.',
        variant: 'destructive'
      });
      return;
    }

    setManualInvoiceAdjustmentRows((prev) => {
      const startSortOrder = prev.length;
      const mapped = selectedItems.map((item, index) => ({
        description: item.description,
        type: item.type,
        valueType: item.valueType,
        value: item.value,
        sortOrder: startSortOrder + index
      }));
      return [...prev, ...mapped];
    });
    setSelectedGlobalAdjustmentIds([]);
  };

  const openManualInvoicePrompt = (customerId: string) => {
    const customerSummary = customerSummaryById[customerId];
    const assignedRuleId = String(
      customerSummary?.billingRuleId ??
      customerSummary?.ruleId ??
      customerSummary?.billingRule?.id ??
      customerSummary?.rule?.id ??
      ''
    ).trim();
    const fallbackRuleId =
      assignedRuleId && activeBillingRules.some((rule) => rule.id === assignedRuleId)
        ? assignedRuleId
        : '';
    setManualInvoiceCustomerId(customerId);
    setManualInvoiceAdjustmentRows([]);
    setSelectedGlobalAdjustmentIds([]);
    setManualInvoiceSelectedRuleId(fallbackRuleId);
    setManualInvoicePromptOpen(true);
  };

  const openGeneratedInvoiceDialog = (invoice: GeneratedInvoice) => {
    setGeneratedInvoicePreview(invoice);
    setGeneratedInvoicePaymentMethod(invoice.paymentMethod || 'KBZPay');
    setGeneratedInvoiceReceiptNo(invoice.receiptNo || '');
    setGeneratedInvoiceDialogOpen(true);
  };

  const handleGenerateInvoice = async (
    customerId: string,
    adjustmentRows: InvoiceAdjustmentInput[] = [],
    options?: { ruleId?: string; rule?: BillingRule | null }
  ) => {
    if (isGeneratingInvoice[customerId]) return;

    setIsGeneratingInvoice((prev) => ({ ...prev, [customerId]: true }));
    try {
      const selectedCustomer = customersSource.find((item) => item.id === customerId) ?? null;
      const selectedCustomerSummary = customerSummaryById[customerId] ?? {};
      const selectedCustomerProfile = customerProfileById[customerId] ?? {};
      const cachedBillingInfo = resolveCustomerBillingFeeCache({
        customerId,
        customerCode:
          selectedCustomer?.code ??
          selectedCustomerSummary?.customerCode ??
          selectedCustomerSummary?.code ??
          null,
        customerPhone:
          selectedCustomer?.phone ??
          selectedCustomerSummary?.primaryPhone ??
          selectedCustomerSummary?.contactInformation?.primaryPhone ??
          null
      });
      const selectedBillingInfo =
        selectedCustomerProfile?.billingInformation ??
        selectedCustomerProfile?.billingInfo ??
        selectedCustomerProfile?.billing ??
        selectedCustomerSummary?.billingInformation ??
        selectedCustomerSummary?.billingInfo ??
        selectedCustomerSummary?.billing ??
        selectedCustomerSummary?.customer?.billingInformation ??
        {};
      const installationFeeForPayload = toNumber(
        selectedBillingInfo?.installationFee ??
          cachedBillingInfo?.installationFee ??
          selectedCustomerSummary?.billingInformation?.installationFee ??
          selectedCustomerSummary?.billing?.installationFee ??
          selectedCustomerSummary?.installationFee ??
          0
      );
      const additionalFeesForPayload = toNumber(
        selectedBillingInfo?.additionalFees ??
          cachedBillingInfo?.additionalFees ??
          selectedCustomerSummary?.billingInformation?.additionalFees ??
          selectedCustomerSummary?.billing?.additionalFees ??
          selectedCustomerSummary?.additionalFees ??
          0
      );

      const selectedRuleId = options?.ruleId;
      const selectedRule =
        options?.rule ??
        activeBillingRules.find((rule) => rule.id === selectedRuleId) ??
        null;
      const inferredCustomMonthsFromRuleName = (() => {
        const match = String(selectedRule?.name ?? '').match(/(\d+)\s*month/i);
        if (!match) return undefined;
        const parsed = Number.parseInt(match[1], 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
      })();
      const normalizedRuleBillingMode = String(selectedRule?.billingMode ?? '')
        .trim()
        .toLowerCase();
      const hasCustomMode =
        normalizedRuleBillingMode.includes('custom') || inferredCustomMonthsFromRuleName !== undefined;
      const derivedBillingCycle = (() => {
        if (normalizedRuleBillingMode.includes('quarter')) return 'Quarterly';
        if (normalizedRuleBillingMode.includes('yearly') || normalizedRuleBillingMode.includes('annual'))
          return 'Yearly';
        if (
          hasCustomMode ||
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
      const effectiveInvoiceMode = selectedRule
        ? selectedRule.billingType === 'anniversary'
          ? 'anniversary'
          : 'fixed'
        : undefined;
      const resolvedFixedStartDay = (() => {
        const parsed = Number.parseInt(String(selectedRule?.fixedBillingDay ?? ''), 10);
        if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 31) {
          return parsed;
        }
        return fixedBillingWindow.startDay;
      })();
      const response = await fetch(`${API_BASE_URL}/billing/customers/${customerId}/invoices/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          billingRuleId: selectedRuleId,
          billingRuleName: selectedRule?.name ?? undefined,
          billingCycle: derivedBillingCycle,
          firstInvoiceMode: effectiveInvoiceMode,
          billingMode: selectedRule?.billingMode ?? undefined,
          customMonths: (() => {
            if (
              normalizedRuleBillingMode === 'bi-yearly' ||
              normalizedRuleBillingMode === 'bi_yearly' ||
              normalizedRuleBillingMode === 'biyearly' ||
              normalizedRuleBillingMode === 'semiannual' ||
              normalizedRuleBillingMode === 'semi-annual'
            ) {
              return 6;
            }
            if (!hasCustomMode) return undefined;
            const parsed = Number.parseInt(selectedRule?.customMonths || '', 10);
            if (Number.isFinite(parsed) && parsed > 0) return parsed;
            return inferredCustomMonthsFromRuleName;
          })(),
          dueAfterDays: (() => {
            const raw = selectedRule?.dueAfterDays ?? '';
            if (!raw.trim()) return undefined;
            const parsed = Number.parseInt(raw, 10);
            return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
          })(),
          fixedStartDay: resolvedFixedStartDay,
          fixedDueDay: fixedBillingWindow.dueDay
        })
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          Array.isArray(data?.message)
            ? data.message.join(', ')
            : data?.message ?? 'Failed to create invoice';
        throw new Error(message);
      }

      let createdInvoice = data as GeneratedInvoice;
      if (!createdInvoice || typeof createdInvoice !== 'object' || !createdInvoice.id) {
        throw new Error('Invoice created but response is invalid.');
      }

      const hasManualRow = (keyword: string) =>
        adjustmentRows.some((row) =>
          String(row.description || '')
            .trim()
            .toLowerCase()
            .includes(keyword)
        );
      const autoBaseFeeAdjustments: InvoiceAdjustmentInput[] = [];
      if (
        installationFeeForPayload > 0 &&
        toNumber(createdInvoice.installationFee) <= 0 &&
        !hasManualRow('installation')
      ) {
        autoBaseFeeAdjustments.push({
          description: 'Installation Fee',
          type: 'plus',
          valueType: 'fixed',
          value: String(installationFeeForPayload),
          sortOrder: autoBaseFeeAdjustments.length
        });
      }
      if (
        additionalFeesForPayload > 0 &&
        toNumber(createdInvoice.additionalFees) <= 0 &&
        !hasManualRow('additional')
      ) {
        autoBaseFeeAdjustments.push({
          description: 'Additional Fee',
          type: 'plus',
          valueType: 'fixed',
          value: String(additionalFeesForPayload),
          sortOrder: autoBaseFeeAdjustments.length
        });
      }

      const finalAdjustmentRows = [...autoBaseFeeAdjustments, ...adjustmentRows];

      const adjustmentPayload = {
        adjustments: finalAdjustmentRows.map((row, index) => ({
          description: row.description.trim(),
          type: row.type,
          valueType: row.valueType,
          value: toNumber(row.value),
          rememberForNext: false,
          sortOrder: index
        }))
      };

      const adjustmentResponse = await fetch(
        `${API_BASE_URL}/billing/invoices/${createdInvoice.id}/adjustments`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(adjustmentPayload)
        }
      );

      if (adjustmentResponse.ok) {
        const updatedInvoice = (await adjustmentResponse.json().catch(() => null)) as GeneratedInvoice | null;
        if (updatedInvoice?.id) {
          createdInvoice = updatedInvoice;
        }
      } else {
        const adjustmentError = await adjustmentResponse.json().catch(() => null);
        const message =
          Array.isArray(adjustmentError?.message)
            ? adjustmentError.message.join(', ')
            : adjustmentError?.message ?? 'Invoice created but failed to save adjustments.';
        toast({
          title: 'Adjustment save failed',
          description: message,
          variant: 'destructive'
        });
      }

      openGeneratedInvoiceDialog(createdInvoice);
      const createdInvoiceCustomerId = createdInvoice.customer?.id;
      if (createdInvoiceCustomerId) {
        setLatestInvoiceByCustomerId((prev) => ({
          ...prev,
          [createdInvoiceCustomerId]: createdInvoice
        }));
      }

      toast({
        title: 'Invoice created',
        description:
          finalAdjustmentRows.length > 0
            ? 'Invoice created with selected adjustments.'
            : 'A new invoice has been generated for this customer.'
      });
      logAdminActivity(
        'invoice_created',
        'Invoice created for customer from customer list.',
        'invoice',
        createdInvoice.id,
        createdInvoice.invoiceNo || createdInvoice.id,
        {
          customerId,
          adjustmentCount: finalAdjustmentRows.length,
          billingRuleId: selectedRuleId || null
        }
      );
    } catch (error) {
      toast({
        title: 'Create invoice failed',
        description: error instanceof Error ? error.message : 'Failed to create invoice',
        variant: 'destructive'
      });
    } finally {
      setIsGeneratingInvoice((prev) => ({ ...prev, [customerId]: false }));
    }
  };

  const handleMarkGeneratedInvoicePaid = async () => {
    if (!generatedInvoicePreview) return;

    setIsMarkingGeneratedInvoicePaid(true);
    try {
      const response = await fetch(`${API_BASE_URL}/billing/invoices/${generatedInvoicePreview.id}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paymentMethod: generatedInvoicePaymentMethod.trim() || undefined,
          receiptNo: generatedInvoiceReceiptNo.trim() || undefined
        })
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          Array.isArray(data?.message)
            ? data.message.join(', ')
            : data?.message ?? 'Failed to mark invoice as paid';
        throw new Error(message);
      }

      const updatedRaw = (data ?? null) as Partial<GeneratedInvoice> | null;
      const updated: GeneratedInvoice = {
        ...(generatedInvoicePreview ?? {}),
        ...(updatedRaw ?? {}),
        status:
          String(updatedRaw?.status ?? '').trim().length > 0
            ? (updatedRaw?.status as GeneratedInvoice['status'])
            : 'paid'
      } as GeneratedInvoice;
      setGeneratedInvoicePreview(updated);
      setGeneratedInvoicePaymentMethod(updated.paymentMethod || generatedInvoicePaymentMethod);
      setGeneratedInvoiceReceiptNo(updated.receiptNo || generatedInvoiceReceiptNo);

      const updatedInvoiceCustomerId = updated.customer?.id;
      if (updatedInvoiceCustomerId) {
        setLatestInvoiceByCustomerId((prev) => ({
          ...prev,
          [updatedInvoiceCustomerId]: updated
        }));
      }

      if (updated.customer?.id) {
        setRemoteCustomers((prev) =>
          prev.map((customer) =>
            customer.id === updated.customer?.id ? { ...customer, status: 'active' } : customer
          )
        );
      }

      toast({
        title: 'Payment updated',
        description: 'Invoice marked as paid. Next invoice is now scheduled in billing engine.'
      });
      logAdminActivity(
        'invoice_paid',
        'Invoice marked as paid from customer invoice dialog.',
        'invoice',
        updated.id,
        updated.invoiceNo || updated.id,
        {
          paymentMethod: generatedInvoicePaymentMethod,
          receiptNo: generatedInvoiceReceiptNo || null
        }
      );
    } catch (error) {
      toast({
        title: 'Payment failed',
        description: error instanceof Error ? error.message : 'Failed to mark invoice as paid',
        variant: 'destructive'
      });
    } finally {
      setIsMarkingGeneratedInvoicePaid(false);
    }
  };

  const handleEditCustomer = (customer: Customer) => {
    const customerSummary = customerSummaryById[customer.id] ?? {};
    const customerProfile = customerProfileById[customer.id] ?? {};
    const merged = { ...customerSummary, ...customerProfile };
    const profileAddressInfo =
      customerProfile?.addressInformation ?? customerSummary?.addressInformation ?? {};
    const profileServices = customerProfile?.services ?? customerSummary?.services ?? {};
    const profileBilling =
      customerProfile?.billingInformation ?? customerSummary?.billingInformation ?? {};
    const profileNetwork =
      customerProfile?.networkTechnical ?? customerSummary?.networkTechnical ?? {};
    const summarySubscription = customerSummary?.subscription ?? {};
    const summaryPlan = summarySubscription?.plan ?? {};

    const resolvedCustomerType: 'individual' | 'business' =
      String(merged?.customerType ?? customerTypeById[customer.id] ?? 'individual').toLowerCase() ===
      'business'
        ? 'business'
        : 'individual';
    const resolvedStatus = toSelectStatus(
      (merged?.status as 'active' | 'inactive' | 'enable' | 'disable' | 'takeoff') ?? customer.status
    );

    const personalNrcValue =
      customerProfile?.personalInformation?.nrc ??
      customerProfile?.personalNrc ??
      customerSummary?.personalNrc ??
      '';
    const personalNrc = parseNrcValue(personalNrcValue);

    const businessContactNrcValue =
      customerProfile?.businessInformation?.contactNrc ??
      customerProfile?.contactNrc ??
      customerSummary?.contactPerson?.nrc ??
      '';
    const businessContactNrc = parseNrcValue(businessContactNrcValue);

    const installationAddressText =
      profileAddressInfo?.installation ??
      merged?.installationAddress ??
      customer.address ??
      '';
    const installationParsed = parseAddressValue(installationAddressText);

    const rawBillingAddress =
      profileAddressInfo?.billing ??
      merged?.billingAddress ??
      '';
    const hasSeparateBillingAddress =
      typeof rawBillingAddress === 'string' &&
      rawBillingAddress.trim().length > 0 &&
      rawBillingAddress.trim().toLowerCase() !== 'same as installation';
    const billingAddressText = hasSeparateBillingAddress ? rawBillingAddress : installationAddressText;
    const billingParsed = parseAddressValue(billingAddressText);

    const resolvedPlanCode =
      profileServices?.serviceId ??
      summaryPlan?.planCode ??
      customer.package ??
      '';
    const matchedPlan = activePlans.find((plan) => plan.planCode === resolvedPlanCode);
    const resolvedPlanName =
      profileServices?.packageName ??
      summaryPlan?.planName ??
      matchedPlan?.planName ??
      '';
    const resolvedBandwidth =
      profileServices?.bandwidthPlan ??
      matchedPlan?.bandwidthPlan ??
      '';
    const resolvedMonthlyFee =
      matchedPlan?.monthlyFee !== undefined
        ? toNumber(matchedPlan.monthlyFee)
        : toNumber(customer.monthlyFee);
    const resolvedPrimaryPhone =
      customerProfile?.contactInformation?.primaryPhone ??
      merged?.primaryPhone ??
      customer.phone ??
      '';
    const resolvedSecondaryPhone =
      customerProfile?.contactInformation?.secondaryPhone ??
      merged?.secondaryPhone ??
      '';
    const resolvedEmail =
      customerProfile?.contactInformation?.email ??
      merged?.contactEmail ??
      customerProfile?.user?.email ??
      '';
    const customerCodeForCache = String(
      (customer as Customer & { code?: string })?.code ??
        customerSummary?.customerCode ??
        merged?.customerCode ??
        ''
    ).trim();
    const cachedBillingInfo = resolveCustomerBillingFeeCache({
      customerId: customer.id,
      customerCode: customerCodeForCache,
      customerPhone: resolvedPrimaryPhone
    });
    const collectionServiceFromSummary = normalizeCollectionServiceValue(
      merged?.collectionService ??
        merged?.collectionServiceEnabled ??
        profileBilling?.collectionService ??
        customerSummary?.collectionService ??
        customerSummary?.collectionServiceEnabled
    );
    const resolvedCollectionService = collectionServiceFromSummary ?? cachedBillingInfo?.collectionService ?? 'yes';
    const collectionFeeFromSummary = toNumber(
      merged?.collectionFee ??
        profileBilling?.collectionFee ??
        customerSummary?.collectionFee
    );
    const resolvedCollectionFee =
      collectionFeeFromSummary > 0
        ? collectionFeeFromSummary
        : toNumber(cachedBillingInfo?.collectionFee);

    setEditingCustomer(customer);
    setErrors({});
    setCustomerType(resolvedCustomerType);
    setUserStatus(resolvedStatus);

    setNrcState(personalNrc.state);
    setNrcTownship(personalNrc.township);
    setNrcType(personalNrc.type);
    setNrcNumber(personalNrc.number);

    setCompanyName(
      customerProfile?.businessInformation?.companyName ??
        merged?.companyName ??
        (resolvedCustomerType === 'business' ? customer.name : '')
    );
    setBusinessRegNo(
      customerProfile?.businessInformation?.businessRegistrationNumber ??
        merged?.businessRegistrationNumber ??
        ''
    );
    setTaxId(
      customerProfile?.businessInformation?.taxIdentificationNumber ??
        merged?.taxIdentificationNumber ??
        ''
    );
    setContactPerson(
      customerProfile?.businessInformation?.authorizedContactPerson ??
        merged?.authorizedContactPerson ??
        customerSummary?.contactPerson?.name ??
        ''
    );
    setContactNrcState(businessContactNrc.state);
    setContactNrcTownship(businessContactNrc.township);
    setContactNrcType(businessContactNrc.type);
    setContactNrcNumber(businessContactNrc.number);

    setPrimaryPhone(resolvedPrimaryPhone);
    setSecondaryPhone(resolvedSecondaryPhone);
    setContactEmail(resolvedEmail);

    setInstallationRegion(installationParsed.region);
    setInstallationDistrict(installationParsed.district);
    setInstallationTownship(installationParsed.township);
    setInstallationCity(installationParsed.city);
    setInstallationWard(installationParsed.ward);
    setInstallationPostalCode(installationParsed.postalCode);
    setInstallationStreet(installationParsed.street);
    setInstallationBuilding(installationParsed.building);
    setInstallationMapLink(
      profileAddressInfo?.installationMapLink ??
        merged?.installationMapLink ??
        ''
    );

    setBillingSameAsInstallation(hasSeparateBillingAddress ? 'no' : 'yes');
    setBillingRegion(billingParsed.region);
    setBillingDistrict(billingParsed.district);
    setBillingTownship(billingParsed.township);
    setBillingCity(billingParsed.city);
    setBillingWard(billingParsed.ward);
    setBillingPostalCode(billingParsed.postalCode);
    setBillingStreet(billingParsed.street);
    setBillingBuilding(billingParsed.building);
    setBillingMapLink(
      profileAddressInfo?.billingMapLink ??
        merged?.billingMapLink ??
        ''
    );

    setServiceId(resolvedPlanCode);
    setServiceType(
      profileServices?.serviceType ??
        summarySubscription?.serviceType ??
        ''
    );
    setPackageName(resolvedPlanName);
    setSelectedPlanCode(resolvedPlanCode);
    setBandwidthPlan(resolvedBandwidth);
    setServiceStartDate(
      profileServices?.serviceStartDate ??
        summarySubscription?.serviceStartDate ??
        ''
    );
    setContractStartDate(profileServices?.contractStartDate ?? '');
    setContractEndDate(
      profileServices?.contractEndDate ??
        summarySubscription?.contractEndDate ??
        ''
    );
    setInstallationDate(profileServices?.installationDate ?? '');
    setIpType(
      profileServices?.ipType ??
        summarySubscription?.ipType ??
        ''
    );
    setStaticIpAddress(
      profileServices?.staticIpAddress ??
        summarySubscription?.staticIpAddress ??
        ''
    );

    setRouterId(profileNetwork?.routerId ?? '');
    setMacAddress(profileNetwork?.macAddress ?? '');
    setOnuSerial(profileNetwork?.onuSerial ?? '');
    setVlanPort(profileNetwork?.vlanPort ?? '');
    setNetworkZone(profileNetwork?.networkZone ?? '');

    setBillingCycle(profileBilling?.billingCycle ?? 'Monthly');
    setCustomBillingMonths(
      profileBilling?.customBillingMonths !== undefined &&
      profileBilling?.customBillingMonths !== null
        ? String(profileBilling.customBillingMonths)
        : ''
    );
    setInstallationFee(
      profileBilling?.installationFee !== undefined && profileBilling?.installationFee !== null
        ? String(profileBilling.installationFee)
        : ''
    );
    setAdditionalFees(
      profileBilling?.additionalFees !== undefined && profileBilling?.additionalFees !== null
        ? String(profileBilling.additionalFees)
        : ''
    );
    setCollectionService(resolvedCollectionService === 'no' ? 'no' : 'yes');
    setCollectionFee(
      resolvedCollectionService === 'yes' && resolvedCollectionFee > 0
        ? String(resolvedCollectionFee)
        : ''
    );
    setDiscountApplied(profileBilling?.discountApplied === 'yes' ? 'yes' : 'no');
    setDiscountAmount(
      profileBilling?.discountAmount !== undefined && profileBilling?.discountAmount !== null
        ? String(profileBilling.discountAmount)
        : ''
    );
    setDiscountPeriod(profileBilling?.discountPeriod ?? '');

    setNewCustomer({
      name:
        resolvedCustomerType === 'business'
          ? merged?.companyName ?? customer.name
          : merged?.personalName ?? customer.name,
      phone: resolvedPrimaryPhone,
      address: installationAddressText,
      package: resolvedPlanCode,
      monthlyFee: resolvedMonthlyFee,
      status: customer.status,
      collectorId: String(merged?.collectorCode ?? customer.collectorId ?? ''),
      joinDate: customer.joinDate
    });
  };

  const handleUpdateCustomer = async () => {
    if (!editingCustomer || isUpdatingCustomer) return;

    const formatNrc = (state: string, township: string, type: string, number: string) => {
      if (!state || !township || !type || !number) return '';
      return `${state}/${township}(${type})${number}`;
    };

    const previousSummary = customerSummaryById[editingCustomer.id] ?? {};
    const previousPlanCode = String(
      previousSummary?.subscription?.plan?.planCode ?? editingCustomer.package ?? ''
    );
    const nextPlanCode = selectedPlanCode || serviceId || '';
    const planChanged = Boolean(nextPlanCode && nextPlanCode !== previousPlanCode);
    const collectionFeeValue = collectionService === 'yes' ? toNumber(collectionFee) : 0;
    const nextCollectorCode =
      collectionService === 'yes' ? newCustomer.collectorId || null : null;
    const linkedUserId = String(customerProfileById[editingCustomer.id]?.user?.id ?? '').trim();
    const linkedAccountPayload: Record<string, string> = {
      phone: primaryPhone.trim()
    };
    if (contactEmail.trim()) {
      linkedAccountPayload.email = contactEmail.trim();
    }
    const customerNameForLog =
      customerType === 'business'
        ? companyName.trim() || editingCustomer.name
        : newCustomer.name.trim() || editingCustomer.name;

    const installationAddressValue = formatAddress({
      building: installationBuilding,
      street: installationStreet,
      ward: installationWard,
      city: installationCity,
      township: installationTownship,
      district: installationDistrict,
      region: installationRegion,
      postalCode: installationPostalCode
    });

    const billingAddressValue =
      billingSameAsInstallation === 'yes'
        ? 'Same as installation'
        : formatAddress({
            building: billingBuilding,
            street: billingStreet,
            ward: billingWard,
            city: billingCity,
            township: billingTownship,
            district: billingDistrict,
            region: billingRegion,
            postalCode: billingPostalCode
          });
    const installationMapLinkValue = installationMapLink.trim();
    const billingMapLinkValue =
      billingSameAsInstallation === 'yes'
        ? installationMapLinkValue
        : billingMapLink.trim();

    const patchPayloadRaw: Record<string, unknown> = {
      customerType,
      status: userStatus,
      collectorCode: nextCollectorCode,
      collectionServiceEnabled: collectionService === 'yes',
      collectionFee: collectionFeeValue,
      primaryPhone: primaryPhone.trim(),
      secondaryPhone: secondaryPhone.trim() || undefined,
      contactEmail: contactEmail.trim() || undefined,
      installationAddress: installationAddressValue || undefined,
      billingAddress: billingAddressValue || undefined,
      installationMapLink: installationMapLinkValue || undefined,
      billingMapLink: billingMapLinkValue || undefined,
      personalName: customerType === 'individual' ? newCustomer.name.trim() : undefined,
      personalNrc:
        customerType === 'individual'
          ? formatNrc(nrcState, nrcTownship, nrcType, nrcNumber) || undefined
          : undefined,
      companyName: customerType === 'business' ? companyName.trim() || undefined : undefined,
      businessRegistrationNumber:
        customerType === 'business' ? businessRegNo.trim() || undefined : undefined,
      taxIdentificationNumber:
        customerType === 'business' ? taxId.trim() || undefined : undefined,
      authorizedContactPerson:
        customerType === 'business' ? contactPerson.trim() || undefined : undefined,
      contactNrc:
        customerType === 'business'
          ? formatNrc(contactNrcState, contactNrcTownship, contactNrcType, contactNrcNumber) || undefined
          : undefined
    };
    const servicesPatchRaw: Record<string, unknown> = {
      serviceId: nextPlanCode || undefined,
      serviceType: serviceType.trim() || undefined,
      packageName: packageName.trim() || undefined,
      bandwidthPlan: bandwidthPlan.trim() || undefined,
      serviceStartDate: serviceStartDate || undefined,
      contractStartDate: contractStartDate || undefined,
      contractEndDate: contractEndDate || undefined,
      installationDate: installationDate || undefined,
      ipType: ipType || undefined,
      staticIpAddress: staticIpAddress.trim() || undefined
    };
    const servicesPatch = Object.fromEntries(
      Object.entries(servicesPatchRaw).filter(([, value]) => value !== undefined)
    );
    if (Object.keys(servicesPatch).length > 0) {
      patchPayloadRaw.services = servicesPatch;
    }
    const patchPayload = Object.fromEntries(
      Object.entries(patchPayloadRaw).filter(([, value]) => value !== undefined)
    );

    setIsUpdatingCustomer(true);
    try {
      const response = await fetch(`${API_BASE_URL}/customers/${editingCustomer.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(patchPayload)
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          Array.isArray(data?.message)
            ? data.message.join(', ')
            : data?.message ?? data?.error ?? 'Failed to update customer';
        throw new Error(String(message));
      }

      let linkedAccountWarning = '';
      if (linkedUserId && Object.keys(linkedAccountPayload).length > 0) {
        try {
          const userResponse = await fetch(`${API_BASE_URL}/users/${linkedUserId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              account: linkedAccountPayload
            })
          });
          const userData = await userResponse.json().catch(() => null);

          if (!userResponse.ok) {
            const message = Array.isArray(userData?.message)
              ? userData.message.join(', ')
              : userData?.message ?? userData?.error ?? 'Failed to update linked login account';
            linkedAccountWarning = String(message);
          } else {
            setCustomerProfileById((prev) => ({
              ...prev,
              [editingCustomer.id]: {
                ...(prev[editingCustomer.id] ?? {}),
                user: {
                  ...(prev[editingCustomer.id]?.user ?? {}),
                  id: linkedUserId,
                  phone:
                    String(userData?.phone ?? '').trim().length > 0
                      ? String(userData.phone)
                      : linkedAccountPayload.phone,
                  email:
                    String(userData?.email ?? '').trim().length > 0
                      ? String(userData.email)
                      : (linkedAccountPayload.email ?? prev[editingCustomer.id]?.user?.email ?? '')
                }
              }
            }));
          }
        } catch (error) {
          linkedAccountWarning =
            error instanceof Error ? error.message : 'Failed to update linked login account';
        }
      }

      updateCustomer(editingCustomer.id, {
        ...newCustomer,
        status: normalizeStatus(userStatus)
      });
      setRemoteCustomers((prev) =>
        prev.map((row) =>
          row.id === editingCustomer.id
            ? {
                ...row,
                name: customerNameForLog,
                phone: primaryPhone.trim(),
                address: installationAddressValue || row.address,
                package: nextPlanCode || row.package,
                monthlyFee: toNumber(monthlyFee),
                status: normalizeStatus(userStatus),
                collectorId: nextCollectorCode || ''
              }
            : row
        )
      );
      setCustomerTypeById((prev) => ({
        ...prev,
        [editingCustomer.id]: customerType
      }));
      setCustomerSummaryById((prev) => ({
        ...prev,
        [editingCustomer.id]: {
          ...(prev[editingCustomer.id] ?? {}),
          ...(data && typeof data === 'object' ? data : {}),
          customerType,
          status: userStatus,
          personalName: customerType === 'individual' ? newCustomer.name.trim() : null,
          companyName: customerType === 'business' ? companyName.trim() : null,
          primaryPhone: primaryPhone.trim(),
          contactEmail: contactEmail.trim() || null,
          installationAddress: installationAddressValue || null,
          billingAddress: billingAddressValue || null,
          installationMapLink: installationMapLinkValue || null,
          billingMapLink: billingMapLinkValue || null,
          collectorCode: nextCollectorCode,
          collectionServiceEnabled: collectionService === 'yes',
          collectionFee: collectionFeeValue,
          subscription: {
            ...(prev[editingCustomer.id]?.subscription ?? {}),
            plan: {
              ...(prev[editingCustomer.id]?.subscription?.plan ?? {}),
              planCode: nextPlanCode || prev[editingCustomer.id]?.subscription?.plan?.planCode || null,
              planName: packageName || prev[editingCustomer.id]?.subscription?.plan?.planName || null,
              monthlyFee: toNumber(monthlyFee)
            }
          }
        }
      }));
      setCustomerProfileById((prev) => ({
        ...prev,
        [editingCustomer.id]: {
          ...(prev[editingCustomer.id] ?? {}),
          installationMapLink: installationMapLinkValue || null,
          billingMapLink: billingMapLinkValue || null,
          addressInformation: {
            ...(prev[editingCustomer.id]?.addressInformation ?? {}),
            installationAddress: installationAddressValue || null,
            billingAddress: billingAddressValue || null,
            installationMapLink: installationMapLinkValue || null,
            billingMapLink: billingMapLinkValue || null
          }
        }
      }));
      const editingCustomerCode = String(
        (editingCustomer as Customer & { code?: string })?.code ??
          customerSummaryById[editingCustomer.id]?.customerCode ??
          ''
      ).trim();
      upsertCustomerBillingFeeCache(
        {
          customerId: editingCustomer.id,
          customerCode: editingCustomerCode,
          customerPhone: primaryPhone.trim()
        },
        {
          monthlySubscriptionFee: toNumber(monthlyFee),
          installationFee: toNumber(installationFee),
          additionalFees: toNumber(additionalFees),
          collectionService,
          collectionFee: collectionFeeValue,
          discountApplied,
          discountAmount: discountApplied === 'yes' ? toNumber(discountAmount) : 0,
          discountPeriod: discountApplied === 'yes' ? discountPeriod : ''
        }
      );

      logAdminActivity(
        'customer_updated',
        'Customer profile updated.',
        'customer',
        editingCustomer.id,
        customerNameForLog
      );

      if (planChanged) {
        await handleGenerateInvoice(editingCustomer.id);
        toast({
          title: 'Customer updated',
          description: 'Customer updated and a new invoice was generated for package change.'
        });
      } else {
        toast({
          title: 'Customer updated',
          description: 'Customer details updated successfully.'
        });
      }
      if (linkedAccountWarning) {
        toast({
          title: 'Login account update warning',
          description: linkedAccountWarning,
          variant: 'destructive'
        });
      }

      setEditingCustomer(null);
      setCustomerType('individual');
      setUserStatus('enable');
      setNrcState('');
      setNrcTownship('');
      setNrcType('');
      setNrcNumber('');
      setCompanyName('');
      setBusinessRegNo('');
      setTaxId('');
      setContactPerson('');
      setContactNrcState('');
      setContactNrcTownship('');
      setContactNrcType('');
      setContactNrcNumber('');
      setPrimaryPhone('');
      setSecondaryPhone('');
      setContactEmail('');
      setInstallationRegion('');
      setInstallationDistrict('');
      setInstallationTownship('');
      setInstallationCity('');
      setInstallationWard('');
      setInstallationPostalCode('');
      setInstallationStreet('');
      setInstallationBuilding('');
      setInstallationMapLink('');
      setBillingSameAsInstallation('yes');
      setBillingRegion('');
      setBillingDistrict('');
      setBillingTownship('');
      setBillingCity('');
      setBillingWard('');
      setBillingPostalCode('');
      setBillingStreet('');
      setBillingBuilding('');
      setBillingMapLink('');
      setServiceId('');
      setServiceType('');
      setPackageName('');
      setSelectedPlanCode('');
      setBandwidthPlan('');
      setServiceStartDate('');
      setContractStartDate('');
      setContractEndDate('');
      setInstallationDate('');
      setIpType('');
      setStaticIpAddress('');
      setRouterId('');
      setMacAddress('');
      setOnuSerial('');
      setVlanPort('');
      setNetworkZone('');
      setBillingCycle('Monthly');
      setCustomBillingMonths('');
      setInstallationFee('');
      setAdditionalFees('');
      setCollectionService('yes');
      setCollectionFee('');
      setDiscountApplied('no');
      setDiscountAmount('');
      setDiscountPeriod('');
      setNewCustomer(createDefaultNewCustomer());
    } catch (error) {
      toast({
        title: 'Update customer failed',
        description: error instanceof Error ? error.message : 'Failed to update customer',
        variant: 'destructive'
      });
    } finally {
      setIsUpdatingCustomer(false);
    }
  };

  const formContent = (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-sky-50 px-6 py-4">
        <h3 className="text-lg font-semibold text-slate-900">User Information</h3>
      </div>
      <div className="grid gap-6 px-6 py-6 md:grid-cols-2">
        <div className="space-y-3">
          <Label className="text-sm font-medium text-slate-700">
            Customer Type <span className="text-rose-600">*</span>
          </Label>
          <RadioGroup
            value={customerType}
            onValueChange={(value) => setCustomerType(value as 'individual' | 'business')}
            className="flex flex-wrap gap-6"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem id="customer-type-individual" value="individual" />
              <Label htmlFor="customer-type-individual">Individual</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem id="customer-type-business" value="business" />
              <Label htmlFor="customer-type-business">Business</Label>
            </div>
          </RadioGroup>
          {errors.customerType && (
            <p className="text-xs text-rose-600">{errors.customerType}</p>
          )}
        </div>

        <div className="space-y-3">
          <Label htmlFor="userStatus" className="text-sm font-medium text-slate-700">
            User Status <span className="text-rose-600">*</span>
          </Label>
          <SearchableSelect
            id="userStatus"
            value={userStatus}
            onValueChange={(value) => setUserStatus(value as 'enable' | 'disable' | 'takeoff')}
            options={userStatusSelectOptions}
            placeholder="Select status"
          />
          {errors.userStatus && (
            <p className="text-xs text-rose-600">{errors.userStatus}</p>
          )}
        </div>

      </div>

      {customerType === 'individual' && (
        <div className="border-t border-slate-200 px-6 py-6">
          <h4 className="text-sm font-semibold text-slate-600 mb-4 border-l-4 border-sky-400 pl-3">
            Personal Information
          </h4>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="individual-name" className="text-sm font-medium text-slate-700">
                Customer Name <span className="text-rose-600">*</span>
              </Label>
              <Input
                id="individual-name"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                placeholder="Aung Aung"
              />
              {errors.individualName && (
                <p className="text-xs text-rose-600">{errors.individualName}</p>
              )}
            </div>
            <div className="md:col-span-2 space-y-3 rounded-lg border border-slate-200 bg-slate-100 p-4">
              <div className="text-sm font-medium text-slate-700">
                NRC <span className="text-rose-600">*</span>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="space-y-1">
                  <SearchableSelect
                    id="nrcState"
                    value={nrcState}
                    onValueChange={(value) => {
                      setNrcState(value);
                      setNrcTownship('');
                    }}
                    options={nrcStateOptions}
                    placeholder="State"
                  />
                  {errors.nrcState && (
                    <p className="text-xs text-rose-600">{errors.nrcState}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <SearchableSelect
                    id="nrcTownship"
                    value={nrcTownship}
                    onValueChange={setNrcTownship}
                    options={nrcTownshipOptions}
                    placeholder="Township"
                  />
                  {errors.nrcTownship && (
                    <p className="text-xs text-rose-600">{errors.nrcTownship}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <SearchableSelect
                    id="nrcType"
                    value={nrcType}
                    onValueChange={setNrcType}
                    options={nrcTypeOptions}
                    placeholder="Type"
                  />
                  {errors.nrcType && (
                    <p className="text-xs text-rose-600">{errors.nrcType}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Input
                    id="nrcNumber"
                    value={nrcNumber}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setNrcNumber(digitsOnly);
                    }}
                    placeholder="123456"
                    inputMode="numeric"
                  />
                  {errors.nrcNumber && (
                    <p className="text-xs text-rose-600">{errors.nrcNumber}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {customerType === 'business' && (
        <div className="border-t border-slate-200 px-6 py-6">
          <h4 className="text-sm font-semibold text-slate-600 mb-4 border-l-4 border-emerald-400 pl-3">
            Business Information
          </h4>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="companyName" className="text-sm font-medium text-slate-700">
                Company Name <span className="text-rose-600">*</span>
              </Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Company name"
              />
              {errors.companyName && (
                <p className="text-xs text-rose-600">{errors.companyName}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessRegNo" className="text-sm font-medium text-slate-700">
                Business Registration Number <span className="text-rose-600">*</span>
              </Label>
              <Input
                id="businessRegNo"
                value={businessRegNo}
                onChange={(e) => setBusinessRegNo(e.target.value)}
                placeholder="Registration number"
              />
              {errors.businessRegNo && (
                <p className="text-xs text-rose-600">{errors.businessRegNo}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxId" className="text-sm font-medium text-slate-700">
                Tax Identification Number (VAT/GST) <span className="text-rose-600">*</span>
              </Label>
              <Input
                id="taxId"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                placeholder="VAT/GST number"
              />
              {errors.taxId && (
                <p className="text-xs text-rose-600">{errors.taxId}</p>
              )}
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="contactPerson" className="text-sm font-medium text-slate-700">
                Authorized Contact Person <span className="text-rose-600">*</span>
              </Label>
              <Input
                id="contactPerson"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="Contact person name"
              />
              {errors.contactPerson && (
                <p className="text-xs text-rose-600">{errors.contactPerson}</p>
              )}
            </div>
            <div className="md:col-span-2 space-y-3 rounded-lg border border-slate-200 bg-slate-100 p-4">
              <div className="text-sm font-medium text-slate-700">
                Contact Person NRC <span className="text-rose-600">*</span>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="space-y-2">
                  <SearchableSelect
                    id="contactNrcState"
                    value={contactNrcState}
                    onValueChange={(value) => {
                      setContactNrcState(value);
                      setContactNrcTownship('');
                    }}
                    options={nrcStateOptions}
                    placeholder="State"
                  />
                  {errors.contactNrcState && (
                    <p className="text-xs text-rose-600">{errors.contactNrcState}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <SearchableSelect
                    id="contactNrcTownship"
                    value={contactNrcTownship}
                    onValueChange={setContactNrcTownship}
                    options={contactNrcTownshipSelectOptions}
                    placeholder="Township"
                  />
                  {errors.contactNrcTownship && (
                    <p className="text-xs text-rose-600">{errors.contactNrcTownship}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <SearchableSelect
                    id="contactNrcType"
                    value={contactNrcType}
                    onValueChange={setContactNrcType}
                    options={nrcTypeOptions}
                    placeholder="Type"
                  />
                  {errors.contactNrcType && (
                    <p className="text-xs text-rose-600">{errors.contactNrcType}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Input
                    id="contactNrcNumber"
                    value={contactNrcNumber}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setContactNrcNumber(digitsOnly);
                    }}
                    placeholder="123456"
                    inputMode="numeric"
                  />
                  {errors.contactNrcNumber && (
                    <p className="text-xs text-rose-600">{errors.contactNrcNumber}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-slate-200 px-6 py-6">
        <h4 className="text-sm font-semibold text-slate-600 mb-4 border-l-4 border-violet-400 pl-3">
          Contact Information
        </h4>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="primaryPhone" className="text-sm font-medium text-slate-700">
              Primary Phone Number <span className="text-rose-600">*</span>
            </Label>
            <div className="flex gap-2">
              <div className="flex items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
                +95
              </div>
              <Input
                id="primaryPhone"
                value={primaryPhone}
                onChange={(e) => {
                  const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 11);
                  setPrimaryPhone(digitsOnly);
                }}
                placeholder="9 123 456 789"
                inputMode="numeric"
              />
            </div>
            {errors.primaryPhone && (
              <p className="text-xs text-rose-600">{errors.primaryPhone}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="secondaryPhone" className="text-sm font-medium text-slate-700">
              Secondary Phone Number
            </Label>
            <div className="flex gap-2">
              <div className="flex items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
                +95
              </div>
              <Input
                id="secondaryPhone"
                value={secondaryPhone}
                onChange={(e) => {
                  const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 11);
                  setSecondaryPhone(digitsOnly);
                }}
                placeholder="9 123 456 789"
                inputMode="numeric"
              />
            </div>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="contactEmail" className="text-sm font-medium text-slate-700">
              Email
            </Label>
            <Input
              id="contactEmail"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="example@domain.com"
            />
            {errors.contactEmail && (
              <p className="text-xs text-rose-600">{errors.contactEmail}</p>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 px-6 py-6">
        <h4 className="text-sm font-semibold text-slate-600 mb-4 border-l-4 border-amber-400 pl-3">
          Address Information (Installation Address)
        </h4>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="installationRegion" className="text-sm font-medium text-slate-700">
              Region <span className="text-rose-600">*</span>
            </Label>
            <SearchableSelect
              id="installationRegion"
              value={installationRegion}
              onValueChange={(value) => {
                setInstallationRegion(value);
                setInstallationDistrict('');
                setInstallationTownship('');
              }}
              options={regionSelectOptions}
              placeholder="Select region"
            />
            {errors.installationRegion && (
              <p className="text-xs text-rose-600">{errors.installationRegion}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="installationDistrict" className="text-sm font-medium text-slate-700">
              District <span className="text-rose-600">*</span>
            </Label>
            <SearchableSelect
              id="installationDistrict"
              value={installationDistrict}
              onValueChange={(value) => {
                setInstallationDistrict(value);
                const townshipsForDistrict = installationDistrictTownshipMap[value] ?? [];
                setInstallationTownship((prev) =>
                  townshipsForDistrict.includes(prev) ? prev : ''
                );
              }}
              options={installationDistrictSelectOptions}
              placeholder="Select district"
            />
            {errors.installationDistrict && (
              <p className="text-xs text-rose-600">{errors.installationDistrict}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="installationTownship" className="text-sm font-medium text-slate-700">
              Township <span className="text-rose-600">*</span>
            </Label>
            <SearchableSelect
              id="installationTownship"
              value={installationTownship}
              onValueChange={(value) => {
                setInstallationTownship(value);
                const inferredDistrict = installationTownshipToDistrictMap[value];
                if (inferredDistrict && inferredDistrict !== installationDistrict) {
                  setInstallationDistrict(inferredDistrict);
                }
              }}
              options={installationTownshipSelectOptions}
              placeholder="Select township"
            />
            {errors.installationTownship && (
              <p className="text-xs text-rose-600">{errors.installationTownship}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="installationCity" className="text-sm font-medium text-slate-700">
              City
            </Label>
            <Input
              id="installationCity"
              value={installationCity}
              onChange={(e) => setInstallationCity(e.target.value)}
              placeholder="City"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="installationPostalCode" className="text-sm font-medium text-slate-700">
              Postal Code
            </Label>
            <Input
              id="installationPostalCode"
              value={installationPostalCode}
              onChange={(e) => setInstallationPostalCode(e.target.value)}
              placeholder="Postal code"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="installationWard" className="text-sm font-medium text-slate-700">
              Ward <span className="text-rose-600">*</span>
            </Label>
            <Input
              id="installationWard"
              value={installationWard}
              onChange={(e) => setInstallationWard(e.target.value)}
              placeholder="Ward"
            />
            {errors.installationWard && (
              <p className="text-xs text-rose-600">{errors.installationWard}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="installationStreet" className="text-sm font-medium text-slate-700">
              Street
            </Label>
            <Input
              id="installationStreet"
              value={installationStreet}
              onChange={(e) => setInstallationStreet(e.target.value)}
              placeholder="Street"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="installationBuilding" className="text-sm font-medium text-slate-700">
              Building / Unit
            </Label>
            <Input
              id="installationBuilding"
              value={installationBuilding}
              onChange={(e) => setInstallationBuilding(e.target.value)}
              placeholder="Building / Unit"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label className="text-sm font-medium text-slate-700">Full Address</Label>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {formatAddress({
                building: installationBuilding,
                street: installationStreet,
                ward: installationWard,
                city: installationCity,
                township: installationTownship,
                district: installationDistrict,
                region: installationRegion,
                postalCode: installationPostalCode
              }) || '—'}
            </div>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="installationMapLink" className="text-sm font-medium text-slate-700">
              Google Map Link
            </Label>
            <Input
              id="installationMapLink"
              value={installationMapLink}
              onChange={(e) => setInstallationMapLink(e.target.value)}
              placeholder="https://maps.google.com/..."
            />
          </div>
        </div>

        <div className="mt-8 space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-slate-700">
              Billing Address (Same with Installation Address?) <span className="text-rose-600">*</span>
            </Label>
          </div>
          <RadioGroup
            value={billingSameAsInstallation}
            onValueChange={(value) => setBillingSameAsInstallation(value as 'yes' | 'no')}
            className="flex flex-wrap gap-6"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem id="billing-same-yes" value="yes" />
              <Label htmlFor="billing-same-yes">Yes</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem id="billing-same-no" value="no" />
              <Label htmlFor="billing-same-no">No</Label>
            </div>
          </RadioGroup>
        </div>

      {billingSameAsInstallation === 'no' && (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="billingRegion" className="text-sm font-medium text-slate-700">
                Region <span className="text-rose-600">*</span>
              </Label>
              <SearchableSelect
                id="billingRegion"
                value={billingRegion}
                onValueChange={(value) => {
                  setBillingRegion(value);
                  setBillingDistrict('');
                  setBillingTownship('');
                }}
                options={regionSelectOptions}
                placeholder="Select region"
              />
              {errors.billingRegion && (
                <p className="text-xs text-rose-600">{errors.billingRegion}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="billingDistrict" className="text-sm font-medium text-slate-700">
                District <span className="text-rose-600">*</span>
              </Label>
              <SearchableSelect
                id="billingDistrict"
                value={billingDistrict}
                onValueChange={(value) => {
                  setBillingDistrict(value);
                  const townshipsForDistrict = billingDistrictTownshipMap[value] ?? [];
                  setBillingTownship((prev) =>
                    townshipsForDistrict.includes(prev) ? prev : ''
                  );
                }}
                options={billingDistrictSelectOptions}
                placeholder="Select district"
              />
              {errors.billingDistrict && (
                <p className="text-xs text-rose-600">{errors.billingDistrict}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="billingTownship" className="text-sm font-medium text-slate-700">
                Township <span className="text-rose-600">*</span>
              </Label>
              <SearchableSelect
                id="billingTownship"
                value={billingTownship}
                onValueChange={(value) => {
                  setBillingTownship(value);
                  const inferredDistrict = billingTownshipToDistrictMap[value];
                  if (inferredDistrict && inferredDistrict !== billingDistrict) {
                    setBillingDistrict(inferredDistrict);
                  }
                }}
                options={billingTownshipSelectOptions}
                placeholder="Select township"
              />
              {errors.billingTownship && (
                <p className="text-xs text-rose-600">{errors.billingTownship}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="billingCity" className="text-sm font-medium text-slate-700">
                City
              </Label>
              <Input
                id="billingCity"
                value={billingCity}
                onChange={(e) => setBillingCity(e.target.value)}
                placeholder="City"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billingPostalCode" className="text-sm font-medium text-slate-700">
                Postal Code
              </Label>
              <Input
                id="billingPostalCode"
                value={billingPostalCode}
                onChange={(e) => setBillingPostalCode(e.target.value)}
                placeholder="Postal code"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billingWard" className="text-sm font-medium text-slate-700">
                Ward <span className="text-rose-600">*</span>
              </Label>
              <Input
                id="billingWard"
                value={billingWard}
                onChange={(e) => setBillingWard(e.target.value)}
                placeholder="Ward"
              />
              {errors.billingWard && (
                <p className="text-xs text-rose-600">{errors.billingWard}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="billingStreet" className="text-sm font-medium text-slate-700">
                Street
              </Label>
              <Input
                id="billingStreet"
                value={billingStreet}
                onChange={(e) => setBillingStreet(e.target.value)}
                placeholder="Street"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billingBuilding" className="text-sm font-medium text-slate-700">
                Building / Unit
              </Label>
              <Input
                id="billingBuilding"
                value={billingBuilding}
                onChange={(e) => setBillingBuilding(e.target.value)}
                placeholder="Building / Unit"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="text-sm font-medium text-slate-700">Full Address</Label>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {formatAddress({
                building: billingBuilding,
                street: billingStreet,
                ward: billingWard,
                city: billingCity,
                township: billingTownship,
                district: billingDistrict,
                region: billingRegion,
                postalCode: billingPostalCode
              }) || '—'}
            </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="billingMapLink" className="text-sm font-medium text-slate-700">
                Google Map Link
              </Label>
              <Input
                id="billingMapLink"
                value={billingMapLink}
                onChange={(e) => setBillingMapLink(e.target.value)}
                placeholder="https://maps.google.com/..."
              />
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 px-6 py-6">
        <h4 className="text-sm font-semibold text-slate-600 mb-4 border-l-4 border-teal-400 pl-3">
          Services & Subscription Details
        </h4>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="serviceId" className="text-sm font-medium text-slate-700">
              Service ID
            </Label>
            <SearchableSelect
              id="serviceId"
              value={selectedPlanCode}
              onValueChange={(value) => {
                setSelectedPlanCode(value);
                const plan = activePlans.find((item) => item.planCode === value);
                setServiceId(plan?.planCode ?? '');
                setPackageName(plan?.planName ?? '');
                setBandwidthPlan(plan?.bandwidthPlan ?? '');
              }}
              options={serviceIdSelectOptions}
              placeholder={plansLoading ? 'Loading plans...' : 'Select service ID'}
              disabled={plansLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="serviceType" className="text-sm font-medium text-slate-700">
              Service Type <span className="text-rose-600">*</span>
            </Label>
            <SearchableSelect
              id="serviceType"
              value={serviceType}
              onValueChange={setServiceType}
              options={serviceTypeSelectOptions}
              placeholder="Select service type"
            />
            {errors.serviceType && (
              <p className="text-xs text-rose-600">{errors.serviceType}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="packageName" className="text-sm font-medium text-slate-700">
              Internet Plan / Package Name <span className="text-rose-600">*</span>
            </Label>
            <SearchableSelect
              id="packageName"
              value={selectedPlanCode}
              onValueChange={(value) => {
                setSelectedPlanCode(value);
                const plan = activePlans.find((item) => item.planCode === value);
                setServiceId(plan?.planCode ?? '');
                setPackageName(plan?.planName ?? '');
                setBandwidthPlan(plan?.bandwidthPlan ?? '');
              }}
              options={packagePlanSelectOptions}
              placeholder={plansLoading ? 'Loading plans...' : 'Select package plan'}
              disabled={plansLoading}
            />
            {errors.packageName && (
              <p className="text-xs text-rose-600">{errors.packageName}</p>
            )}
            {plansError && (
              <p className="text-xs text-rose-600">{plansError}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="bandwidthPlan" className="text-sm font-medium text-slate-700">
              Bandwidth (Download / Upload) Mbps <span className="text-rose-600">*</span>
            </Label>
            <SearchableSelect
              id="bandwidthPlan"
              value={bandwidthPlan}
              onValueChange={setBandwidthPlan}
              options={bandwidthSelectOptions}
              placeholder="Select bandwidth"
            />
            {errors.bandwidthPlan && (
              <p className="text-xs text-rose-600">{errors.bandwidthPlan}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="serviceStartDate" className="text-sm font-medium text-slate-700">
              Service Start Date <span className="text-rose-600">*</span>
            </Label>
            <div className="flex gap-2">
              <Input
                id="serviceStartDate"
                type="text"
                value={serviceStartDateInput}
                onChange={(e) => {
                  const nextValue = sanitizeDateInput(e.target.value);
                  setServiceStartDateInput(nextValue);
                  if (!nextValue) {
                    setServiceStartDate('');
                    return;
                  }
                  const parsed = parseDdMmYyyyToIso(nextValue);
                  if (parsed) {
                    setServiceStartDate(parsed);
                    clearFieldError('serviceStartDate');
                  }
                }}
                onBlur={() => {
                  if (!serviceStartDateInput.trim()) return;
                  const parsed = parseDdMmYyyyToIso(serviceStartDateInput);
                  if (!parsed) {
                    setErrors((prev) => ({
                      ...prev,
                      serviceStartDate: 'Use dd/mm/yyyy format.'
                    }));
                    return;
                  }
                  setServiceStartDate(parsed);
                  setServiceStartDateInput(formatIsoDateForInput(parsed));
                  clearFieldError('serviceStartDate');
                }}
                placeholder="dd/mm/yyyy"
                inputMode="numeric"
                className="flex-1"
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="px-3"
                    aria-label="Pick service start date"
                  >
                    <CalendarDays className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <DateCalendar
                    mode="single"
                    selected={parseDdMmYyyyToDate(serviceStartDateInput)}
                    onSelect={(date) => {
                      if (!date) return;
                      const iso = formatDateToIso(date);
                      setServiceStartDate(iso);
                      setServiceStartDateInput(formatIsoDateForInput(iso));
                      clearFieldError('serviceStartDate');
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            {errors.serviceStartDate && (
              <p className="text-xs text-rose-600">{errors.serviceStartDate}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="contractStartDate" className="text-sm font-medium text-slate-700">
              Contract Start Date <span className="text-rose-600">*</span>
            </Label>
            <div className="flex gap-2">
              <Input
                id="contractStartDate"
                type="text"
                value={contractStartDateInput}
                onChange={(e) => {
                  const nextValue = sanitizeDateInput(e.target.value);
                  setContractStartDateInput(nextValue);
                  if (!nextValue) {
                    setContractStartDate('');
                    return;
                  }
                  const parsed = parseDdMmYyyyToIso(nextValue);
                  if (parsed) {
                    setContractStartDate(parsed);
                    clearFieldError('contractStartDate');
                  }
                }}
                onBlur={() => {
                  if (!contractStartDateInput.trim()) return;
                  const parsed = parseDdMmYyyyToIso(contractStartDateInput);
                  if (!parsed) {
                    setErrors((prev) => ({
                      ...prev,
                      contractStartDate: 'Use dd/mm/yyyy format.'
                    }));
                    return;
                  }
                  setContractStartDate(parsed);
                  setContractStartDateInput(formatIsoDateForInput(parsed));
                  clearFieldError('contractStartDate');
                }}
                placeholder="dd/mm/yyyy"
                inputMode="numeric"
                className="flex-1"
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="px-3"
                    aria-label="Pick contract start date"
                  >
                    <CalendarDays className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <DateCalendar
                    mode="single"
                    selected={parseDdMmYyyyToDate(contractStartDateInput)}
                    onSelect={(date) => {
                      if (!date) return;
                      const iso = formatDateToIso(date);
                      setContractStartDate(iso);
                      setContractStartDateInput(formatIsoDateForInput(iso));
                      clearFieldError('contractStartDate');
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            {errors.contractStartDate && (
              <p className="text-xs text-rose-600">{errors.contractStartDate}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="contractEndDate" className="text-sm font-medium text-slate-700">
              Contract End Date <span className="text-rose-600">*</span>
            </Label>
            <div className="flex gap-2">
              <Input
                id="contractEndDate"
                type="text"
                value={contractEndDateInput}
                onChange={(e) => {
                  const nextValue = sanitizeDateInput(e.target.value);
                  setContractEndDateInput(nextValue);
                  if (!nextValue) {
                    setContractEndDate('');
                    return;
                  }
                  const parsed = parseDdMmYyyyToIso(nextValue);
                  if (parsed) {
                    setContractEndDate(parsed);
                    clearFieldError('contractEndDate');
                  }
                }}
                onBlur={() => {
                  if (!contractEndDateInput.trim()) return;
                  const parsed = parseDdMmYyyyToIso(contractEndDateInput);
                  if (!parsed) {
                    setErrors((prev) => ({
                      ...prev,
                      contractEndDate: 'Use dd/mm/yyyy format.'
                    }));
                    return;
                  }
                  setContractEndDate(parsed);
                  setContractEndDateInput(formatIsoDateForInput(parsed));
                  clearFieldError('contractEndDate');
                }}
                placeholder="dd/mm/yyyy"
                inputMode="numeric"
                className="flex-1"
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="px-3"
                    aria-label="Pick contract end date"
                  >
                    <CalendarDays className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <DateCalendar
                    mode="single"
                    selected={parseDdMmYyyyToDate(contractEndDateInput)}
                    onSelect={(date) => {
                      if (!date) return;
                      const iso = formatDateToIso(date);
                      setContractEndDate(iso);
                      setContractEndDateInput(formatIsoDateForInput(iso));
                      clearFieldError('contractEndDate');
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            {errors.contractEndDate && (
              <p className="text-xs text-rose-600">{errors.contractEndDate}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="installationDate" className="text-sm font-medium text-slate-700">
              Installation Date <span className="text-rose-600">*</span>
            </Label>
            <div className="flex gap-2">
              <Input
                id="installationDate"
                type="text"
                value={installationDateInput}
                onChange={(e) => {
                  const nextValue = sanitizeDateInput(e.target.value);
                  setInstallationDateInput(nextValue);
                  if (!nextValue) {
                    setInstallationDate('');
                    return;
                  }
                  const parsed = parseDdMmYyyyToIso(nextValue);
                  if (parsed) {
                    setInstallationDate(parsed);
                    clearFieldError('installationDate');
                  }
                }}
                onBlur={() => {
                  if (!installationDateInput.trim()) return;
                  const parsed = parseDdMmYyyyToIso(installationDateInput);
                  if (!parsed) {
                    setErrors((prev) => ({
                      ...prev,
                      installationDate: 'Use dd/mm/yyyy format.'
                    }));
                    return;
                  }
                  setInstallationDate(parsed);
                  setInstallationDateInput(formatIsoDateForInput(parsed));
                  clearFieldError('installationDate');
                }}
                placeholder="dd/mm/yyyy"
                inputMode="numeric"
                className="flex-1"
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="px-3"
                    aria-label="Pick installation date"
                  >
                    <CalendarDays className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <DateCalendar
                    mode="single"
                    selected={parseDdMmYyyyToDate(installationDateInput)}
                    onSelect={(date) => {
                      if (!date) return;
                      const iso = formatDateToIso(date);
                      setInstallationDate(iso);
                      setInstallationDateInput(formatIsoDateForInput(iso));
                      clearFieldError('installationDate');
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            {errors.installationDate && (
              <p className="text-xs text-rose-600">{errors.installationDate}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="ipType" className="text-sm font-medium text-slate-700">
              Assigned IP Type (Static / Dynamic)
            </Label>
            <SearchableSelect
              id="ipType"
              value={ipType}
              onValueChange={(value) => {
                setIpType(value);
                if (value !== 'Static') {
                  clearFieldError('staticIpAddress');
                }
              }}
              options={ipTypeSelectOptions}
              placeholder="Select IP type"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="staticIpAddress" className="text-sm font-medium text-slate-700">
              Static IP Address
              {ipType === 'Static' && <span className="text-rose-600"> *</span>}
            </Label>
            <Input
              id="staticIpAddress"
              value={staticIpAddress}
              onChange={(e) => {
                setStaticIpAddress(e.target.value);
                if (e.target.value.trim()) {
                  clearFieldError('staticIpAddress');
                }
              }}
              placeholder="Static IP address"
            />
            {errors.staticIpAddress && (
              <p className="text-xs text-rose-600">{errors.staticIpAddress}</p>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 px-6 py-6">
        <h4 className="text-sm font-semibold text-slate-600 mb-4 border-l-4 border-indigo-400 pl-3">
          Network and Technical Details
        </h4>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="routerId" className="text-sm font-medium text-slate-700">
              Router / CPE ID
            </Label>
            <Input
              id="routerId"
              value={routerId}
              onChange={(e) => setRouterId(e.target.value)}
              placeholder="Router / CPE ID"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="macAddress" className="text-sm font-medium text-slate-700">
              MAC Address
            </Label>
            <Input
              id="macAddress"
              value={macAddress}
              onChange={(e) => setMacAddress(e.target.value)}
              placeholder="00:11:22:33:44:55"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="onuSerial" className="text-sm font-medium text-slate-700">
              ONU / Modem Serial Number
            </Label>
            <Input
              id="onuSerial"
              value={onuSerial}
              onChange={(e) => setOnuSerial(e.target.value)}
              placeholder="ONU / Modem serial"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vlanPort" className="text-sm font-medium text-slate-700">
              VLAN / Port Number
            </Label>
            <Input
              id="vlanPort"
              value={vlanPort}
              onChange={(e) => setVlanPort(e.target.value)}
              placeholder="VLAN / Port"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="networkZone" className="text-sm font-medium text-slate-700">
              Network Zone / POP
            </Label>
            <Input
              id="networkZone"
              value={networkZone}
              onChange={(e) => setNetworkZone(e.target.value)}
              placeholder="Network zone / POP"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 px-6 py-6">
        <h4 className="text-sm font-semibold text-slate-600 mb-4 border-l-4 border-rose-400 pl-3">
          Billing Information
        </h4>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              First invoice mode is selected when you create invoice from the popup.
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">Currency</Label>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              MMK
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">
              Monthly Subscription Fee
            </Label>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {monthlyFee || '—'}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="installationFee" className="text-sm font-medium text-slate-700">
              Installation Fee <span className="text-rose-600">*</span>
            </Label>
            <Input
              id="installationFee"
              value={installationFee}
              onChange={(e) => {
                const digitsOnly = e.target.value.replace(/\D/g, '');
                setInstallationFee(digitsOnly);
              }}
              placeholder="0"
              inputMode="numeric"
            />
            {errors.installationFee && (
              <p className="text-xs text-rose-600">{errors.installationFee}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="additionalFees" className="text-sm font-medium text-slate-700">
              Additional Services Fees
            </Label>
            <Input
              id="additionalFees"
              value={additionalFees}
              onChange={(e) => {
                const digitsOnly = e.target.value.replace(/\D/g, '');
                setAdditionalFees(digitsOnly);
              }}
              placeholder="0"
              inputMode="numeric"
            />
          </div>
          <>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">
                Collection Service <span className="text-rose-600">*</span>
              </Label>
              <Select
                value={collectionService}
                onValueChange={(value) => setCollectionService(value as 'yes' | 'no')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select collection service" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {collectionService === 'yes' && (
              <div className="space-y-2">
                <Label htmlFor="collectionFee" className="text-sm font-medium text-slate-700">
                  Collection Fees (Monthly) <span className="text-rose-600">*</span>
                </Label>
                <Input
                  id="collectionFee"
                  value={collectionFee}
                  onChange={(e) => {
                    const digitsOnly = e.target.value.replace(/\D/g, '');
                    setCollectionFee(digitsOnly);
                  }}
                  placeholder="0"
                  inputMode="numeric"
                />
                {errors.collectionFee && (
                  <p className="text-xs text-rose-600">{errors.collectionFee}</p>
                )}
              </div>
            )}
          </>
          <div className="space-y-2 md:col-span-2">
            <Label className="text-sm font-medium text-slate-700">
              Discount Promotion Applied?
            </Label>
            <RadioGroup
              value={discountApplied}
              onValueChange={(value) => setDiscountApplied(value as 'yes' | 'no')}
              className="flex flex-wrap gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem id="discount-yes" value="yes" />
                <Label htmlFor="discount-yes">Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem id="discount-no" value="no" />
                <Label htmlFor="discount-no">No</Label>
              </div>
            </RadioGroup>
          </div>
          {discountApplied === 'yes' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="discountAmount" className="text-sm font-medium text-slate-700">
                  Discount Amount
                </Label>
                <Input
                  id="discountAmount"
                  value={discountAmount}
                  onChange={(e) => {
                    const digitsOnly = e.target.value.replace(/\D/g, '');
                    setDiscountAmount(digitsOnly);
                  }}
                  placeholder="0"
                  inputMode="numeric"
                />
                {errors.discountAmount && (
                  <p className="text-xs text-rose-600">{errors.discountAmount}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="discountPeriod" className="text-sm font-medium text-slate-700">
                  Discount Period (Months)
                </Label>
                <Input
                  id="discountPeriod"
                  value={discountPeriod}
                  onChange={(e) => {
                    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 2);
                    setDiscountPeriod(digitsOnly);
                  }}
                  placeholder="e.g. 3"
                  inputMode="numeric"
                />
                {errors.discountPeriod && (
                  <p className="text-xs text-rose-600">{errors.discountPeriod}</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="border-t border-slate-200 px-6 py-6">
        <h4 className="text-sm font-semibold text-slate-600 mb-4 border-l-4 border-indigo-400 pl-3">
          Assign Collector
        </h4>
        <div className="space-y-3 max-w-md">
          <Label htmlFor="assignedCollector" className="text-sm font-medium text-slate-700">
            Collector
          </Label>
          <SearchableSelect
            id="assignedCollector"
            value={newCustomer.collectorId}
            onValueChange={(value) => setNewCustomer({ ...newCustomer, collectorId: value })}
            options={collectorSelectOptions}
            placeholder={
              collectionService === 'no'
                ? 'Collection service is disabled'
                : collectorsLoading
                ? 'Loading collectors...'
                : 'Select collector'
            }
            disabled={
              collectionService === 'no' ||
              collectorsLoading
            }
          />
          {collectionService === 'no' && (
            <p className="text-xs text-slate-500">
              Collector assignment is disabled when collection service is set to No.
            </p>
          )}
          {collectorsError && (
            <p className="text-xs text-rose-600">{collectorsError}</p>
          )}
          {!collectorsLoading && hasFetchedCollectors && collectorSelectOptions.length === 0 && (
            <p className="text-xs text-slate-500">No collectors available.</p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="space-y-6">
        {inlineForm ? (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">New Customer</h1>
              <p className="text-gray-600">Create a new customer record</p>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Customer Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 md:flex-row md:items-center md:justify-between">
                  <span>
                    {draftRestoredAt
                      ? `Draft restored (${formatDisplayDate(draftRestoredAt)}).`
                      : 'This form is auto-saved as draft while you type.'}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      clearCustomerCreateDraft();
                      toast({
                        title: 'Draft cleared',
                        description: 'Saved draft has been removed.'
                      });
                    }}
                  >
                    Clear Draft
                  </Button>
                </div>
                {formContent}
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={saveDraftAndReturnToList}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddCustomer} disabled={isAddingCustomer}>
                    {isAddingCustomer ? 'Adding...' : 'Add Customer'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Customer Management</h1>
              <p className="text-gray-600">Manage your customer database</p>
            </div>
          </div>
        )}

        {!inlineForm && editingCustomer && (
          <Card>
            <CardHeader>
              <CardTitle>Update Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {formContent}
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setEditingCustomer(null)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateCustomer} disabled={isUpdatingCustomer}>
                  {isUpdatingCustomer ? 'Updating...' : 'Update Customer'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!inlineForm && !editingCustomer && (
          <Card>
            <CardHeader>
              <CardTitle>Customers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search customers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <Tabs
                  value={customerTypeFilter}
                  onValueChange={(value) =>
                    setCustomerTypeFilter(value as 'all' | 'individual' | 'business')
                  }
                >
                  <TabsList>
                    <TabsTrigger value="all">All Customers</TabsTrigger>
                    <TabsTrigger value="individual">Individual</TabsTrigger>
                    <TabsTrigger value="business">Business</TabsTrigger>
                  </TabsList>
                </Tabs>
                <Tabs
                  value={customerListView}
                  onValueChange={(value) =>
                    setCustomerListView(value as 'customers' | 'drafts')
                  }
                >
                  <TabsList>
                    <TabsTrigger value="customers">Customers</TabsTrigger>
                    <TabsTrigger value="drafts">
                      Drafts ({customerListDrafts.length})
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {customersLoading && (
                <div className="mb-4 text-sm text-slate-500">Loading customers...</div>
              )}
              {customersError && (
                <div className="mb-4 text-sm text-rose-600">{customersError}</div>
              )}
              {customerListView === 'customers' &&
                !customersLoading &&
                hasFetchedCustomers &&
                filteredLiveCustomers.length === 0 &&
                !customersError && (
                  <div className="mb-4 text-sm text-slate-500">No customers found.</div>
                )}
              {customerListView === 'drafts' && filteredDraftRows.length === 0 && (
                <div className="mb-4 text-sm text-slate-500">No drafts found.</div>
              )}

              {customerListView === 'drafts' && filteredDraftRows.length > 0 && (
                <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50/40 p-4">
                  <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-amber-900">
                        Draft Customers ({filteredDraftRows.length})
                      </h3>
                      <p className="text-xs text-amber-800">
                        Continue unfinished customer forms or clear drafts.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleClearAllDraftRows}
                      className="border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      Clear All Drafts
                    </Button>
                  </div>

                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Draft Code</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Contact</TableHead>
                          <TableHead>Saved At</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDraftRows.map((draft) => (
                          <TableRow key={draft.id}>
                            <TableCell>{draft.code || '—'}</TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="font-medium">{draft.name}</div>
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] uppercase tracking-wide"
                                >
                                  Draft
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>{draft.phone}</TableCell>
                            <TableCell>{formatDisplayDate(draft.joinDate)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleContinueDraft(draft.draftId)}
                                >
                                  <Edit className="mr-1 h-4 w-4" />
                                  Continue Draft
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleClearDraftRow(draft.draftId)}
                                  className="text-rose-600 hover:text-rose-700"
                                >
                                  <Trash2 className="mr-1 h-4 w-4" />
                                  Clear
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="space-y-3 md:hidden">
                    {filteredDraftRows.map((draft) => (
                      <Card key={draft.id}>
                        <CardContent className="space-y-3 pt-4">
                          <div>
                            <p className="text-sm text-slate-500">{draft.code || '—'}</p>
                            <p className="text-base font-semibold text-slate-900">{draft.name}</p>
                            <Badge
                              variant="secondary"
                              className="mt-1 text-[10px] uppercase tracking-wide"
                            >
                              Draft
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-700">{draft.phone}</p>
                          <p className="text-xs text-slate-500">
                            Saved: {formatDisplayDate(draft.joinDate)}
                          </p>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => handleContinueDraft(draft.draftId)}
                            >
                              <Edit className="mr-1 h-4 w-4" />
                              Continue
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-rose-600 hover:text-rose-700"
                              onClick={() => handleClearDraftRow(draft.draftId)}
                            >
                              <Trash2 className="mr-1 h-4 w-4" />
                              Clear
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {customerListView === 'customers' && (
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer Code</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>Package</TableHead>
                        <TableHead>Monthly Fee</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Collector</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLiveCustomers.map((customer) => {
                        const customerRow = customer as CustomerListRow;
                        const isDraftRow = Boolean(customerRow.isDraft);
                        const collectionServiceEnabled = isCollectionServiceEnabledForCustomer(customerRow);
                        const collectorValue = customer.collectorId || 'unassigned';
                        const existingInvoice = isDraftRow ? null : latestInvoiceByCustomerId[customer.id];
                        const assignPlaceholder = isAssigningCollector[customer.id]
                          ? 'Assigning...'
                          : collectorsLoading
                          ? 'Loading collectors...'
                          : !collectionServiceEnabled
                          ? 'Collection service off'
                          : 'Assign collector';
                        return (
                          <TableRow key={customer.id}>
                            <TableCell>
                              {customerRow.code || '—'}
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="font-medium">{customer.name}</div>
                                {isDraftRow && (
                                  <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                                    Draft
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center text-sm">
                                <Phone className="h-4 w-4 mr-2 text-gray-400" />
                                {customer.phone}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center text-sm">
                                <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                                {customer.address.length > 30
                                  ? `${customer.address.substring(0, 30)}...`
                                  : customer.address}
                              </div>
                            </TableCell>
                            <TableCell>{customer.package}</TableCell>
                            <TableCell>{customer.monthlyFee || '—'}</TableCell>
                            <TableCell>
                              {isDraftRow ? (
                                <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                                  Draft
                                </Badge>
                              ) : (() => {
                                const statusValue = toSelectStatus(
                                  customer.status as 'active' | 'inactive' | 'enable' | 'disable' | 'takeoff'
                                );
                                const statusClass =
                                  statusValue === 'enable'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : statusValue === 'disable'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200';
                                return (
                                  <Select
                                    value={statusValue}
                                    onValueChange={(value) =>
                                      handleStatusChange(customer.id, value as 'enable' | 'disable' | 'takeoff')
                                    }
                                    disabled={isUpdatingStatus[customer.id]}
                                  >
                                    <SelectTrigger className={`h-8 w-32 ${statusClass}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {userStatusOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                );
                              })()}
                            </TableCell>
                            <TableCell>
                              {isDraftRow ? (
                                <span className="text-xs text-slate-500">—</span>
                              ) : (
                                <div className="min-w-[180px]">
                                  <SearchableSelect
                                    id={`collector-${customer.id}`}
                                    value={collectorValue}
                                    onValueChange={(value) => handleAssignCollector(customer.id, value)}
                                    options={collectorSelectOptionsWithUnassigned}
                                    placeholder={assignPlaceholder}
                                    disabled={
                                      collectorsLoading ||
                                      isAssigningCollector[customer.id] ||
                                      !collectionServiceEnabled
                                    }
                                  />
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                {isDraftRow ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleContinueDraft(customerRow.draftId)}
                                  >
                                    <Edit className="mr-1 h-4 w-4" />
                                    Continue Draft
                                  </Button>
                                ) : (
                                  <>
                                    <Button variant="ghost" size="sm" onClick={() => handleEditCustomer(customer)}>
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        if (existingInvoice) {
                                          openGeneratedInvoiceDialog(existingInvoice);
                                          return;
                                        }
                                        openManualInvoicePrompt(customer.id);
                                      }}
                                      disabled={isGeneratingInvoice[customer.id]}
                                      title={existingInvoice ? 'View invoice' : 'Create invoice'}
                                    >
                                      <FilePlus2 className="mr-1 h-4 w-4" />
                                      {isGeneratingInvoice[customer.id]
                                        ? 'Creating...'
                                        : existingInvoice
                                        ? 'View Invoice'
                                        : 'Invoice'}
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {customerListView === 'customers' && (
                <div className="space-y-4 md:hidden">
                {filteredLiveCustomers.map((customer) => {
                  const customerRow = customer as CustomerListRow;
                  const isDraftRow = Boolean(customerRow.isDraft);
                  const collectionServiceEnabled = isCollectionServiceEnabledForCustomer(customerRow);
                  const collectorValue = customer.collectorId || 'unassigned';
                  const existingInvoice = isDraftRow ? null : latestInvoiceByCustomerId[customer.id];
                  const assignPlaceholder = isAssigningCollector[customer.id]
                    ? 'Assigning...'
                    : collectorsLoading
                    ? 'Loading collectors...'
                    : !collectionServiceEnabled
                    ? 'Collection service off'
                    : 'Assign collector';
                  const statusValue = toSelectStatus(
                    customer.status as 'active' | 'inactive' | 'enable' | 'disable' | 'takeoff'
                  );
                  const statusClass =
                    statusValue === 'enable'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : statusValue === 'disable'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200';
                  return (
                    <Card key={customer.id}>
                      <CardContent className="space-y-3 pt-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm text-slate-500">
                              {customerRow.code || '—'}
                            </p>
                            <p className="text-base font-semibold text-slate-900">{customer.name}</p>
                            {isDraftRow && (
                              <Badge variant="secondary" className="mt-1 text-[10px] uppercase tracking-wide">
                                Draft
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {isDraftRow ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleContinueDraft(customerRow.draftId)}
                              >
                                <Edit className="mr-1 h-4 w-4" />
                                Continue
                              </Button>
                            ) : (
                              <>
                                <Button variant="ghost" size="sm" onClick={() => handleEditCustomer(customer)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    if (existingInvoice) {
                                      openGeneratedInvoiceDialog(existingInvoice);
                                      return;
                                    }
                                    openManualInvoicePrompt(customer.id);
                                  }}
                                  disabled={isGeneratingInvoice[customer.id]}
                                >
                                  <FilePlus2 className="mr-1 h-4 w-4" />
                                  {isGeneratingInvoice[customer.id]
                                    ? 'Creating...'
                                    : existingInvoice
                                    ? 'View Invoice'
                                    : 'Invoice'}
                                </Button>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2 text-sm text-slate-700">
                          <div className="flex items-center">
                            <Phone className="mr-2 h-4 w-4 text-slate-400" />
                            {customer.phone}
                          </div>
                          <div className="flex items-start">
                            <MapPin className="mr-2 mt-0.5 h-4 w-4 text-slate-400" />
                            <span>{customer.address}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 text-sm text-slate-600">
                          <span className="rounded-full bg-slate-100 px-3 py-1">
                            {customer.package || 'No package'}
                          </span>
                          <span className="rounded-full bg-slate-100 px-3 py-1">
                            {customer.monthlyFee || '—'}
                          </span>
                        </div>

                        <div className="grid gap-3">
                          <div>
                            <Label className="text-xs text-slate-500">Status</Label>
                            {isDraftRow ? (
                              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                                Draft
                              </div>
                            ) : (
                              <Select
                                value={statusValue}
                                onValueChange={(value) =>
                                  handleStatusChange(customer.id, value as 'enable' | 'disable' | 'takeoff')
                                }
                                disabled={isUpdatingStatus[customer.id]}
                              >
                                <SelectTrigger className={`h-9 w-full ${statusClass}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {userStatusOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>

                          <div>
                            <Label className="text-xs text-slate-500">Collector</Label>
                            {isDraftRow ? (
                              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                                —
                              </div>
                            ) : (
                              <SearchableSelect
                                id={`collector-${customer.id}-mobile`}
                                value={collectorValue}
                                onValueChange={(value) => handleAssignCollector(customer.id, value)}
                                options={collectorSelectOptionsWithUnassigned}
                                placeholder={assignPlaceholder}
                                disabled={
                                  collectorsLoading ||
                                  isAssigningCollector[customer.id] ||
                                  !collectionServiceEnabled
                                }
                              />
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {!inlineForm && (
          <Dialog
            open={postCreateInvoicePromptOpen}
            onOpenChange={(open) => {
              if (!open) {
                closePostCreateInvoicePrompt();
              } else {
                setPostCreateInvoicePromptOpen(true);
              }
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create First Invoice</DialogTitle>
                <DialogDescription>
                  {(postCreatePromptCustomer?.name || postCreateInvoiceCustomerId)
                    ? `Customer ${
                        postCreatePromptCustomer?.name || postCreateInvoiceCustomerId
                      } was created successfully. Do you want to create invoice now or later?`
                    : 'Customer was created successfully. Do you want to create invoice now or later?'}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:justify-end">
                <Button variant="outline" onClick={closePostCreateInvoicePrompt}>
                  Later
                </Button>
                <Button onClick={handleCreateInvoiceAfterCustomerCreate}>
                  Create now
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        <Dialog
          open={manualInvoicePromptOpen}
          onOpenChange={(open) => {
            if (!Object.values(isGeneratingInvoice).some(Boolean)) {
              setManualInvoicePromptOpen(open);
              if (!open) {
                setManualInvoiceCustomerId(null);
                setManualInvoiceAdjustmentRows([]);
                setSelectedGlobalAdjustmentIds([]);
                setManualInvoiceSelectedRuleId('');
              }
            }
          }}
        >
          <DialogContent className="inset-0 left-0 top-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none border-0 p-4 sm:rounded-none sm:p-6">
            {(() => {
              const selectedCustomer = manualInvoiceCustomerId
                ? customersSource.find((item) => item.id === manualInvoiceCustomerId)
                : null;
              const selectedCustomerSummary = manualInvoiceCustomerId
                ? customerSummaryById[manualInvoiceCustomerId]
                : null;
              const selectedCustomerProfile = manualInvoiceCustomerId
                ? customerProfileById[manualInvoiceCustomerId]
                : null;
              const cachedCustomerBillingInfo = resolveCustomerBillingFeeCache({
                customerId: manualInvoiceCustomerId,
                customerCode:
                  (selectedCustomer as Customer & { code?: string } | null)?.code ??
                  selectedCustomerSummary?.customerCode ??
                  selectedCustomerSummary?.code ??
                  null,
                customerPhone:
                  selectedCustomer?.phone ??
                  selectedCustomerSummary?.primaryPhone ??
                  selectedCustomerSummary?.contactInformation?.primaryPhone ??
                  null
              });
              const selectedCustomerBillingInfo =
                selectedCustomerProfile?.billingInformation ??
                selectedCustomerProfile?.billingInfo ??
                selectedCustomerProfile?.billing ??
                selectedCustomerSummary?.billingInformation ??
                selectedCustomerSummary?.billingInfo ??
                selectedCustomerSummary?.billing ??
                selectedCustomerSummary?.customer?.billingInformation ??
                {};
              const customerCode = (selectedCustomer as Customer & { code?: string } | null)?.code || '—';
              const customerName = selectedCustomer?.name || 'Unknown';
              const customerPhone = selectedCustomer?.phone || '—';
              const customerAddress = selectedCustomer?.address || '—';
              const packageCode = selectedCustomer?.package || '—';
              const currency = 'MMK';
              const monthlyAmount = toNumber(
                selectedCustomerBillingInfo?.monthlySubscriptionFee ??
                cachedCustomerBillingInfo?.monthlySubscriptionFee ??
                selectedCustomerSummary?.billingInformation?.monthlySubscriptionFee ??
                selectedCustomerSummary?.billing?.monthlySubscriptionFee ??
                selectedCustomer?.monthlyFee
              );
              const installationAmount = toNumber(
                selectedCustomerBillingInfo?.installationFee ??
                cachedCustomerBillingInfo?.installationFee ??
                selectedCustomerSummary?.billingInformation?.installationFee ??
                selectedCustomerSummary?.billing?.installationFee ??
                selectedCustomerSummary?.installationFee
              );
              const additionalAmount = toNumber(
                selectedCustomerBillingInfo?.additionalFees ??
                cachedCustomerBillingInfo?.additionalFees ??
                selectedCustomerSummary?.billingInformation?.additionalFees ??
                selectedCustomerSummary?.billing?.additionalFees ??
                selectedCustomerSummary?.additionalFees
              );
              const normalizedRuleBillingMode = String(selectedManualInvoiceRule?.billingMode ?? '')
                .trim()
                .toLowerCase();
              const resolvedCustomMonths = (() => {
                const direct = Number.parseInt(selectedManualInvoiceRule?.customMonths || '', 10);
                if (Number.isFinite(direct) && direct > 0) return direct;
                return inferCustomMonthsFromRuleName(selectedManualInvoiceRule?.name) ?? 1;
              })();
              const hasCustomMode =
                normalizedRuleBillingMode.includes('custom') ||
                inferCustomMonthsFromRuleName(selectedManualInvoiceRule?.name) !== null;
              const billingCycleMonths = (() => {
                if (normalizedRuleBillingMode.includes('quarter')) return 3;
                if (normalizedRuleBillingMode.includes('yearly') || normalizedRuleBillingMode.includes('annual'))
                  return 12;
                if (
                  normalizedRuleBillingMode === 'bi-yearly' ||
                  normalizedRuleBillingMode === 'bi_yearly' ||
                  normalizedRuleBillingMode === 'biyearly' ||
                  normalizedRuleBillingMode === 'semiannual' ||
                  normalizedRuleBillingMode === 'semi-annual'
                ) {
                  return 6;
                }
                if (hasCustomMode) {
                  return resolvedCustomMonths;
                }
                return 1;
              })();
              const contractAnchorDate =
                parseIsoDateOnly(
                  selectedCustomerSummary?.subscription?.contractStartDate ??
                    selectedCustomerSummary?.services?.contractStartDate ??
                    selectedCustomerSummary?.contractStartDate ??
                    selectedCustomerSummary?.subscription?.serviceStartDate ??
                    selectedCustomerSummary?.services?.serviceStartDate ??
                    null
                ) ?? null;
              const resolvedFixedStartDay = (() => {
                const parsed = Number.parseInt(String(selectedManualInvoiceRule?.fixedBillingDay ?? ''), 10);
                if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 31) return parsed;
                return fixedBillingWindow.startDay;
              })();
              const isFixedRule = selectedManualInvoiceRule?.billingType === 'fixed';
              const cycleAmount =
                isFixedRule && contractAnchorDate
                  ? (() => {
                      const nextCycleStart = getNextFixedCycleStartDate(
                        contractAnchorDate,
                        resolvedFixedStartDay
                      );
                      const firstPeriodEnd = new Date(nextCycleStart);
                      firstPeriodEnd.setDate(firstPeriodEnd.getDate() - 1);
                      const proratedDays = daysBetweenInclusive(contractAnchorDate, firstPeriodEnd);
                      const monthDays = daysInMonth(contractAnchorDate);
                      return (monthlyAmount * proratedDays) / monthDays;
                    })()
                  : monthlyAmount * billingCycleMonths;
              const adjustmentPreviewRows = manualInvoiceAdjustmentRows.map((row, index) => {
                const value = toNumber(row.value);
                const baseForPercent = cycleAmount + installationAmount + additionalAmount;
                const calculatedAmount =
                  row.valueType === 'percent' ? (baseForPercent * value) / 100 : value;
                return {
                  ...row,
                  rowNo: index + 2 + (installationAmount > 0 ? 1 : 0) + (additionalAmount > 0 ? 1 : 0),
                  calculatedAmount
                };
              });
              const plusTotal = adjustmentPreviewRows
                .filter((row) => row.type === 'plus')
                .reduce((sum, row) => sum + row.calculatedAmount, 0);
              const minusTotal = adjustmentPreviewRows
                .filter((row) => row.type === 'minus')
                .reduce((sum, row) => sum + row.calculatedAmount, 0);
              const subtotalAmount = cycleAmount + installationAmount + additionalAmount;
              const totalAmount = subtotalAmount + plusTotal - minusTotal;

              return (
                <div className="mx-auto w-full max-w-5xl space-y-4">
                  <DialogHeader>
                    <DialogTitle>Create Invoice</DialogTitle>
                    <DialogDescription>
                      Review customer info and configure invoice details before creating.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="rounded-lg border border-slate-300 bg-white p-5 text-slate-900">
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <h3 className="text-base font-semibold text-slate-900">Customer Information</h3>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Customer Code</Label>
                            <Input value={customerCode} readOnly />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Customer Name</Label>
                            <Input value={customerName} readOnly />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Primary Phone</Label>
                            <Input value={customerPhone} readOnly />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Package Plan</Label>
                            <Input value={packageCode} readOnly />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label className="text-sm font-medium text-slate-700">Installation Address</Label>
                            <Input value={customerAddress} readOnly />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-base font-semibold text-slate-900">Invoice Information</h3>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Invoice Number</Label>
                            <Input value="Auto generated after create" readOnly />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Invoice Date</Label>
                            <Input value={formatDisplayDate(new Date())} readOnly />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label className="text-sm font-medium text-slate-700">Billing Rule (Optional)</Label>
                            <Select
                              value={manualInvoiceSelectedRuleId}
                              onValueChange={setManualInvoiceSelectedRuleId}
                              disabled={billingRulesLoading || activeBillingRules.length === 0}
                            >
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={
                                    billingRulesLoading
                                      ? 'Loading rules...'
                                      : activeBillingRules.length === 0
                                      ? 'No active rules'
                                      : 'Select billing rule (optional)'
                                  }
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {activeBillingRules.map((rule) => (
                                  <SelectItem key={rule.id} value={rule.id}>
                                    {rule.name} ({rule.billingType}, {rule.billingMode})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {billingRulesError && (
                              <p className="text-xs text-rose-600">{billingRulesError}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

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
                            <TableRow>
                              <TableCell>1</TableCell>
                              <TableCell>Monthly Internet Fee</TableCell>
                              <TableCell className="text-right">{billingCycleMonths}</TableCell>
                              <TableCell className="text-right">
                                {formatMoney(monthlyAmount, currency)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatMoney(cycleAmount, currency)}
                              </TableCell>
                            </TableRow>
                            {installationAmount > 0 && (
                              <TableRow>
                                <TableCell>2</TableCell>
                                <TableCell>Installation Fee</TableCell>
                                <TableCell className="text-right">1</TableCell>
                                <TableCell className="text-right">
                                  {formatMoney(installationAmount, currency)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatMoney(installationAmount, currency)}
                                </TableCell>
                              </TableRow>
                            )}
                            {additionalAmount > 0 && (
                              <TableRow>
                                <TableCell>{installationAmount > 0 ? 3 : 2}</TableCell>
                                <TableCell>Additional Fee</TableCell>
                                <TableCell className="text-right">1</TableCell>
                                <TableCell className="text-right">
                                  {formatMoney(additionalAmount, currency)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatMoney(additionalAmount, currency)}
                                </TableCell>
                              </TableRow>
                            )}
                            {adjustmentPreviewRows.map((row, index) => (
                              <TableRow key={`${row.description || 'adjustment'}-${index}`}>
                                <TableCell>{row.rowNo}</TableCell>
                                <TableCell>{row.description || 'Adjustment'}</TableCell>
                                <TableCell className="text-right">1</TableCell>
                                <TableCell className="text-right">
                                  {row.valueType === 'percent'
                                    ? `${toNumber(row.value)}%`
                                    : formatMoney(row.value, currency)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {row.type === 'minus' ? '-' : ''}
                                  {formatMoney(row.calculatedAmount, currency)}
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow>
                              <TableCell colSpan={4} className="text-right font-semibold">
                                Subtotal
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {formatMoney(subtotalAmount, currency)}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell colSpan={4} className="text-right font-semibold">
                                Plus
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {formatMoney(plusTotal, currency)}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell colSpan={4} className="text-right font-semibold">
                                Minus
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {formatMoney(minusTotal, currency)}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell colSpan={4} className="text-right text-base font-bold">
                                Total Amount
                              </TableCell>
                              <TableCell className="text-right text-base font-bold">
                                {formatMoney(totalAmount, currency)}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </div>

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
                          onClick={addSelectedGlobalAdjustmentsToManual}
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
                        <p className="text-xs text-rose-600">{globalAdjustmentsError}</p>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => addManualAdjustmentRow('plus')}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Plus Fee
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => addManualAdjustmentRow('minus')}
                        >
                          <Minus className="mr-2 h-4 w-4" />
                          Add Minus Fee
                        </Button>
                      </div>

                      {manualInvoiceAdjustmentRows.length === 0 ? (
                        <p className="text-xs text-slate-500">
                          No adjustment rows. Add from global list or plus/minus buttons.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {manualInvoiceAdjustmentRows.map((row, index) => (
                            <div key={index} className="rounded-md border border-slate-200 bg-white p-3">
                              <div className="grid gap-3 md:grid-cols-4">
                                <div className="md:col-span-2">
                                  <Label>Description</Label>
                                  <Input
                                    value={row.description}
                                    onChange={(event) =>
                                      updateManualAdjustmentRow(index, 'description', event.target.value)
                                    }
                                    placeholder="e.g. Router Fee / Promo Discount"
                                  />
                                </div>
                                <div>
                                  <Label>Type</Label>
                                  <Select
                                    value={row.type}
                                    onValueChange={(value) =>
                                      updateManualAdjustmentRow(index, 'type', value as AdjustmentType)
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
                                      updateManualAdjustmentRow(
                                        index,
                                        'valueType',
                                        value as AdjustmentValueType
                                      )
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
                                    onChange={(event) =>
                                      updateManualAdjustmentRow(index, 'value', event.target.value)
                                    }
                                  />
                                </div>
                              </div>
                              <div className="mt-3 flex justify-end">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeManualAdjustmentRow(index)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Remove
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>

                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setManualInvoicePromptOpen(false);
                        setManualInvoiceCustomerId(null);
                        setManualInvoiceAdjustmentRows([]);
                        setSelectedGlobalAdjustmentIds([]);
                        setManualInvoiceSelectedRuleId('');
                      }}
                      disabled={manualInvoiceCustomerId ? isGeneratingInvoice[manualInvoiceCustomerId] : false}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={async () => {
                        if (!manualInvoiceCustomerId) return;
                        const invalidRow = manualInvoiceAdjustmentRows.find(
                          (row) => row.description.trim().length === 0 || toNumber(row.value) < 0
                        );
                        if (invalidRow) {
                          toast({
                            title: 'Invalid adjustment',
                            description: 'Each adjustment row needs description and non-negative value.',
                            variant: 'destructive'
                          });
                          return;
                        }
                        await handleGenerateInvoice(
                          manualInvoiceCustomerId,
                          manualInvoiceAdjustmentRows,
                          {
                            ruleId: manualInvoiceSelectedRuleId || undefined,
                            rule: selectedManualInvoiceRule
                          }
                        );
                        setManualInvoicePromptOpen(false);
                        setManualInvoiceCustomerId(null);
                        setManualInvoiceAdjustmentRows([]);
                        setSelectedGlobalAdjustmentIds([]);
                        setManualInvoiceSelectedRuleId('');
                      }}
                      disabled={manualInvoiceCustomerId ? isGeneratingInvoice[manualInvoiceCustomerId] : true}
                    >
                      {manualInvoiceCustomerId && isGeneratingInvoice[manualInvoiceCustomerId]
                        ? 'Creating...'
                        : 'Create Invoice'}
                    </Button>
                  </DialogFooter>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

        <Dialog
          open={generatedInvoiceDialogOpen}
          onOpenChange={(open) => {
            setGeneratedInvoiceDialogOpen(open);
            if (!open) {
              setGeneratedInvoicePreview(null);
              setGeneratedInvoicePaymentMethod('KBZPay');
              setGeneratedInvoiceReceiptNo('');
            }
          }}
        >
          <DialogContent className="inset-0 left-0 top-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none border-0 p-4 sm:rounded-none sm:p-6">
            <DialogHeader>
              <DialogTitle>Invoice Detail</DialogTitle>
              <DialogDescription>
                Newly generated invoice preview.
              </DialogDescription>
            </DialogHeader>
            {generatedInvoicePreview &&
              (() => {
                const invoice = generatedInvoicePreview;
                const customerName =
                  invoice.customer?.personalName ||
                  invoice.customer?.companyName ||
                  'Unknown';
                const packageName =
                  invoice.subscription?.plan?.planName ||
                  invoice.subscription?.plan?.planCode ||
                  '—';
                const currency = invoice.currency || 'MMK';
                return (
                  <div className="space-y-6">
                    <div className="rounded-lg border border-slate-300 bg-white p-5 text-slate-900">
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
                          <p>Invoice No: {invoice.invoiceNo || invoice.id}</p>
                          <p>Invoice Date: {formatDisplayDate(invoice.invoiceDate)}</p>
                          <p>Invoice Type: {formatInvoiceTypeLabel(invoice.invoiceType)}</p>
                          <p>
                            Billing Period:{' '}
                            {formatDisplayDateRange(
                              invoice.billingPeriodFrom,
                              invoice.billingPeriodTo
                            )}
                          </p>
                          <p>Due Date: {formatDisplayDate(invoice.dueDate)}</p>
                        </div>

                        <div className="space-y-1 text-sm">
                          <p className="font-semibold">Customer Information</p>
                          <p>Customer ID: {invoice.customer?.customerCode || '—'}</p>
                          <p>Customer Name: {customerName}</p>
                          <p>Phone No: {invoice.customer?.primaryPhone || '—'}</p>
                          <p>Address: {invoice.customer?.installationAddress || '—'}</p>
                          <p>Package: {packageName}</p>
                        </div>
                      </div>

                      <div className="mt-8">
                        <p className="mb-2 text-sm font-semibold">Charges Details</p>
                        <div className="overflow-x-auto">
                          {(() => {
                            const monthlyFeeAmount = toNumber(invoice.monthlyFee);
                            const installationFeeAmount = toNumber(invoice.installationFee);
                            const additionalFeeAmount = toNumber(invoice.additionalFees);
                            const allAdjustments = invoice.adjustments || [];
                            const isSystemMonthlyOffset = (adjustment: (typeof allAdjustments)[number]) => {
                              const description = String(adjustment.description || '').trim().toLowerCase();
                              if (description !== 'manual monthly fee adjustment') return false;
                              if ((adjustment.type || '').toLowerCase() !== 'minus') return false;
                              return Math.abs(toNumber(adjustment.amount) - monthlyFeeAmount) < 0.01;
                            };
                            const visibleAdjustments = allAdjustments.filter(
                              (adjustment) => !isSystemMonthlyOffset(adjustment)
                            );
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
                                  <TableCell className="text-right">
                                    {formatMoney(row.unitPrice, currency)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatMoney(row.amount, currency)}
                                  </TableCell>
                                </TableRow>
                              ))}
                              {visibleAdjustments.map((adjustment, index) => (
                                <TableRow
                                  key={adjustment.id || `${adjustment.description || 'adjustment'}-${index}`}
                                >
                                  <TableCell>{visibleChargeRows.length + index + 1}</TableCell>
                                  <TableCell>{adjustment.description || 'Adjustment'}</TableCell>
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
                              {(invoice.status || 'unpaid') !== 'paid' && !hasSystemMonthlyOffset && (
                                <>
                                  {displaySubtotal > 0 && (
                                    <TableRow>
                                      <TableCell colSpan={4} className="text-right font-semibold">
                                        Subtotal
                                      </TableCell>
                                      <TableCell className="text-right font-semibold">
                                        {formatMoney(displaySubtotal, currency)}
                                      </TableCell>
                                    </TableRow>
                                  )}
                                  {displayPlus > 0 && (
                                    <TableRow>
                                      <TableCell colSpan={4} className="text-right font-semibold">
                                        Plus
                                      </TableCell>
                                      <TableCell className="text-right font-semibold">
                                        {formatMoney(displayPlus, currency)}
                                      </TableCell>
                                    </TableRow>
                                  )}
                                  {displayMinus > 0 && (
                                    <TableRow>
                                      <TableCell colSpan={4} className="text-right font-semibold">
                                        Minus
                                      </TableCell>
                                      <TableCell className="text-right font-semibold">
                                        {formatMoney(displayMinus, currency)}
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </>
                              )}
                              <TableRow>
                                <TableCell colSpan={4} className="text-right text-base font-bold">
                                  Total Amount
                                </TableCell>
                                <TableCell className="text-right text-base font-bold">
                                  {formatMoney(hasSystemMonthlyOffset ? displayTotal : invoice.totalAmount, currency)}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                            );
                          })()}
                        </div>
                      </div>

                      <div className="mt-8 space-y-1 text-sm">
                        <p className="font-semibold">Payment Information</p>
                        <p>Payment Method: {invoice.paymentMethod || '—'}</p>
                        <p>Payment Status: {invoice.status || 'unpaid'}</p>
                        <p>
                          Payment Date:{' '}
                          {formatDisplayDate(invoice.paidAt, '__________')}
                        </p>
                        <p>Receipt No: {invoice.receiptNo || '__________'}</p>
                      </div>

                      <div className="mt-8 space-y-1 text-sm">
                        <p className="font-semibold">Notes / Terms</p>
                        <p>Please pay before the due date to avoid service suspension.</p>
                        <p>No refund after billing period started.</p>
                        <p>This is a system-generated invoice.</p>
                      </div>

                      {(invoice.status || 'unpaid') !== 'paid' && (
                        <div className="mt-8 rounded-md border border-slate-200 bg-slate-50 p-4">
                          <p className="mb-3 text-sm font-semibold text-slate-900">Mark Invoice Paid</p>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <Label>Payment Method</Label>
                              <Input
                                value={generatedInvoicePaymentMethod}
                                onChange={(event) =>
                                  setGeneratedInvoicePaymentMethod(event.target.value)
                                }
                                placeholder="KBZPay / Cash / Transfer"
                              />
                            </div>
                            <div>
                              <Label>Receipt No</Label>
                              <Input
                                value={generatedInvoiceReceiptNo}
                                onChange={(event) =>
                                  setGeneratedInvoiceReceiptNo(event.target.value)
                                }
                                placeholder="Optional"
                              />
                            </div>
                          </div>
                          <div className="mt-4 flex justify-end">
                            <Button
                              onClick={handleMarkGeneratedInvoicePaid}
                              disabled={isMarkingGeneratedInvoicePaid}
                            >
                              {isMarkingGeneratedInvoicePaid ? 'Updating...' : 'Mark as Paid'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
