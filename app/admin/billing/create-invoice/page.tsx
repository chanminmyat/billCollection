'use client';

import { useEffect, useMemo, useState } from 'react';
import Layout from '@/app/components/layout';
import { useAuth } from '@/app/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
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

type PlanOption = {
  id: string;
  planCode: string;
  planName: string;
  bandwidthPlan?: string;
  monthlyFee?: number;
  currency?: string;
  isActive?: boolean;
};

type PlanCustomer = {
  id: string;
  customerCode: string;
  customerName: string;
  phone: string;
  status: string;
  planCode: string;
  planName: string;
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

export default function CreateInvoicePage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [customers, setCustomers] = useState<PlanCustomer[]>([]);
  const [invoicedCustomerMap, setInvoicedCustomerMap] = useState<Record<string, boolean>>({});
  const [globalAdjustments, setGlobalAdjustments] = useState<GlobalAdjustmentOption[]>([]);
  const [billingRules, setBillingRules] = useState<BillingRule[]>([]);

  const [plansLoading, setPlansLoading] = useState(false);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [globalAdjustmentsLoading, setGlobalAdjustmentsLoading] = useState(false);
  const [billingRulesLoading, setBillingRulesLoading] = useState(false);
  const [isCreatingInvoices, setIsCreatingInvoices] = useState(false);
  const [generatedInvoicePreview, setGeneratedInvoicePreview] = useState<GeneratedInvoice | null>(null);
  const [generatedInvoiceDialogOpen, setGeneratedInvoiceDialogOpen] = useState(false);

  const [plansError, setPlansError] = useState('');
  const [customersError, setCustomersError] = useState('');
  const [invoicesError, setInvoicesError] = useState('');
  const [globalAdjustmentsError, setGlobalAdjustmentsError] = useState('');
  const [billingRulesError, setBillingRulesError] = useState('');

  const [selectedPlanCode, setSelectedPlanCode] = useState('');
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState('');
  const [fixedBillingWindow, setFixedBillingWindow] = useState<FixedBillingWindow>(
    DEFAULT_FIXED_BILLING_WINDOW
  );

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

  const activePlans = useMemo(
    () => plans.filter((plan) => plan.isActive !== false && plan.planCode),
    [plans]
  );
  const activeGlobalAdjustments = useMemo(
    () => globalAdjustments.filter((item) => item.isActive),
    [globalAdjustments]
  );
  const activeBillingRules = useMemo(
    () => billingRules.filter((rule) => rule.isActive),
    [billingRules]
  );

  const selectedPlan = useMemo(
    () => activePlans.find((plan) => plan.planCode === selectedPlanCode) ?? null,
    [activePlans, selectedPlanCode]
  );
  const selectedRule = useMemo(
    () => activeBillingRules.find((rule) => rule.id === selectedRuleId) ?? null,
    [activeBillingRules, selectedRuleId]
  );

  const customersBySelectedPlan = useMemo(() => {
    if (!selectedPlanCode) return [];
    return customers.filter((customer) => customer.planCode === selectedPlanCode);
  }, [customers, selectedPlanCode]);

  const eligibleCustomers = useMemo(
    () => customersBySelectedPlan.filter((customer) => !invoicedCustomerMap[customer.id]),
    [customersBySelectedPlan, invoicedCustomerMap]
  );

  const selectedEligibleCustomerIds = useMemo(() => {
    const eligibleSet = new Set(eligibleCustomers.map((customer) => customer.id));
    return selectedCustomerIds.filter((id) => eligibleSet.has(id));
  }, [eligibleCustomers, selectedCustomerIds]);

  const getGlobalAdjustmentKey = (item: GlobalAdjustmentOption, index: number) =>
    item.id ?? `idx-${index}`;

  const openGeneratedInvoiceDialog = (invoice: GeneratedInvoice) => {
    setGeneratedInvoicePreview(invoice);
    setGeneratedInvoiceDialogOpen(true);
  };

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
        throw new Error(data?.message ?? 'Failed to load plans');
      }

      const data = await response.json().catch(() => []);
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.plans)
        ? data.plans
        : Array.isArray(data?.data)
        ? data.data
        : [];

      const normalized: PlanOption[] = list.map((item: any, index: number) => ({
        id: String(item?.id ?? item?._id ?? index + 1),
        planCode: String(item?.planCode ?? ''),
        planName: String(item?.planName ?? item?.name ?? ''),
        bandwidthPlan: item?.bandwidthPlan ? String(item.bandwidthPlan) : undefined,
        monthlyFee: Number(item?.monthlyFee ?? 0),
        currency: item?.currency ? String(item.currency) : 'MMK',
        isActive: item?.isActive !== false
      }));

      setPlans(normalized);
    } catch (error) {
      setPlans([]);
      setPlansError(error instanceof Error ? error.message : 'Failed to load plans');
    } finally {
      setPlansLoading(false);
    }
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

      const normalized: PlanCustomer[] = list.map((item: any, index: number) => ({
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
        )
      }));

      setCustomers(normalized);
    } catch (error) {
      setCustomers([]);
      setCustomersError(error instanceof Error ? error.message : 'Failed to load customers');
    } finally {
      setCustomersLoading(false);
    }
  };

  const fetchInvoices = async () => {
    setInvoicesLoading(true);
    setInvoicesError('');
    try {
      const response = await fetch(`${API_BASE_URL}/billing/invoices`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
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

      const mapped: Record<string, boolean> = {};
      for (const item of list as any[]) {
        const customerId = item?.customer?.id;
        if (customerId) {
          mapped[String(customerId)] = true;
        }
      }

      setInvoicedCustomerMap(mapped);
    } catch (error) {
      setInvoicedCustomerMap({});
      setInvoicesError(error instanceof Error ? error.message : 'Failed to load invoices');
    } finally {
      setInvoicesLoading(false);
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
          const billingModel = String(item?.billingModel ?? item?.model ?? 'recurring').toLowerCase();
          const billingType = String(item?.billingType ?? item?.type ?? 'fixed').toLowerCase();
          return {
            id: String(item?.id ?? index + 1),
            name: String(item?.name ?? item?.ruleName ?? `Rule ${index + 1}`),
            billingModel: billingModel === 'usage' ? 'usage' : 'recurring',
            billingType: billingType === 'anniversary' ? 'anniversary' : 'fixed',
            billingMode: String(item?.billingMode ?? item?.cycle ?? 'monthly'),
            fixedBillingDay: String(
              item?.fixedBillingDay ?? item?.config?.fixedBillingDay ?? ''
            ),
            dueAfterDays: String(
              item?.dueAfterDays ?? item?.config?.dueAfterDays ?? ''
            ),
            customMonths: String(
              item?.customMonths ?? item?.config?.customMonths ?? ''
            ),
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

      const normalized = normalizeRules(list as any[]);
      setBillingRules(normalized);
    } catch (error) {
      setBillingRules([]);
      setBillingRulesError(error instanceof Error ? error.message : 'Failed to load billing rules');
    } finally {
      setBillingRulesLoading(false);
    }
  };

  const refreshAll = async () => {
    await Promise.all([
      fetchPlans(),
      fetchCustomers(),
      fetchInvoices(),
      fetchGlobalAdjustments(),
      fetchBillingRules()
    ]);
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
    setSelectedCustomerIds([]);
  }, [selectedPlanCode]);

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

  const toggleCustomerSelection = (customerId: string, checked: boolean) => {
    setSelectedCustomerIds((prev) => {
      if (checked) {
        return Array.from(new Set([...prev, customerId]));
      }
      return prev.filter((id) => id !== customerId);
    });
  };

  const toggleSelectAllEligible = (checked: boolean) => {
    const eligibleIds = eligibleCustomers.map((customer) => customer.id);
    const eligibleSet = new Set(eligibleIds);
    setSelectedCustomerIds((prev) => {
      if (checked) {
        return Array.from(new Set([...prev, ...eligibleIds]));
      }
      return prev.filter((id) => !eligibleSet.has(id));
    });
  };

  const handleCreateInvoices = async () => {
    if (!selectedPlanCode) {
      toast({
        title: 'Plan required',
        description: 'Please choose one plan first.',
        variant: 'destructive'
      });
      return;
    }

    if (selectedEligibleCustomerIds.length === 0) {
      toast({
        title: 'No customers selected',
        description: 'Select at least one eligible customer.',
        variant: 'destructive'
      });
      return;
    }

    if (!selectedRule) {
      toast({
        title: 'Billing rule required',
        description: 'Please select one billing rule. Invoice mode is taken from the selected rule.',
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

    const effectiveInvoiceMode = selectedRule.billingType === 'anniversary' ? 'anniversary' : 'fixed';
    const normalizedRuleBillingMode = String(selectedRule?.billingMode ?? '')
      .trim()
      .toLowerCase();
    const inferredCustomMonthsFromRuleName = (() => {
      const match = String(selectedRule?.name ?? '').match(/(\d+)\s*month/i);
      if (!match) return undefined;
      const parsed = Number.parseInt(match[1], 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
    })();
    const hasCustomMode =
      normalizedRuleBillingMode.includes('custom') || inferredCustomMonthsFromRuleName !== undefined;
    const resolvedFixedStartDay = (() => {
      const parsed = Number.parseInt(String(selectedRule?.fixedBillingDay ?? ''), 10);
      if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 31) {
        return parsed;
      }
      return fixedBillingWindow.startDay;
    })();
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

    setIsCreatingInvoices(true);
    const selectedSet = new Set(selectedEligibleCustomerIds);
    const selectedCustomers = customersBySelectedPlan.filter((customer) =>
      selectedSet.has(customer.id)
    );

    let successCount = 0;
    let adjustmentWarningCount = 0;
    let ruleBindingWarningCount = 0;
    const failed: Array<{ customerName: string; message: string }> = [];
    const createdCustomerIds: string[] = [];
    const createdInvoices: GeneratedInvoice[] = [];

    for (const customer of selectedCustomers) {
      try {
        const response = await fetch(
          `${API_BASE_URL}/billing/customers/${customer.id}/invoices/generate`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              firstInvoiceMode: effectiveInvoiceMode,
              fixedStartDay: resolvedFixedStartDay,
              fixedDueDay: fixedBillingWindow.dueDay,
              billingCycle: derivedBillingCycle,
              billingRuleId: selectedRuleId || undefined,
              billingRuleName: selectedRule?.name ?? undefined,
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
                const parsed = Number.parseInt(selectedRule.customMonths || '', 10);
                if (Number.isFinite(parsed) && parsed > 0) return parsed;
                return inferredCustomMonthsFromRuleName;
              })(),
              dueAfterDays: (() => {
                const raw = selectedRule?.dueAfterDays ?? '';
                if (!raw.trim()) return undefined;
                const parsed = Number.parseInt(raw, 10);
                return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
              })()
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
        const createdInvoiceId = createdInvoice?.id ? String(createdInvoice.id) : '';
        if (createdInvoiceId && adjustmentRows.length > 0) {
          const adjustmentResponse = await fetch(
            `${API_BASE_URL}/billing/invoices/${createdInvoiceId}/adjustments`,
            {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                adjustments: adjustmentRows.map((row, index) => ({
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
            adjustmentWarningCount += 1;
          }
        }

        if (createdInvoiceId && selectedRuleId) {
          const candidates = [
            `${API_BASE_URL}/billing/rules/assign-invoices`,
            `${API_BASE_URL}/billing/rules/${selectedRuleId}/assign-invoices`
          ];
          const payload = {
            ruleId: selectedRuleId,
            invoiceIds: [createdInvoiceId],
            recalculate: true
          };

          let bindSuccess = false;
          let bindErrorMessage = 'Failed to bind billing rule to invoice.';
          for (const url of candidates) {
            const bindResponse = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(payload)
            });

            if (bindResponse.ok) {
              bindSuccess = true;
              break;
            }

            const bindData = await bindResponse.json().catch(() => null);
            bindErrorMessage =
              Array.isArray(bindData?.message)
                ? bindData.message.join(', ')
                : bindData?.message ?? bindErrorMessage;

            if (bindResponse.status !== 404) break;
          }

          if (!bindSuccess) {
            ruleBindingWarningCount += 1;
            throw new Error(bindErrorMessage);
          }
        }

        createdCustomerIds.push(customer.id);
        if (createdInvoice?.id) {
          createdInvoices.push(createdInvoice);
          logAdminActivity(
            'invoice_created',
            'Invoice created from bulk create-invoice page.',
            'invoice',
            createdInvoice.id,
            createdInvoice.invoiceNo || createdInvoice.id,
            {
              customerId: customer.id,
              customerCode: customer.customerCode,
              customerName: customer.customerName,
              planCode: selectedPlanCode,
              invoiceMode: effectiveInvoiceMode
            }
          );
        }
        successCount += 1;
      } catch (error) {
        failed.push({
          customerName: customer.customerName,
          message: error instanceof Error ? error.message : 'Failed to create invoice'
        });
      }
    }

    if (createdCustomerIds.length > 0) {
      setInvoicedCustomerMap((prev) => {
        const next = { ...prev };
        for (const id of createdCustomerIds) {
          next[id] = true;
        }
        return next;
      });
      setSelectedCustomerIds((prev) => prev.filter((id) => !createdCustomerIds.includes(id)));
      await fetchInvoices();
    }

    if (createdInvoices.length > 0) {
      openGeneratedInvoiceDialog(createdInvoices[0]);
    }

    if (failed.length === 0) {
      toast({
        title: 'Invoices created',
        description:
          adjustmentWarningCount > 0 || ruleBindingWarningCount > 0
            ? `${successCount} invoices created. ${adjustmentWarningCount} adjustment apply warning(s), ${ruleBindingWarningCount} rule bind warning(s). Opened first invoice.`
            : `${successCount} invoices created successfully. Opened first invoice.`
      });
      if (successCount > 0) {
        logAdminActivity(
          'bulk_invoice_created',
          'Bulk invoice creation completed.',
          'invoice-batch',
          undefined,
          selectedPlanCode || undefined,
          {
            successCount,
            failedCount: 0,
            adjustmentWarningCount,
            ruleBindingWarningCount,
            selectedRuleId: selectedRuleId || null,
            selectedRuleName: selectedRule?.name || null,
            invoiceMode: effectiveInvoiceMode
          }
        );
      }
    } else if (successCount > 0) {
      toast({
        title: 'Partially completed',
        description: `${successCount} created, ${failed.length} failed.`,
        variant: 'destructive'
      });
      logAdminActivity(
        'bulk_invoice_created_partial',
        'Bulk invoice creation partially completed.',
        'invoice-batch',
        undefined,
        selectedPlanCode || undefined,
        {
          successCount,
          failedCount: failed.length,
          adjustmentWarningCount,
          ruleBindingWarningCount,
          selectedRuleId: selectedRuleId || null,
          selectedRuleName: selectedRule?.name || null,
          invoiceMode: effectiveInvoiceMode
        }
      );
    } else {
      toast({
        title: 'Create failed',
        description: failed[0]?.message ?? 'No invoices were created.',
        variant: 'destructive'
      });
    }

    setIsCreatingInvoices(false);
  };

  if (authLoading) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  if (!user || user.role !== 'admin') {
    return <div>Access denied</div>;
  }

  const allEligibleSelected =
    eligibleCustomers.length > 0 && selectedEligibleCustomerIds.length === eligibleCustomers.length;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Create Invoice</h1>
            <p className="text-slate-600">
              Generate invoices in bulk by plan for customers who do not have invoices yet.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={refreshAll}
            disabled={
              plansLoading ||
              customersLoading ||
              invoicesLoading ||
              globalAdjustmentsLoading ||
              billingRulesLoading
            }
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${
                plansLoading ||
                customersLoading ||
                invoicesLoading ||
                globalAdjustmentsLoading ||
                billingRulesLoading
                  ? 'animate-spin'
                  : ''
              }`}
            />
            Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Plan And Billing Rule</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={selectedPlanCode} onValueChange={setSelectedPlanCode}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={plansLoading ? 'Loading plans...' : 'Select plan'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {activePlans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.planCode}>
                      {plan.planName} ({plan.planCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {plansError && <p className="text-xs text-rose-600">{plansError}</p>}
            </div>

            <div className="space-y-2">
              <Label>Bind Billing Rule</Label>
              <Select value={selectedRuleId} onValueChange={setSelectedRuleId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={billingRulesLoading ? 'Loading rules...' : 'Select rule (optional)'}
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
              {selectedRule ? (
                <p className="text-xs text-blue-600">
                  Invoice mode from rule: <span className="font-medium capitalize">{selectedRule.billingType}</span>
                </p>
              ) : (
                <p className="text-xs text-slate-500">
                  Select a rule. Invoice mode is always taken from the selected rule.
                </p>
              )}
            </div>

            {(selectedPlan || selectedRule) && (
              <div className="md:col-span-2 rounded-md border bg-slate-50 p-3 text-sm text-slate-700 space-y-2">
                {selectedPlan && (
                  <>
                    <p>
                      Selected plan: <span className="font-semibold">{selectedPlan.planName}</span> (
                      {selectedPlan.planCode})
                    </p>
                    <p>
                      Bandwidth: {selectedPlan.bandwidthPlan || '—'} | Monthly fee:{' '}
                      {formatMoney(selectedPlan.monthlyFee, selectedPlan.currency || 'MMK')}
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
            <CardTitle>Adjustments (Optional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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

            {globalAdjustmentsError && (
              <p className="text-xs text-rose-600">{globalAdjustmentsError}</p>
            )}

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

        <Card>
          <CardHeader>
            <CardTitle>Customers By Selected Plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedPlanCode && (
              <p className="text-sm text-slate-500">Select a plan first to list subscribed customers.</p>
            )}
            {selectedPlanCode && (
              <>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="secondary">Total: {customersBySelectedPlan.length}</Badge>
                  <Badge variant="secondary">Eligible: {eligibleCustomers.length}</Badge>
                  <Badge variant="secondary">Selected: {selectedEligibleCustomerIds.length}</Badge>
                </div>

                {customersError && <p className="text-xs text-rose-600">{customersError}</p>}
                {invoicesError && <p className="text-xs text-rose-600">{invoicesError}</p>}
                {customersLoading && (
                  <p className="text-xs text-slate-500">Loading customers...</p>
                )}
                {invoicesLoading && (
                  <p className="text-xs text-slate-500">Checking invoice status...</p>
                )}

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={allEligibleSelected}
                            onCheckedChange={(checked) => toggleSelectAllEligible(checked === true)}
                            disabled={eligibleCustomers.length === 0 || isCreatingInvoices}
                          />
                        </TableHead>
                        <TableHead>Customer Code</TableHead>
                        <TableHead>Customer Name</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Invoice</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customersBySelectedPlan.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-sm text-slate-500">
                            No customers found for this plan.
                          </TableCell>
                        </TableRow>
                      )}
                      {customersBySelectedPlan.map((customer) => {
                        const hasInvoice = Boolean(invoicedCustomerMap[customer.id]);
                        const checked = selectedCustomerIds.includes(customer.id);
                        return (
                          <TableRow key={customer.id}>
                            <TableCell>
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(nextChecked) =>
                                  toggleCustomerSelection(customer.id, nextChecked === true)
                                }
                                disabled={hasInvoice || isCreatingInvoices}
                              />
                            </TableCell>
                            <TableCell>{customer.customerCode || '—'}</TableCell>
                            <TableCell>{customer.customerName}</TableCell>
                            <TableCell>{customer.phone || '—'}</TableCell>
                            <TableCell>{customer.planName || customer.planCode || '—'}</TableCell>
                            <TableCell>
                              {hasInvoice ? (
                                <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                                  Already Created
                                </Badge>
                              ) : (
                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                                  Not Created
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            onClick={handleCreateInvoices}
            disabled={isCreatingInvoices || selectedEligibleCustomerIds.length === 0}
          >
            <FilePlus2 className="mr-2 h-4 w-4" />
            {isCreatingInvoices
              ? 'Creating Invoices...'
              : `Create Invoices (${selectedEligibleCustomerIds.length})`}
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
              <DialogDescription>
                Newly created invoice preview.
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
                          <p>
                            Billing Period:{' '}
                            {formatDisplayDateRange(invoice.billingPeriodFrom, invoice.billingPeriodTo)}
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
                                <TableCell className="text-right">1</TableCell>
                                <TableCell className="text-right">{formatMoney(invoice.monthlyFee, currency)}</TableCell>
                                <TableCell className="text-right">{formatMoney(invoice.monthlyFee, currency)}</TableCell>
                              </TableRow>
                              {toNumber(invoice.installationFee) > 0 && (
                                <TableRow>
                                  <TableCell>2</TableCell>
                                  <TableCell>Installation Fee</TableCell>
                                  <TableCell className="text-right">1</TableCell>
                                  <TableCell className="text-right">{formatMoney(invoice.installationFee, currency)}</TableCell>
                                  <TableCell className="text-right">{formatMoney(invoice.installationFee, currency)}</TableCell>
                                </TableRow>
                              )}
                              {toNumber(invoice.additionalFees) > 0 && (
                                <TableRow>
                                  <TableCell>3</TableCell>
                                  <TableCell>Additional Fee</TableCell>
                                  <TableCell className="text-right">1</TableCell>
                                  <TableCell className="text-right">{formatMoney(invoice.additionalFees, currency)}</TableCell>
                                  <TableCell className="text-right">{formatMoney(invoice.additionalFees, currency)}</TableCell>
                                </TableRow>
                              )}
                              {(invoice.adjustments || []).map((adjustment, index) => (
                                <TableRow
                                  key={adjustment.id || `${adjustment.description || 'adjustment'}-${index}`}
                                >
                                  <TableCell>{index + 4}</TableCell>
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
                              {(invoice.status || 'unpaid') !== 'paid' && (
                                <>
                                  <TableRow>
                                    <TableCell colSpan={4} className="text-right font-semibold">
                                      Subtotal
                                    </TableCell>
                                    <TableCell className="text-right font-semibold">
                                      {formatMoney(invoice.subtotalAmount, currency)}
                                    </TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell colSpan={4} className="text-right font-semibold">
                                      Plus
                                    </TableCell>
                                    <TableCell className="text-right font-semibold">
                                      {formatMoney(invoice.plusAmount, currency)}
                                    </TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell colSpan={4} className="text-right font-semibold">
                                      Minus
                                    </TableCell>
                                    <TableCell className="text-right font-semibold">
                                      {formatMoney(invoice.minusAmount, currency)}
                                    </TableCell>
                                  </TableRow>
                                </>
                              )}
                              <TableRow>
                                <TableCell colSpan={4} className="text-right text-base font-bold">
                                  Total Amount
                                </TableCell>
                                <TableCell className="text-right text-base font-bold">
                                  {formatMoney(invoice.totalAmount, currency)}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
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
