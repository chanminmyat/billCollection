'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Wifi } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

type PackageItem = {
  id?: string;
  planCode: string;
  planName: string;
  bandwidthPlan: string;
  monthlyFee: string;
  currency: 'MMK' | 'USD';
  status: 'active' | 'draft';
};

const initialPackages: PackageItem[] = [];

export default function SuperAdminPackagesPage() {
  const [packages, setPackages] = useState(initialPackages);
  const [planCode, setPlanCode] = useState('');
  const [planName, setPlanName] = useState('');
  const [bandwidthPlan, setBandwidthPlan] = useState('');
  const [monthlyFee, setMonthlyFee] = useState('');
  const [currency, setCurrency] = useState<'MMK' | 'USD'>('MMK');
  const [planStatus, setPlanStatus] = useState<'active' | 'draft'>('active');
  const [isAddingPackage, setIsAddingPackage] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [plansError, setPlansError] = useState('');

  const resetForm = () => {
    setPlanCode('');
    setPlanName('');
    setBandwidthPlan('');
    setMonthlyFee('');
    setCurrency('MMK');
    setPlanStatus('active');
    setEditingIndex(null);
  };

  const openAddDialog = () => {
    resetForm();
    setIsAddingPackage(true);
  };

  const openEditDialog = (index: number) => {
    const plan = packages[index];
    setPlanCode(plan.planCode);
    setPlanName(plan.planName);
    setBandwidthPlan(plan.bandwidthPlan);
    setMonthlyFee(plan.monthlyFee);
    setCurrency(plan.currency);
    setPlanStatus(plan.status);
    setEditingIndex(index);
    setIsAddingPackage(true);
  };

  const normalizePlan = (data: any, fallback: PackageItem): PackageItem => ({
    id: data?.id ?? fallback.id,
    planCode: data?.planCode ?? fallback.planCode,
    planName: data?.planName ?? fallback.planName,
    bandwidthPlan: data?.bandwidthPlan ?? fallback.bandwidthPlan,
    monthlyFee: data?.monthlyFee?.toString?.() ?? fallback.monthlyFee,
    currency: (data?.currency ?? fallback.currency) as 'MMK' | 'USD',
    status: data?.isActive === false ? 'draft' : 'active'
  });

  useEffect(() => {
    let isMounted = true;
    const fetchPlans = async () => {
      setIsLoadingPlans(true);
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
          const message = data?.message ?? 'Failed to load plans.';
          throw new Error(message);
        }

        const data = await response.json().catch(() => []);
        const list = Array.isArray(data) ? data : Array.isArray(data?.plans) ? data.plans : [];
        const normalized = list.map((item: any) =>
          normalizePlan(item, {
            id: item?.id,
            planCode: item?.planCode ?? '',
            planName: item?.planName ?? '',
            bandwidthPlan: item?.bandwidthPlan ?? '',
            monthlyFee: item?.monthlyFee?.toString?.() ?? '0',
            currency: (item?.currency ?? 'MMK') as 'MMK' | 'USD',
            status: item?.isActive === false ? 'draft' : 'active'
          })
        );

        if (isMounted) {
          setPackages(normalized);
        }
      } catch (error) {
        if (isMounted) {
          setPlansError(error instanceof Error ? error.message : 'Failed to load plans.');
          setPackages([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingPlans(false);
        }
      }
    };

    fetchPlans();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSavePlan = async () => {
    if (!planCode.trim() || !planName.trim() || !monthlyFee.trim()) {
      return;
    }
    setIsSaving(true);
    setFormError('');

    const payload: PackageItem = {
      planCode: planCode.trim(),
      planName: planName.trim(),
      bandwidthPlan: bandwidthPlan.trim(),
      monthlyFee: monthlyFee.trim(),
      currency,
      status: planStatus
    };

    try {
      if (editingIndex !== null) {
        const current = packages[editingIndex];
        if (current?.id) {
          const response = await fetch(`${API_BASE_URL}/plans/${current.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              planCode: payload.planCode,
              planName: payload.planName,
              bandwidthPlan: payload.bandwidthPlan || null,
              monthlyFee: Number(payload.monthlyFee) || 0,
              currency: payload.currency,
              isActive: payload.status === 'active'
            })
          });

          if (!response.ok) {
            const data = await response.json().catch(() => null);
            const message = data?.message ?? 'Failed to update plan.';
            throw new Error(message);
          }

          const data = await response.json().catch(() => null);
          const updated = normalizePlan(data, { ...payload, id: current.id });
          setPackages((prev) =>
            prev.map((item, idx) => (idx === editingIndex ? updated : item))
          );
        } else {
          setPackages((prev) =>
            prev.map((item, idx) => (idx === editingIndex ? payload : item))
          );
        }
      } else {
        const response = await fetch(`${API_BASE_URL}/plans`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            planCode: payload.planCode,
            planName: payload.planName,
            bandwidthPlan: payload.bandwidthPlan || null,
            monthlyFee: Number(payload.monthlyFee) || 0,
            currency: payload.currency,
            isActive: payload.status === 'active'
          })
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          const message = data?.message ?? 'Failed to create plan.';
          throw new Error(message);
        }

        const data = await response.json().catch(() => null);
        const created = normalizePlan(data, payload);
        setPackages((prev) => [created, ...prev]);
      }

      resetForm();
      setIsAddingPackage(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to save plan.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">WiFi Packages</h2>
          <p className="text-sm text-slate-500">Plan catalog and pricing rules.</p>
        </div>
        <Button className="bg-slate-900 text-white hover:bg-slate-800" onClick={openAddDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Package
        </Button>
      </div>

      <Dialog
        open={isAddingPackage}
        onOpenChange={(open) => {
          setIsAddingPackage(open);
          if (!open) {
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingIndex !== null ? 'Edit Package' : 'Add Package'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="plan-code">Plan Code</Label>
              <Input
                id="plan-code"
                value={planCode}
                onChange={(event) => setPlanCode(event.target.value)}
                placeholder="PLAN-BASIC-50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-name">Plan Name</Label>
              <Input
                id="plan-name"
                value={planName}
                onChange={(event) => setPlanName(event.target.value)}
                placeholder="Basic Plan"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bandwidth-plan">Bandwidth Plan</Label>
              <Input
                id="bandwidth-plan"
                value={bandwidthPlan}
                onChange={(event) => setBandwidthPlan(event.target.value)}
                placeholder="50/10 Mbps"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthly-fee">Monthly Fee</Label>
              <Input
                id="monthly-fee"
                value={monthlyFee}
                onChange={(event) => setMonthlyFee(event.target.value)}
                placeholder="18000"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MMK">MMK</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={planStatus} onValueChange={(value) => setPlanStatus(value as 'active' | 'draft')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {formError && <p className="text-sm text-rose-600">{formError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingPackage(false)}>
              Cancel
            </Button>
            <Button className="bg-slate-900 text-white hover:bg-slate-800" onClick={handleSavePlan} disabled={isSaving}>
              <Plus className="mr-2 h-4 w-4" />
              {isSaving ? 'Saving...' : editingIndex !== null ? 'Save Changes' : 'Add Package'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {isLoadingPlans && (
          <div className="col-span-full text-sm text-slate-500">Loading plans...</div>
        )}
        {plansError && (
          <div className="col-span-full text-sm text-rose-600">{plansError}</div>
        )}
        {!isLoadingPlans && !plansError && packages.length === 0 && (
          <div className="col-span-full text-sm text-slate-500">No plans found.</div>
        )}
        {packages.map((item, index) => (
          <Card key={item.planCode}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">{item.planName}</CardTitle>
                <p className="text-xs text-slate-500">{item.planCode}</p>
              </div>
              <Wifi className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-2xl font-semibold text-slate-900">
                {item.monthlyFee} {item.currency}
              </div>
              <div className="text-sm text-slate-500">
                {item.bandwidthPlan || '-'}
              </div>
              <div className="flex items-center justify-between">
                <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
                  {item.status}
                </Badge>
                <Button variant="ghost" size="sm" onClick={() => openEditDialog(index)}>
                  Edit
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
