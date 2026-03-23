'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plus, SlidersHorizontal } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

type BillingModel = 'recurring' | 'usage';
type BillingType = 'fixed' | 'anniversary';
type BillingMode = 'monthly' | 'quarterly' | 'bi_yearly' | 'yearly' | 'custom';
type PrepaidMode = 'prepaid' | 'postpaid';
type AdjustmentType = 'plus' | 'minus';
type AdjustmentValueType = 'fixed' | 'percent';
type LateFeeApplyMode = 'once' | 'per_day';

type BillingRuleItem = {
  id?: string;
  name: string;
  billingModel: BillingModel;
  billingType: BillingType;
  billingMode: BillingMode;
  customMonths: string;
  fixedBillingDay: string;
  dueAfterDays: string;
  prepaidPostpaid: PrepaidMode;
  suspendOnOverdue: boolean;
  graceDays: string;
  lateFeeEnabled: boolean;
  lateFeeType: AdjustmentValueType;
  lateFeeApplyMode: LateFeeApplyMode;
  lateFeeValue: string;
  lateFeeTriggerDays: string;
  isActive: boolean;
  version: number;
};

type GlobalAdjustment = {
  id?: string;
  description: string;
  type: AdjustmentType;
  valueType: AdjustmentValueType;
  value: string;
  isActive: boolean;
  sortOrder: number;
};

const initialRule: BillingRuleItem = {
  name: '',
  billingModel: 'recurring',
  billingType: 'fixed',
  billingMode: 'monthly',
  customMonths: '',
  fixedBillingDay: '1',
  dueAfterDays: '14',
  prepaidPostpaid: 'postpaid',
  suspendOnOverdue: true,
  graceDays: '0',
  lateFeeEnabled: false,
  lateFeeType: 'fixed',
  lateFeeApplyMode: 'once',
  lateFeeValue: '0',
  lateFeeTriggerDays: '1',
  isActive: true,
  version: 1
};

export default function SuperAdminBillingRulesPage() {
  const { toast } = useToast();
  const [rules, setRules] = useState<BillingRuleItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [form, setForm] = useState<BillingRuleItem>(initialRule);
  const [globalAdjustments, setGlobalAdjustments] = useState<GlobalAdjustment[]>([]);
  const [adjustmentsLoading, setAdjustmentsLoading] = useState(false);
  const [adjustmentsSaving, setAdjustmentsSaving] = useState(false);
  const [adjustmentsError, setAdjustmentsError] = useState('');
  const [newAdjustmentDescription, setNewAdjustmentDescription] = useState('');
  const [newAdjustmentType, setNewAdjustmentType] = useState<AdjustmentType>('plus');
  const [newAdjustmentValueType, setNewAdjustmentValueType] =
    useState<AdjustmentValueType>('fixed');
  const [newAdjustmentValue, setNewAdjustmentValue] = useState('');
  const [newAdjustmentIsActive, setNewAdjustmentIsActive] = useState(true);

  const normalizeRule = (item: any, fallback: BillingRuleItem): BillingRuleItem => {
    const modelRaw = String(item?.billingModel ?? item?.model ?? fallback.billingModel).toLowerCase();
    const typeRaw = String(item?.billingType ?? item?.type ?? fallback.billingType).toLowerCase();
    const modeRaw = String(item?.billingMode ?? item?.cycle ?? fallback.billingMode).toLowerCase();
    const prepaidRaw = String(
      item?.prepaidPostpaid ?? item?.paymentMode ?? fallback.prepaidPostpaid
    ).toLowerCase();

    return {
      id: item?.id ?? fallback.id,
      name: String(item?.name ?? item?.ruleName ?? fallback.name),
      billingModel: modelRaw === 'usage' ? 'usage' : 'recurring',
      billingType: typeRaw === 'anniversary' ? 'anniversary' : 'fixed',
      billingMode:
        modeRaw === 'quarterly' || modeRaw === 'bi_yearly' || modeRaw === 'yearly' || modeRaw === 'custom'
          ? (modeRaw as BillingMode)
          : 'monthly',
      customMonths: String(item?.customMonths ?? item?.config?.customMonths ?? fallback.customMonths ?? ''),
      fixedBillingDay: String(
        item?.fixedBillingDay ?? item?.config?.fixedBillingDay ?? fallback.fixedBillingDay ?? '1'
      ),
      dueAfterDays: String(
        item?.dueAfterDays ?? item?.config?.dueAfterDays ?? fallback.dueAfterDays ?? '14'
      ),
      prepaidPostpaid: prepaidRaw === 'prepaid' ? 'prepaid' : 'postpaid',
      suspendOnOverdue:
        item?.suspendOnOverdue !== undefined
          ? item.suspendOnOverdue === true
          : fallback.suspendOnOverdue,
      graceDays: String(item?.graceDays ?? item?.config?.graceDays ?? fallback.graceDays ?? '0'),
      lateFeeEnabled:
        item?.lateFeeEnabled !== undefined
          ? item.lateFeeEnabled === true
          : item?.lateFee?.enabled !== undefined
            ? item.lateFee.enabled === true
            : fallback.lateFeeEnabled,
      lateFeeType:
        item?.lateFeeType === 'percent' || item?.lateFee?.type === 'percent' ? 'percent' : 'fixed',
      lateFeeApplyMode:
        item?.lateFeeApplyMode === 'per_day' || item?.lateFee?.applyMode === 'per_day'
          ? 'per_day'
          : 'once',
      lateFeeValue: String(
        item?.lateFeeValue ??
          item?.lateFee?.value ??
          item?.config?.lateFeeValue ??
          fallback.lateFeeValue ??
          '0'
      ),
      lateFeeTriggerDays: String(
        item?.lateFeeTriggerDays ??
          item?.lateFee?.triggerDays ??
          item?.config?.lateFeeTriggerDays ??
          fallback.lateFeeTriggerDays ??
          '1'
      ),
      isActive: item?.isActive !== false,
      version: Number(item?.version ?? fallback.version ?? 1) || 1
    };
  };

  const fetchRules = async () => {
    setIsLoading(true);
    setLoadError('');
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
        : Array.isArray(data?.rules)
          ? data.rules
          : Array.isArray(data?.data)
            ? data.data
            : [];
      const normalized = list.map((item: any) => normalizeRule(item, initialRule));
      setRules(normalized);
    } catch (error) {
      setRules([]);
      setLoadError(error instanceof Error ? error.message : 'Failed to load billing rules');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const normalizeAdjustment = (item: any, index: number): GlobalAdjustment => ({
      id: typeof item?.id === 'string' ? item.id : undefined,
      description: typeof item?.description === 'string' ? item.description : '',
      type: item?.type === 'minus' ? 'minus' : 'plus',
      valueType: item?.valueType === 'percent' ? 'percent' : 'fixed',
      value:
        item?.value === null || item?.value === undefined || Number.isNaN(Number(item.value))
          ? '0'
          : String(item.value),
      isActive: item?.isActive !== false,
      sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item.sortOrder) : index
    });

    const fetchGlobalAdjustments = async () => {
      setAdjustmentsLoading(true);
      setAdjustmentsError('');

      try {
        const response = await fetch(`${API_BASE_URL}/billing/global-adjustments`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.message ?? 'Failed to load global invoice adjustments.');
        }

        const data = await response.json().catch(() => []);
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.adjustments)
            ? data.adjustments
            : [];

        if (!isMounted) return;

        const normalized: GlobalAdjustment[] = (list as any[])
          .map((item: any, index: number) => normalizeAdjustment(item, index))
          .sort((a: GlobalAdjustment, b: GlobalAdjustment) => a.sortOrder - b.sortOrder)
          .map((item: GlobalAdjustment, index: number) => ({ ...item, sortOrder: index }));
        setGlobalAdjustments(normalized);
      } catch (error) {
        if (!isMounted) return;
        setGlobalAdjustments([]);
        setAdjustmentsError(
          error instanceof Error
            ? error.message
            : 'Failed to load global invoice adjustments.'
        );
      } finally {
        if (isMounted) {
          setAdjustmentsLoading(false);
        }
      }
    };

    fetchGlobalAdjustments();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleAddGlobalAdjustment = () => {
    const description = newAdjustmentDescription.trim();
    const numericValue = Number.parseFloat(newAdjustmentValue);

    if (!description) {
      toast({
        title: 'Description required',
        description: 'Please enter a description for this adjustment.',
        variant: 'destructive'
      });
      return;
    }

    if (!Number.isFinite(numericValue) || numericValue < 0) {
      toast({
        title: 'Invalid adjustment value',
        description: 'Value must be a positive number or zero.',
        variant: 'destructive'
      });
      return;
    }

    setGlobalAdjustments((prev) => [
      ...prev,
      {
        description,
        type: newAdjustmentType,
        valueType: newAdjustmentValueType,
        value: String(numericValue),
        isActive: newAdjustmentIsActive,
        sortOrder: prev.length
      }
    ]);

    setNewAdjustmentDescription('');
    setNewAdjustmentValue('');
    setNewAdjustmentType('plus');
    setNewAdjustmentValueType('fixed');
    setNewAdjustmentIsActive(true);
  };

  const handleRemoveGlobalAdjustment = (index: number) => {
    setGlobalAdjustments((prev) =>
      prev.filter((_, itemIndex) => itemIndex !== index).map((item, itemIndex) => ({
        ...item,
        sortOrder: itemIndex
      }))
    );
  };

  const handleGlobalAdjustmentChange = (
    index: number,
    patch: Partial<GlobalAdjustment>
  ) => {
    setGlobalAdjustments((prev) =>
      prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))
    );
  };

  const handleSaveGlobalAdjustments = async () => {
    const normalized = globalAdjustments.map((item, index) => ({
      description: item.description.trim(),
      type: item.type,
      valueType: item.valueType,
      value: Number.parseFloat(item.value),
      isActive: item.isActive,
      sortOrder: index
    }));

    const invalid = normalized.find(
      (item) =>
        !item.description ||
        !Number.isFinite(item.value) ||
        item.value < 0 ||
        (item.valueType === 'percent' && item.value > 100)
    );

    if (invalid) {
      toast({
        title: 'Invalid adjustment rule',
        description:
          'Each adjustment needs a description and valid value. Percent values must be 0 to 100.',
        variant: 'destructive'
      });
      return;
    }

    setAdjustmentsSaving(true);
    setAdjustmentsError('');

    try {
      const response = await fetch(`${API_BASE_URL}/billing/global-adjustments`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          adjustments: normalized
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? 'Failed to save global invoice adjustments.');
      }

      const data = await response.json().catch(() => []);
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.adjustments)
          ? data.adjustments
          : [];

      const normalizedResponse = (list as any[]).map((item: any, index: number) => ({
        id: typeof item?.id === 'string' ? item.id : undefined,
        description: typeof item?.description === 'string' ? item.description : '',
        type: item?.type === 'minus' ? ('minus' as const) : ('plus' as const),
        valueType: item?.valueType === 'percent' ? ('percent' as const) : ('fixed' as const),
        value:
          item?.value === null || item?.value === undefined || Number.isNaN(Number(item.value))
            ? '0'
            : String(item.value),
        isActive: item?.isActive !== false,
        sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item.sortOrder) : index
      }));

      const synced = (normalizedResponse as GlobalAdjustment[])
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item, index) => ({ ...item, sortOrder: index }));

      setGlobalAdjustments(synced);

      toast({
        title: 'Global adjustments saved',
        description: 'These rules will be auto-applied to invoices.'
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to save global invoice adjustments.';
      setAdjustmentsError(message);
      toast({
        title: 'Save failed',
        description: message,
        variant: 'destructive'
      });
    } finally {
      setAdjustmentsSaving(false);
    }
  };

  const openAddDialog = () => {
    setEditingIndex(null);
    setForm(initialRule);
    setSaveError('');
    setIsDialogOpen(true);
  };

  const openEditDialog = (index: number) => {
    setEditingIndex(index);
    setForm(rules[index]);
    setSaveError('');
    setIsDialogOpen(true);
  };

  const toIntegerOrNull = (value: string) => {
    if (!value.trim()) return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setSaveError('Rule name is required.');
      return;
    }
    if (form.billingMode === 'custom' && !form.customMonths.trim()) {
      setSaveError('Custom months is required for custom billing mode.');
      return;
    }
    if (form.billingType === 'fixed' && !form.fixedBillingDay.trim()) {
      setSaveError('Fixed billing day is required for fixed date rules.');
      return;
    }
    if (form.lateFeeEnabled) {
      const lateFeeValue = Number.parseFloat(form.lateFeeValue);
      const lateFeeTriggerDays = Number.parseInt(form.lateFeeTriggerDays, 10);

      if (!Number.isFinite(lateFeeValue) || lateFeeValue < 0) {
        setSaveError('Late fee value must be zero or positive.');
        return;
      }
      if (form.lateFeeType === 'percent' && lateFeeValue > 100) {
        setSaveError('Late fee percent cannot be greater than 100.');
        return;
      }
      if (!Number.isFinite(lateFeeTriggerDays) || lateFeeTriggerDays < 0) {
        setSaveError('Late fee trigger days must be zero or positive.');
        return;
      }
    }

    setIsSaving(true);
    setSaveError('');

    const payloadFull = {
      name: form.name.trim(),
      billingModel: form.billingModel,
      billingType: form.billingType,
      billingMode: form.billingMode,
      customMonths: form.billingMode === 'custom' ? toIntegerOrNull(form.customMonths) : null,
      fixedBillingDay: form.billingType === 'fixed' ? toIntegerOrNull(form.fixedBillingDay) : null,
      dueAfterDays: toIntegerOrNull(form.dueAfterDays),
      prepaidPostpaid: form.prepaidPostpaid,
      suspendOnOverdue: form.suspendOnOverdue,
      graceDays: toIntegerOrNull(form.graceDays) ?? 0,
      lateFeeEnabled: form.lateFeeEnabled,
      lateFeeType: form.lateFeeType,
      lateFeeApplyMode: form.lateFeeApplyMode,
      lateFeeValue: form.lateFeeEnabled ? Number.parseFloat(form.lateFeeValue || '0') : 0,
      lateFeeTriggerDays: form.lateFeeEnabled
        ? toIntegerOrNull(form.lateFeeTriggerDays) ?? 0
        : 0,
      isActive: form.isActive
    };
    const payloadMinimal = {
      name: form.name.trim(),
      billingModel: form.billingModel,
      billingType: form.billingType,
      billingMode: form.billingMode,
      customMonths: form.billingMode === 'custom' ? toIntegerOrNull(form.customMonths) : null,
      fixedBillingDay: form.billingType === 'fixed' ? toIntegerOrNull(form.fixedBillingDay) : null,
      dueAfterDays: toIntegerOrNull(form.dueAfterDays),
      isActive: form.isActive
    };

    try {
      if (editingIndex !== null) {
        const current = rules[editingIndex];
        if (!current) throw new Error('Rule not found.');
        if (!current.id) throw new Error('Rule ID is missing.');

        const candidates = [payloadFull, payloadMinimal];
        let updatedData: any = null;
        let lastError = 'Failed to update billing rule.';

        for (const bodyPayload of candidates) {
          const response = await fetch(`${API_BASE_URL}/billing/rules/${current.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(bodyPayload)
          });

          if (response.ok) {
            updatedData = await response.json().catch(() => null);
            break;
          }

          const data = await response.json().catch(() => null);
          lastError =
            Array.isArray(data?.message)
              ? data.message.join(', ')
              : data?.message ?? lastError;
          if (response.status >= 400 && response.status < 500) {
            continue;
          }
        }

        if (!updatedData) {
          throw new Error(lastError);
        } else {
          const updated = normalizeRule(updatedData, { ...form, id: current.id });
          const nextRules = rules.map((item, index) => (index === editingIndex ? updated : item));
          setRules(nextRules);
        }
      } else {
        const candidates = [payloadFull, payloadMinimal];
        let createdData: any = null;
        let lastError = 'Failed to create billing rule.';

        for (const bodyPayload of candidates) {
          const response = await fetch(`${API_BASE_URL}/billing/rules`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(bodyPayload)
          });

          if (response.ok) {
            createdData = await response.json().catch(() => null);
            break;
          }

          const data = await response.json().catch(() => null);
          lastError =
            Array.isArray(data?.message)
              ? data.message.join(', ')
              : data?.message ?? lastError;
          if (response.status >= 400 && response.status < 500) {
            continue;
          }
        }

        if (!createdData) {
          throw new Error(lastError);
        } else {
          const created = normalizeRule(createdData, form);
          const nextRules = [created, ...rules];
          setRules(nextRules);
        }
      }

      setIsDialogOpen(false);
      setForm(initialRule);
      setEditingIndex(null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save billing rule');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Billing Rules</h2>
          <p className="text-sm text-slate-500">Create reusable billing rule templates for admins.</p>
        </div>
        <Button className="bg-slate-900 text-white hover:bg-slate-800" onClick={openAddDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Rule
        </Button>
      </div>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingIndex(null);
            setForm(initialRule);
            setSaveError('');
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingIndex !== null ? 'Edit Billing Rule' : 'Add Billing Rule'}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2 md:col-span-3">
              <Label>Rule Name</Label>
              <Input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Monthly Fixed - Day 1/15"
              />
            </div>

            <div className="space-y-2">
              <Label>Billing Model</Label>
              <Select
                value={form.billingModel}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, billingModel: value as BillingModel }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recurring">Recurring</SelectItem>
                  <SelectItem value="usage">Usage Based</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Billing Type</Label>
              <Select
                value={form.billingType}
                onValueChange={(value) =>
                  setForm((prev) => {
                    const nextType = value as BillingType;
                    return {
                      ...prev,
                      billingType: nextType,
                      fixedBillingDay:
                        nextType === 'fixed'
                          ? prev.fixedBillingDay || '1'
                          : ''
                    };
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed Date</SelectItem>
                  <SelectItem value="anniversary">Anniversary Date</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Billing Mode</Label>
              <Select
                value={form.billingMode}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, billingMode: value as BillingMode }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="bi_yearly">Bi-yearly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.billingMode === 'custom' && (
              <div className="space-y-2">
                <Label>Custom Months</Label>
                <Input
                  value={form.customMonths}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      customMonths: event.target.value.replace(/\D/g, '').slice(0, 2)
                    }))
                  }
                  placeholder="2"
                  inputMode="numeric"
                />
              </div>
            )}

            {form.billingType === 'fixed' && (
              <div className="space-y-2">
                <Label>Fixed Billing Day</Label>
                <Input
                  value={form.fixedBillingDay}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      fixedBillingDay: event.target.value.replace(/\D/g, '').slice(0, 2)
                    }))
                  }
                  placeholder="1"
                  inputMode="numeric"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Due After Days</Label>
              <Input
                value={form.dueAfterDays}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    dueAfterDays: event.target.value.replace(/\D/g, '').slice(0, 2)
                  }))
                }
                placeholder="14"
                inputMode="numeric"
              />
            </div>

            <div className="space-y-2">
              <Label className="block">Enable Late Fee</Label>
              <div className="flex h-10 items-center">
                <Switch
                  checked={form.lateFeeEnabled}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, lateFeeEnabled: checked }))
                  }
                />
              </div>
            </div>

            {form.lateFeeEnabled && (
              <>
                <div className="space-y-2">
                  <Label>Late Fee Type</Label>
                  <Select
                    value={form.lateFeeType}
                    onValueChange={(value) =>
                      setForm((prev) => ({ ...prev, lateFeeType: value as AdjustmentValueType }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                      <SelectItem value="percent">Percent (%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Late Fee Apply</Label>
                  <Select
                    value={form.lateFeeApplyMode}
                    onValueChange={(value) =>
                      setForm((prev) => ({ ...prev, lateFeeApplyMode: value as LateFeeApplyMode }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="once">One-time</SelectItem>
                      <SelectItem value="per_day">Per-day</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{form.lateFeeType === 'percent' ? 'Late Fee (%)' : 'Late Fee Amount'}</Label>
                  <Input
                    value={form.lateFeeValue}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        lateFeeValue: event.target.value.replace(/[^\d.]/g, '')
                      }))
                    }
                    placeholder={form.lateFeeType === 'percent' ? '5' : '1000'}
                    inputMode="decimal"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Apply Late Fee After Days</Label>
                  <Input
                    value={form.lateFeeTriggerDays}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        lateFeeTriggerDays: event.target.value.replace(/\D/g, '').slice(0, 2)
                      }))
                    }
                    placeholder="1"
                    inputMode="numeric"
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Prepaid / Postpaid</Label>
              <Select
                value={form.prepaidPostpaid}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, prepaidPostpaid: value as PrepaidMode }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prepaid">Prepaid</SelectItem>
                  <SelectItem value="postpaid">Postpaid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Grace Days</Label>
              <Input
                value={form.graceDays}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    graceDays: event.target.value.replace(/\D/g, '').slice(0, 2)
                  }))
                }
                placeholder="0"
                inputMode="numeric"
              />
            </div>

            <div className="space-y-2">
              <Label className="block">Suspend On Overdue</Label>
              <div className="flex h-10 items-center">
                <Switch
                  checked={form.suspendOnOverdue}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, suspendOnOverdue: checked }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="block">Active Rule</Label>
              <div className="flex h-10 items-center">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, isActive: checked }))
                  }
                />
              </div>
            </div>
          </div>

          {saveError && <p className="text-sm text-rose-600">{saveError}</p>}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !form.name.trim() || (form.billingMode === 'custom' && !form.customMonths)}
            >
              {isSaving ? 'Saving...' : editingIndex !== null ? 'Update Rule' : 'Create Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Global Invoice Adjustments (+ / -)</CardTitle>
          <p className="text-sm text-slate-500">
            Configure tax, surcharge, and discount rules. These will auto-apply to invoices.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-12">
            <div className="space-y-1 md:col-span-4">
              <Label>Description</Label>
              <Input
                placeholder="Commercial Tax / Promo Discount"
                value={newAdjustmentDescription}
                onChange={(event) => setNewAdjustmentDescription(event.target.value)}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Type</Label>
              <Select
                value={newAdjustmentType}
                onValueChange={(value) => setNewAdjustmentType(value as AdjustmentType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="plus">Plus (+)</SelectItem>
                  <SelectItem value="minus">Minus (-)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Value Type</Label>
              <Select
                value={newAdjustmentValueType}
                onValueChange={(value) => setNewAdjustmentValueType(value as AdjustmentValueType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Value Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed Amount</SelectItem>
                  <SelectItem value="percent">Percent (%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Value</Label>
              <Input
                placeholder={newAdjustmentValueType === 'percent' ? '5' : '1500'}
                value={newAdjustmentValue}
                onChange={(event) =>
                  setNewAdjustmentValue(event.target.value.replace(/[^\d.]/g, ''))
                }
                inputMode="decimal"
              />
            </div>
            <div className="space-y-1 md:col-span-1">
              <Label>Active</Label>
              <div className="flex h-10 items-center">
                <Switch
                  checked={newAdjustmentIsActive}
                  onCheckedChange={setNewAdjustmentIsActive}
                  aria-label="Toggle adjustment active"
                />
              </div>
            </div>
            <div className="md:col-span-1">
              <Button className="mt-6 w-full" variant="outline" onClick={handleAddGlobalAdjustment}>
                Add
              </Button>
            </div>
          </div>

          {adjustmentsLoading && (
            <p className="text-sm text-slate-500">Loading global adjustments...</p>
          )}
          {adjustmentsError && <p className="text-sm text-rose-600">{adjustmentsError}</p>}

          {!adjustmentsLoading && globalAdjustments.length === 0 && (
            <p className="text-sm text-slate-500">
              No global adjustments configured yet.
            </p>
          )}

          <div className="space-y-2">
            {globalAdjustments.map((item, index) => (
              <div
                key={`${item.id ?? 'new'}-${index}`}
                className="grid gap-3 rounded-md border border-slate-200 p-3 md:grid-cols-12"
              >
                <div className="space-y-1 md:col-span-4">
                  <Label>Description</Label>
                  <Input
                    value={item.description}
                    onChange={(event) =>
                      handleGlobalAdjustmentChange(index, {
                        description: event.target.value
                      })
                    }
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label>Type</Label>
                  <Select
                    value={item.type}
                    onValueChange={(value) =>
                      handleGlobalAdjustmentChange(index, {
                        type: value as AdjustmentType
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="plus">Plus (+)</SelectItem>
                      <SelectItem value="minus">Minus (-)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label>Value Type</Label>
                  <Select
                    value={item.valueType}
                    onValueChange={(value) =>
                      handleGlobalAdjustmentChange(index, {
                        valueType: value as AdjustmentValueType
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                      <SelectItem value="percent">Percent (%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label>Value</Label>
                  <Input
                    value={item.value}
                    onChange={(event) =>
                      handleGlobalAdjustmentChange(index, {
                        value: event.target.value.replace(/[^\d.]/g, '')
                      })
                    }
                    inputMode="decimal"
                  />
                </div>
                <div className="space-y-1 md:col-span-1">
                  <Label>Active</Label>
                  <div className="flex h-10 items-center">
                    <Switch
                      checked={item.isActive}
                      onCheckedChange={(checked) =>
                        handleGlobalAdjustmentChange(index, { isActive: checked })
                      }
                    />
                  </div>
                </div>
                <div className="md:col-span-1">
                  <Button
                    variant="outline"
                    className="mt-6 w-full border-rose-200 text-rose-700 hover:bg-rose-50"
                    onClick={() => handleRemoveGlobalAdjustment(index)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <Button
              className="bg-slate-900 text-white hover:bg-slate-800"
              onClick={handleSaveGlobalAdjustments}
              disabled={adjustmentsSaving || adjustmentsLoading}
            >
              {adjustmentsSaving ? 'Saving...' : 'Save Global Adjustments'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading && <div className="col-span-full text-sm text-slate-500">Loading billing rules...</div>}
        {loadError && <div className="col-span-full text-sm text-rose-600">{loadError}</div>}
        {!isLoading && !loadError && rules.length === 0 && (
          <div className="col-span-full text-sm text-slate-500">No billing rules found.</div>
        )}

        {rules.map((rule, index) => (
          <Card key={rule.id || `${rule.name}-${index}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{rule.name}</CardTitle>
                  <p className="text-xs text-slate-500">Version {rule.version}</p>
                </div>
                <Badge
                  variant={rule.isActive ? 'default' : 'secondary'}
                  className={rule.isActive ? 'bg-emerald-600 text-white' : ''}
                >
                  {rule.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border bg-slate-50 px-2 py-1">
                  <span className="text-xs text-slate-500">Model</span>
                  <p className="font-medium capitalize">{rule.billingModel}</p>
                </div>
                <div className="rounded-md border bg-slate-50 px-2 py-1">
                  <span className="text-xs text-slate-500">Type</span>
                  <p className="font-medium capitalize">{rule.billingType}</p>
                </div>
                <div className="rounded-md border bg-slate-50 px-2 py-1">
                  <span className="text-xs text-slate-500">Mode</span>
                  <p className="font-medium capitalize">{rule.billingMode.replace('_', '-')}</p>
                </div>
                <div className="rounded-md border bg-slate-50 px-2 py-1">
                  <span className="text-xs text-slate-500">Payment</span>
                  <p className="font-medium capitalize">{rule.prepaidPostpaid}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border bg-slate-50 px-2 py-1">
                  <span className="text-xs text-slate-500">Billing Day</span>
                  <p className="font-medium">
                    {rule.billingType === 'anniversary' ? '-' : rule.fixedBillingDay || '-'}
                  </p>
                </div>
                <div className="rounded-md border bg-slate-50 px-2 py-1">
                  <span className="text-xs text-slate-500">Due +Days</span>
                  <p className="font-medium">{rule.dueAfterDays || '-'}</p>
                </div>
                <div className="rounded-md border bg-slate-50 px-2 py-1">
                  <span className="text-xs text-slate-500">Grace Days</span>
                  <p className="font-medium">{rule.graceDays || '0'}</p>
                </div>
                <div className="rounded-md border bg-slate-50 px-2 py-1">
                  <span className="text-xs text-slate-500">Suspend</span>
                  <p className="font-medium">{rule.suspendOnOverdue ? 'Yes' : 'No'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border bg-slate-50 px-2 py-1">
                  <span className="text-xs text-slate-500">Late Fee</span>
                  <p className="font-medium">
                    {rule.lateFeeEnabled
                      ? rule.lateFeeType === 'percent'
                        ? `${rule.lateFeeValue || '0'}%`
                        : rule.lateFeeValue || '0'
                      : 'Disabled'}
                  </p>
                </div>
                <div className="rounded-md border bg-slate-50 px-2 py-1">
                  <span className="text-xs text-slate-500">Late Fee Mode</span>
                  <p className="font-medium">
                    {rule.lateFeeEnabled
                      ? rule.lateFeeApplyMode === 'per_day'
                        ? 'Per-day'
                        : 'One-time'
                      : '-'}
                  </p>
                </div>
                <div className="rounded-md border bg-slate-50 px-2 py-1">
                  <span className="text-xs text-slate-500">Late Trigger</span>
                  <p className="font-medium">
                    {rule.lateFeeEnabled ? `${rule.lateFeeTriggerDays || '0'} day(s)` : '-'}
                  </p>
                </div>
              </div>

              <Button variant="outline" className="w-full" onClick={() => openEditDialog(index)}>
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Edit Rule
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
