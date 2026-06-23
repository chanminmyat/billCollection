'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/app/components/layout';
import { useAuth } from '@/app/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FilePlus2, Minus, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  DEFAULT_FIXED_BILLING_WINDOW,
  FixedBillingWindow,
  getFixedBillingWindow
} from '@/lib/billing-config';
import { formatDisplayDate, formatDisplayDateRange } from '@/lib/date-format';
import { appendActivityLog } from '@/lib/activity-log';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

type AdjustmentType = 'plus' | 'minus';
type AdjustmentValueType = 'fixed' | 'percent';
type FixedFirstInvoiceChargeMode = 'full_month' | 'prorated';

type CustomerOption = {
  id: string;
  customerCode: string;
  customerName: string;
  phone: string;
  status: string;
  planCode: string;
  planName: string;
  monthlyFee: number;
  currency: string;
  address: string;
};

type BillingRule = {
  id: string;
  name: string;
  billingModel: 'recurring' | 'usage' | 'prepaid' | 'postpaid';
  billingType: 'fixed' | 'anniversary';
  billingMode: string;
  fixedBillingDay?: string;
  dueAfterDays?: string;
  customMonths?: string;
  isActive: boolean;
  version: number;
};

type InvoiceAdjustmentInput = {
  description: string;
  type: AdjustmentType;
  valueType: AdjustmentValueType;
  value: string;
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

const EPSILON = 0.0001;

export default function CreateInvoicePage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [globalAdjustments, setGlobalAdjustments] = useState<GlobalAdjustmentOption[]>([]);
  const [billingRules, setBillingRules] = useState<BillingRule[]>([]);
  const [fixedBillingWindow, setFixedBillingWindow] = useState<FixedBillingWindow>(
    DEFAULT_FIXED_BILLING_WINDOW
  );

  const [customersLoading, setCustomersLoading] = useState(false);
  const [globalAdjustmentsLoading, setGlobalAdjustmentsLoading] = useState(false);
  const [billingRulesLoading, setBillingRulesLoading] = useState(false);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [generatedInvoicePreview, setGeneratedInvoicePreview] = useState<GeneratedInvoice | null>(null);
  const [generatedInvoiceDialogOpen, setGeneratedInvoiceDialogOpen] = useState(false);

  const [customersError, setCustomersError] = useState('');
  const [globalAdjustmentsError, setGlobalAdjustmentsError] = useState('');
  const [billingRulesError, setBillingRulesError] = useState('');

  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [invoiceCreateMode, setInvoiceCreateMode] = useState<'one_time' | 'rule_based'>('one_time');
  const [selectedRuleId, setSelectedRuleId] = useState('');
  const [fixedFirstInvoiceChargeMode, setFixedFirstInvoiceChargeMode] =
    useState<FixedFirstInvoiceChargeMode>('full_month');
  const [includeSubscriptionFeeInOneTime, setIncludeSubscriptionFeeInOneTime] = useState(true);
  const [oneTimeSubscriptionFee, setOneTimeSubscriptionFee] = useState('');
  const [manualMonthlyFee, setManualMonthlyFee] = useState('');
  const [manualInstallationFee, setManualInstallationFee] = useState('0');
  const [manualAdditionalFee, setManualAdditionalFee] = useState('0');
  const [adjustmentRows, setAdjustmentRows] = useState<InvoiceAdjustmentInput[]>([]);
  const [selectedGlobalAdjustmentIds, setSelectedGlobalAdjustmentIds] = useState<string[]>([]);

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

  const activeGlobalAdjustments = useMemo(
    () => globalAdjustments.filter((item) => item.isActive),
    [globalAdjustments]
  );
  const activeBillingRules = useMemo(
    () => billingRules.filter((rule) => rule.isActive),
    [billingRules]
  );
  const selectedRule = useMemo(
    () => activeBillingRules.find((rule) => rule.id === selectedRuleId) ?? null,
    [activeBillingRules, selectedRuleId]
  );
  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
  );

  const filteredCustomers = useMemo(() => {
    const keyword = customerSearch.trim().toLowerCase();
    if (!keyword) return customers;
    return customers.filter((customer) => {
      return (
        customer.customerName.toLowerCase().includes(keyword) ||
        customer.customerCode.toLowerCase().includes(keyword) ||
        customer.phone.toLowerCase().includes(keyword) ||
        customer.planCode.toLowerCase().includes(keyword)
      );
    });
  }, [customerSearch, customers]);

  const selectCustomers = useMemo(() => {
    if (!selectedCustomer) return filteredCustomers;
    if (filteredCustomers.some((customer) => customer.id === selectedCustomer.id)) {
      return filteredCustomers;
    }
    return [selectedCustomer, ...filteredCustomers];
  }, [filteredCustomers, selectedCustomer]);

  const getGlobalAdjustmentKey = (item: GlobalAdjustmentOption, index: number) =>
    item.id ?? `idx-${index}`;

  const openGeneratedInvoiceDialog = (invoice: GeneratedInvoice) => {
    setGeneratedInvoicePreview(invoice);
    setGeneratedInvoiceDialogOpen(true);
  };

  const fetchCustomers = async () => {
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
        throw new Error(data?.message ?? 'Failed to load customers');
      }

      const data = await response.json().catch(() => []);
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.customers)
          ? data.customers
          : Array.isArray(data?.data)
            ? data.data
            : [];

      const normalized: CustomerOption[] = list.map((item: any, index: number) => ({
        id: String(item?.id ?? item?._id ?? index + 1),
        customerCode: String(item?.customerCode ?? ''),
        customerName:
          String(item?.personalName ?? '') ||
          String(item?.companyName ?? '') ||
          String(item?.name ?? 'Unknown Customer'),
        phone: String(item?.primaryPhone ?? item?.phone ?? ''),
        status: String(item?.status ?? item?.userStatus ?? ''),
        planCode: String(
          item?.subscription?.plan?.planCode ??
            item?.services?.packageName ??
            item?.package ??
            ''
        ),
        planName: String(
          item?.subscription?.plan?.planName ??
            item?.services?.packageName ??
            item?.package ??
            ''
        ),
        monthlyFee: toNumber(item?.subscription?.plan?.monthlyFee ?? item?.monthlyFee),
        currency: String(item?.subscription?.plan?.currency ?? 'MMK'),
        address: String(item?.installationAddress ?? '')
      }));

      setCustomers(normalized);
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

      setGlobalAdjustments(normalized);
    } catch (error) {
      setGlobalAdjustments([]);
      setGlobalAdjustmentsError(
        error instanceof Error ? error.message : 'Failed to load global adjustments'
      );
    } finally {
      setGlobalAdjustmentsLoading(false);
    }
  };

  const fetchBillingRules = async () => {
    setBillingRulesLoading(true);
    setBillingRulesError('');

    const normalizeRules = (rawList: any[]) =>
      rawList
        .map((item, index) => {
          const billingModel = String(
            item?.billingModel ?? item?.prepaidPostpaid ?? item?.paymentMode ?? item?.model ?? 'recurring',
          ).toLowerCase();
          const billingType = String(item?.billingType ?? item?.type ?? 'fixed').toLowerCase();
          return {
            id: String(item?.id ?? index + 1),
            name: String(item?.name ?? item?.ruleName ?? `Rule ${index + 1}`),
            billingModel:
              billingModel === 'usage'
                ? 'usage'
                : billingModel === 'prepaid'
                  ? 'prepaid'
                  : billingModel === 'postpaid'
                    ? 'postpaid'
                    : 'recurring',
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

      setBillingRules(normalizeRules(list as any[]));
    } catch (error) {
      setBillingRules([]);
      setBillingRulesError(error instanceof Error ? error.message : 'Failed to load billing rules');
    } finally {
      setBillingRulesLoading(false);
    }
  };

  const refreshAll = async () => {
    await Promise.all([fetchCustomers(), fetchGlobalAdjustments(), fetchBillingRules()]);
  };

  useEffect(() => {
    setFixedBillingWindow(getFixedBillingWindow());
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') {
      refreshAll();
    }
  }, [user?.role]);

  useEffect(() => {
    if (!selectedCustomer) {
      setOneTimeSubscriptionFee('');
      setManualMonthlyFee('');
      setManualInstallationFee('0');
      setManualAdditionalFee('0');
      return;
    }
    setOneTimeSubscriptionFee(String(toNumber(selectedCustomer.monthlyFee)));
    if (invoiceCreateMode === 'one_time') {
      setManualMonthlyFee('0');
      setManualInstallationFee('0');
      setManualAdditionalFee('0');
      return;
    }
    setManualMonthlyFee(String(toNumber(selectedCustomer.monthlyFee)));
    setManualInstallationFee('0');
    setManualAdditionalFee('0');
  }, [selectedCustomer?.id, invoiceCreateMode]);

  const addAdjustmentRow = (type: AdjustmentType) => {
    setAdjustmentRows((prev) => [
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

  const updateAdjustmentRow = <K extends keyof InvoiceAdjustmentInput>(
    index: number,
    key: K,
    value: InvoiceAdjustmentInput[K]
  ) => {
    setAdjustmentRows((prev) =>
      prev.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row))
    );
  };

  const removeAdjustmentRow = (index: number) => {
    setAdjustmentRows((prev) =>
      prev
        .filter((_, rowIndex) => rowIndex !== index)
        .map((row, rowIndex) => ({ ...row, sortOrder: rowIndex }))
    );
  };

  const addSelectedGlobalAdjustments = () => {
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

    setAdjustmentRows((prev) => {
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

  const buildGeneratePayloadFromRule = (rule: BillingRule | null) => {
    if (!rule) return {};

    const normalizedRuleBillingMode = String(rule.billingMode ?? '')
      .trim()
      .toLowerCase();

    const inferredCustomMonthsFromRuleName = (() => {
      const match = String(rule.name ?? '').match(/(\d+)\s*month/i);
      if (!match) return undefined;
      const parsed = Number.parseInt(match[1], 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
    })();

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

    const resolvedFixedStartDay = (() => {
      const parsed = Number.parseInt(String(rule.fixedBillingDay ?? ''), 10);
      if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 31) {
        return parsed;
      }
      return fixedBillingWindow.startDay;
    })();

    return {
      billingRuleId: rule.id,
      billingRuleName: rule.name ?? undefined,
      billingCycle: derivedBillingCycle,
      firstInvoiceMode: rule.billingType === 'anniversary' ? 'anniversary' : 'fixed',
      fixedFirstInvoiceChargeMode:
        rule.billingType === 'fixed' ? fixedFirstInvoiceChargeMode : undefined,
      billingMode: rule.billingMode ?? undefined,
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
        const parsed = Number.parseInt(rule.customMonths || '', 10);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
        return inferredCustomMonthsFromRuleName;
      })(),
      dueAfterDays: (() => {
        const raw = rule.dueAfterDays ?? '';
        if (!raw.trim()) return undefined;
        const parsed = Number.parseInt(raw, 10);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
      })(),
      fixedStartDay: resolvedFixedStartDay,
      fixedDueDay: fixedBillingWindow.dueDay
    };
  };

  const buildDiffAdjustment = (description: string, targetAmount: number, currentAmount: number) => {
    const diff = targetAmount - currentAmount;
    if (Math.abs(diff) < EPSILON) return null;
    return {
      description,
      type: diff > 0 ? 'plus' : 'minus',
      valueType: 'fixed',
      value: String(Math.abs(diff)),
      sortOrder: 0
    } as InvoiceAdjustmentInput;
  };

  const handleCreateInvoice = async () => {
    if (!selectedCustomer) {
      toast({
        title: 'Customer required',
        description: 'Please choose one customer.',
        variant: 'destructive'
      });
      return;
    }

    if (invoiceCreateMode === 'rule_based' && !selectedRule) {
      toast({
        title: 'Billing rule required',
        description: 'Please choose one billing rule for rule-based invoice.',
        variant: 'destructive'
      });
      return;
    }

    const invalidAdjustment = adjustmentRows.find(
      (row) => row.description.trim().length === 0 || toNumber(row.value) < 0
    );
    if (invalidAdjustment) {
      toast({
        title: 'Invalid adjustment',
        description: 'Each adjustment row needs description and non-negative value.',
        variant: 'destructive'
      });
      return;
    }

    if (invoiceCreateMode === 'rule_based' && !manualMonthlyFee.trim()) {
      toast({
        title: 'Monthly fee required',
        description: 'Please enter monthly fee.',
        variant: 'destructive'
      });
      return;
    }

    const oneTimeSubscriptionFeeTarget = toNumber(oneTimeSubscriptionFee);
    const monthlyFeeTarget =
      invoiceCreateMode === 'one_time' ? 0 : toNumber(manualMonthlyFee || '0');
    const installationFeeTarget = toNumber(manualInstallationFee);
    const additionalFeeTarget = toNumber(manualAdditionalFee);
    if (
      oneTimeSubscriptionFeeTarget < 0 ||
      monthlyFeeTarget < 0 ||
      installationFeeTarget < 0 ||
      additionalFeeTarget < 0
    ) {
      toast({
        title: 'Invalid amount',
        description: 'Fee amounts cannot be negative.',
        variant: 'destructive'
      });
      return;
    }

    setIsCreatingInvoice(true);
    try {
      const appliedRule = invoiceCreateMode === 'rule_based' ? selectedRule : null;
      const generatePayload = buildGeneratePayloadFromRule(appliedRule);

      const response = await fetch(
        `${API_BASE_URL}/billing/customers/${selectedCustomer.id}/invoices/generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...generatePayload,
            manualOneTime: invoiceCreateMode === 'one_time'
          })
        }
      );

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

      const autoRows: InvoiceAdjustmentInput[] = [];
      if (invoiceCreateMode === 'one_time') {
        if (includeSubscriptionFeeInOneTime && oneTimeSubscriptionFeeTarget > 0) {
          autoRows.push({
            description: 'Subscription Fee',
            type: 'plus',
            valueType: 'fixed',
            value: String(oneTimeSubscriptionFeeTarget),
            sortOrder: autoRows.length
          });
        }
        if (installationFeeTarget > 0) {
          autoRows.push({
            description: 'Installation Fee',
            type: 'plus',
            valueType: 'fixed',
            value: String(installationFeeTarget),
            sortOrder: autoRows.length
          });
        }
        if (additionalFeeTarget > 0) {
          autoRows.push({
            description: 'Additional Fee',
            type: 'plus',
            valueType: 'fixed',
            value: String(additionalFeeTarget),
            sortOrder: autoRows.length
          });
        }
      } else {
        const autoDiffRows = [
          buildDiffAdjustment(
            'Manual Monthly Fee Adjustment',
            monthlyFeeTarget,
            toNumber(createdInvoice.monthlyFee)
          ),
          buildDiffAdjustment(
            'Manual Installation Fee Adjustment',
            installationFeeTarget,
            toNumber(createdInvoice.installationFee)
          ),
          buildDiffAdjustment(
            'Manual Additional Fee Adjustment',
            additionalFeeTarget,
            toNumber(createdInvoice.additionalFees)
          )
        ].filter((item): item is InvoiceAdjustmentInput => Boolean(item));
        autoRows.push(...autoDiffRows);
      }

      const finalAdjustmentRows = [...autoRows, ...adjustmentRows].map((row, index) => ({
        ...row,
        sortOrder: index
      }));

      if (finalAdjustmentRows.length > 0) {
        const adjustmentResponse = await fetch(
          `${API_BASE_URL}/billing/invoices/${createdInvoice.id}/adjustments`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              adjustments: finalAdjustmentRows.map((row, index) => ({
                description: row.description.trim(),
                type: row.type,
                valueType: row.valueType,
                value: toNumber(row.value),
                rememberForNext: false,
                sortOrder: index
              }))
            })
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
      }

      openGeneratedInvoiceDialog(createdInvoice);
      toast({
        title: 'Invoice created',
        description: 'Manual invoice was created successfully.'
      });

      logAdminActivity(
        'invoice_created',
        'Manual invoice created from create-invoice page.',
        'invoice',
        createdInvoice.id,
        createdInvoice.invoiceNo || createdInvoice.id,
        {
          customerId: selectedCustomer.id,
          customerCode: selectedCustomer.customerCode,
          customerName: selectedCustomer.customerName,
          invoiceMode: invoiceCreateMode,
          ruleId: appliedRule?.id ?? null,
          ruleName: appliedRule?.name ?? null,
          includeSubscriptionFeeInOneTime:
            invoiceCreateMode === 'one_time' ? includeSubscriptionFeeInOneTime : null,
          oneTimeSubscriptionFeeTarget:
            invoiceCreateMode === 'one_time' ? oneTimeSubscriptionFeeTarget : null,
          monthlyFeeTarget,
          installationFeeTarget,
          additionalFeeTarget,
          adjustmentCount: finalAdjustmentRows.length
        }
      );
    } catch (error) {
      toast({
        title: 'Create invoice failed',
        description: error instanceof Error ? error.message : 'Failed to create invoice',
        variant: 'destructive'
      });
    } finally {
      setIsCreatingInvoice(false);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  if (!user || user.role !== 'admin') {
    return <div>Access denied</div>;
  }

  const loadingAny = customersLoading || globalAdjustmentsLoading || billingRulesLoading;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Create Invoice</h1>
            <p className="text-slate-600">
              Manual invoice creation: choose a customer and set invoice amounts before create.
            </p>
          </div>
          <Button variant="outline" onClick={refreshAll} disabled={loadingAny}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loadingAny ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <Tabs
          value="create-invoice"
          onValueChange={(value) => {
            if (value === 'create-invoice') return;
            router.push(`/admin/billing?tab=${encodeURIComponent(value)}`);
          }}
        >
          <TabsList>
            <TabsTrigger value="create-invoice">Create Invoice</TabsTrigger>
            <TabsTrigger value="invoice-list">Invoice List</TabsTrigger>
            <TabsTrigger value="next-engine">Next Invoice Engine</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
          </TabsList>
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle>Customer And Billing Rule</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="customer-search">Find Customer</Label>
              <Input
                id="customer-search"
                placeholder="Search by customer code, name, phone, or package..."
                value={customerSearch}
                onChange={(event) => setCustomerSearch(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Customer</Label>
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder={customersLoading ? 'Loading customers...' : 'Select customer'} />
                </SelectTrigger>
                <SelectContent>
                  {selectCustomers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.customerName} ({customer.customerCode || 'No Code'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {customersError && <p className="text-xs text-rose-600">{customersError}</p>}
            </div>

            <div className="space-y-2">
              <Label>Invoice Type</Label>
              <Select
                value={invoiceCreateMode}
                onValueChange={(value) => setInvoiceCreateMode(value as 'one_time' | 'rule_based')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select invoice type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_time">One-time Manual Invoice</SelectItem>
                  <SelectItem value="rule_based">Rule-based Invoice</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Billing Rule</Label>
              <Select value={selectedRuleId} onValueChange={setSelectedRuleId}>
                <SelectTrigger disabled={invoiceCreateMode !== 'rule_based'}>
                  <SelectValue
                    placeholder={
                      invoiceCreateMode !== 'rule_based'
                        ? 'Not required for one-time invoice'
                        : billingRulesLoading
                          ? 'Loading rules...'
                          : 'Select billing rule'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {activeBillingRules.map((rule) => (
                    <SelectItem key={rule.id} value={rule.id}>
                      {rule.name} • {rule.billingModel}/{rule.billingType}/{rule.billingMode} • v{rule.version}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {billingRulesError && <p className="text-xs text-rose-600">{billingRulesError}</p>}
              {invoiceCreateMode !== 'rule_based' && (
                <p className="text-xs text-slate-500">
                  One-time manual invoice does not require billing rule.
                </p>
              )}
            </div>

            {invoiceCreateMode === 'rule_based' && selectedRule?.billingType === 'fixed' && (
              <div className="space-y-2 md:col-span-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                <Label className="text-sm font-medium text-slate-700">
                  First Invoice Charge Method (Fixed Rule)
                </Label>
                <RadioGroup
                  value={fixedFirstInvoiceChargeMode}
                  onValueChange={(value) =>
                    setFixedFirstInvoiceChargeMode(value as FixedFirstInvoiceChargeMode)
                  }
                  className="space-y-2"
                >
                  <div className="flex items-start gap-2">
                    <RadioGroupItem id="fixed-first-charge-full-month" value="full_month" />
                    <Label htmlFor="fixed-first-charge-full-month" className="font-normal text-sm">
                      Full Month Charge: charge full monthly fee for first invoice.
                    </Label>
                  </div>
                  <div className="flex items-start gap-2">
                    <RadioGroupItem id="fixed-first-charge-prorated" value="prorated" />
                    <Label htmlFor="fixed-first-charge-prorated" className="font-normal text-sm">
                      Prorated Charge: charge from start date to first cycle end date.
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            {(selectedCustomer || selectedRule) && (
              <div className="md:col-span-2 rounded-md border bg-slate-50 p-3 text-sm text-slate-700 space-y-2">
                {selectedCustomer && (
                  <>
                    <p>
                      Customer: <span className="font-semibold">{selectedCustomer.customerName}</span>{' '}
                      ({selectedCustomer.customerCode || 'No Code'})
                    </p>
                    <p>
                      Phone: {selectedCustomer.phone || '—'} | Package:{' '}
                      {selectedCustomer.planName || selectedCustomer.planCode || '—'} | Base monthly:{' '}
                      {formatMoney(selectedCustomer.monthlyFee, selectedCustomer.currency || 'MMK')}
                    </p>
                  </>
                )}
                {selectedRule && (
                  <div className="rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-900">
                    <p>
                      Rule: <span className="font-semibold">{selectedRule.name}</span> (v
                      {selectedRule.version})
                    </p>
                    <p>
                      Model/Type/Mode: {selectedRule.billingModel} / {selectedRule.billingType} /{' '}
                      {selectedRule.billingMode}
                    </p>
                    <p>
                      Billing Day: {selectedRule.fixedBillingDay || '-'} | Due +Days:{' '}
                      {selectedRule.dueAfterDays || '-'} | Custom Months:{' '}
                      {selectedRule.customMonths || '-'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Manual Charge Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              {invoiceCreateMode === 'one_time' && (
                <div className="space-y-2 md:col-span-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="include-subscription-fee-one-time"
                      checked={includeSubscriptionFeeInOneTime}
                      onCheckedChange={(checked) =>
                        setIncludeSubscriptionFeeInOneTime(checked === true)
                      }
                    />
                    <Label
                      htmlFor="include-subscription-fee-one-time"
                      className="text-sm font-medium text-slate-700"
                    >
                      Include subscription fee from customer plan
                    </Label>
                  </div>
                  {includeSubscriptionFeeInOneTime && (
                    <div className="grid gap-2 md:max-w-xs">
                      <Label htmlFor="one-time-subscription-fee">Subscription Fee</Label>
                      <Input
                        id="one-time-subscription-fee"
                        type="number"
                        min="0"
                        step="0.01"
                        value={oneTimeSubscriptionFee}
                        onChange={(event) => setOneTimeSubscriptionFee(event.target.value)}
                        placeholder="0"
                      />
                    </div>
                  )}
                </div>
              )}

              {invoiceCreateMode === 'rule_based' && (
                <div className="space-y-2">
                  <Label htmlFor="manual-monthly-fee">Monthly Fee</Label>
                  <Input
                    id="manual-monthly-fee"
                    type="number"
                    min="0"
                    step="0.01"
                    value={manualMonthlyFee}
                    onChange={(event) => setManualMonthlyFee(event.target.value)}
                    placeholder="0"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="manual-installation-fee">Installation Fee</Label>
                <Input
                  id="manual-installation-fee"
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualInstallationFee}
                  onChange={(event) => setManualInstallationFee(event.target.value)}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="manual-additional-fee">Additional Fee</Label>
                <Input
                  id="manual-additional-fee"
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualAdditionalFee}
                  onChange={(event) => setManualAdditionalFee(event.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

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
                onClick={addSelectedGlobalAdjustments}
                disabled={
                  globalAdjustmentsLoading ||
                  activeGlobalAdjustments.length === 0 ||
                  selectedGlobalAdjustmentIds.length === 0
                }
              >
                Add Selected
              </Button>
            </div>

            {globalAdjustmentsError && <p className="text-xs text-rose-600">{globalAdjustmentsError}</p>}

            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => addAdjustmentRow('plus')}>
                <Plus className="mr-2 h-4 w-4" />
                Add Plus Fee
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => addAdjustmentRow('minus')}
              >
                <Minus className="mr-2 h-4 w-4" />
                Add Minus Fee
              </Button>
            </div>

            {adjustmentRows.length === 0 ? (
              <p className="text-xs text-slate-500">No adjustments added.</p>
            ) : (
              <div className="space-y-3">
                {adjustmentRows.map((row, index) => (
                  <div key={index} className="rounded-md border border-slate-200 p-3">
                    <div className="grid gap-3 md:grid-cols-4">
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
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button type="button" size="sm" variant="ghost" onClick={() => removeAdjustmentRow(index)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            onClick={handleCreateInvoice}
            disabled={
              isCreatingInvoice ||
              !selectedCustomerId ||
              (invoiceCreateMode === 'rule_based' && !selectedRuleId)
            }
          >
            <FilePlus2 className="mr-2 h-4 w-4" />
            {isCreatingInvoice
              ? 'Creating Invoice...'
              : invoiceCreateMode === 'one_time'
                ? 'Create One-time Invoice'
                : 'Create Invoice'}
          </Button>
        </div>

        <Dialog
          open={generatedInvoiceDialogOpen}
          onOpenChange={(open) => {
            setGeneratedInvoiceDialogOpen(open);
            if (!open) {
              setGeneratedInvoicePreview(null);
            }
          }}
        >
          <DialogContent className="inset-0 left-0 top-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none border-0 p-4 sm:rounded-none sm:p-6">
            <DialogHeader>
              <DialogTitle>Invoice Detail</DialogTitle>
              <DialogDescription>Newly created invoice preview.</DialogDescription>
            </DialogHeader>
            {generatedInvoicePreview &&
              (() => {
                const invoice = generatedInvoicePreview;
                const customerName =
                  invoice.customer?.personalName || invoice.customer?.companyName || 'Unknown';
                const packageName =
                  invoice.subscription?.plan?.planName || invoice.subscription?.plan?.planCode || '—';
                const currency = invoice.currency || 'MMK';
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
                            {formatDisplayDateRange(invoice.billingPeriodFrom, invoice.billingPeriodTo)}
                          </p>
                          <p>Period Start Date: {formatDisplayDate(invoice.billingPeriodFrom)}</p>
                          <p>Period End Date: {formatDisplayDate(invoice.billingPeriodTo)}</p>
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
                        </div>
                      </div>
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
