'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Pencil, Search } from 'lucide-react';
import {
  COLLECTOR_DASHBOARD_COPY_KEYS,
  COLLECTOR_DASHBOARD_COPY_UPDATED_AT_STORAGE_KEY,
  COLLECTOR_DASHBOARD_COPY_UPDATED_EVENT,
  CollectorDashboardCopy,
  CollectorDashboardCopyKey,
  DEFAULT_COLLECTOR_DASHBOARD_COPY,
  normalizeCollectorDashboardCopy,
} from '@/lib/collector-dashboard-copy';

const API_ROUTE = '/api/reference-data/collector-dashboard-copy';

const toFieldLabel = (key: string) =>
  key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

export default function CollectorDashboardTextsPage() {
  const { toast } = useToast();
  const [activeLanguage, setActiveLanguage] = useState<'en' | 'mm'>('en');
  const [copy, setCopy] = useState<CollectorDashboardCopy>(() => ({
    en: { ...DEFAULT_COLLECTOR_DASHBOARD_COPY.en },
    mm: { ...DEFAULT_COLLECTOR_DASHBOARD_COPY.mm },
  }));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedField, setSelectedField] = useState<CollectorDashboardCopyKey>(
    COLLECTOR_DASHBOARD_COPY_KEYS[0],
  );
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [activeView, setActiveView] = useState<
    'dashboard' | 'assigned_customers' | 'assigned_bills' | 'collected_bills'
  >('dashboard');

  const currentLanguageCopy = activeLanguage === 'mm' ? copy.mm : copy.en;

  const loadCopy = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await fetch(API_ROUTE, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message ?? 'Failed to load collector dashboard texts.');
      }
      setCopy(normalizeCollectorDashboardCopy(data?.copy));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load collector dashboard texts.');
      setCopy({
        en: { ...DEFAULT_COLLECTOR_DASHBOARD_COPY.en },
        mm: { ...DEFAULT_COLLECTOR_DASHBOARD_COPY.mm },
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCopy();
  }, [loadCopy]);

  const filteredKeys = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return COLLECTOR_DASHBOARD_COPY_KEYS;
    return COLLECTOR_DASHBOARD_COPY_KEYS.filter((key) => {
      const value = currentLanguageCopy[key] ?? '';
      return key.toLowerCase().includes(query) || value.toLowerCase().includes(query);
    });
  }, [currentLanguageCopy, search]);

  const handleFieldChange = (key: CollectorDashboardCopyKey, value: string) => {
    setCopy((prev) => ({
      ...prev,
      [activeLanguage]: {
        ...prev[activeLanguage],
        [key]: value,
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(API_ROUTE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ copy }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message ?? 'Failed to save collector dashboard texts.');
      }

      const normalized = normalizeCollectorDashboardCopy(data?.copy);
      setCopy(normalized);

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          COLLECTOR_DASHBOARD_COPY_UPDATED_AT_STORAGE_KEY,
          String(Date.now()),
        );
        window.dispatchEvent(new Event(COLLECTOR_DASHBOARD_COPY_UPDATED_EVENT));
      }

      toast({
        title: 'Updated',
        description: 'Collector dashboard texts have been updated in the system.',
      });
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Failed to save collector dashboard texts.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = () => {
    setCopy({
      en: { ...DEFAULT_COLLECTOR_DASHBOARD_COPY.en },
      mm: { ...DEFAULT_COLLECTOR_DASHBOARD_COPY.mm },
    });
  };

  const renderEditableText = (key: CollectorDashboardCopyKey, className?: string) => (
    <span
      role="button"
      tabIndex={0}
      onClick={() => setSelectedField(key)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setSelectedField(key);
        }
      }}
      className={`inline-flex items-center gap-2 rounded-md px-1 text-left hover:bg-slate-100 ${className ?? ''}`}
      title={`Edit ${toFieldLabel(key)}`}
    >
      <span>{currentLanguageCopy[key] || '-'}</span>
      <Pencil className="h-3.5 w-3.5 text-slate-500" />
    </span>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Manage Collector Dashboard</h2>
          <p className="text-sm text-slate-500">
            Collector-like layout with inline edit buttons. Click any pencil label to edit quickly.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={activeLanguage} onValueChange={(value) => setActiveLanguage(value === 'mm' ? 'mm' : 'en')}>
            <TabsList>
              <TabsTrigger value="en">English</TabsTrigger>
              <TabsTrigger value="mm">Burmese</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" onClick={handleResetToDefault} disabled={saving || loading}>
            Reset To Default
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? 'Updating...' : 'Update System Texts'}
          </Button>
        </div>
      </div>

      {loadError ? <p className="text-sm text-rose-600">{loadError}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-lg">
                <span>Collector Dashboard Preview</span>
                <Badge variant="outline">{activeLanguage === 'mm' ? 'Burmese' : 'English'}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-2xl font-semibold text-slate-900">{renderEditableText('dashboardTitle')}</div>
                  <div className="text-sm text-slate-600">{renderEditableText('welcomeBack')} , Collector</div>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <button
                  type="button"
                  className={`rounded-md border px-3 py-2 text-left text-sm ${
                    activeView === 'dashboard'
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-900'
                  }`}
                  onClick={() => setActiveView('dashboard')}
                >
                  <span className={activeView === 'dashboard' ? 'text-white [&_svg]:text-white' : ''}>
                    {renderEditableText('dashboardTitle')}
                  </span>
                </button>
                <button
                  type="button"
                  className={`rounded-md border px-3 py-2 text-left text-sm ${
                    activeView === 'assigned_customers'
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-900'
                  }`}
                  onClick={() => setActiveView('assigned_customers')}
                >
                  <span className={activeView === 'assigned_customers' ? 'text-white [&_svg]:text-white' : ''}>
                    {renderEditableText('assignedCustomers')}
                  </span>
                </button>
                <button
                  type="button"
                  className={`rounded-md border px-3 py-2 text-left text-sm ${
                    activeView === 'assigned_bills'
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-900'
                  }`}
                  onClick={() => setActiveView('assigned_bills')}
                >
                  <span className={activeView === 'assigned_bills' ? 'text-white [&_svg]:text-white' : ''}>
                    {renderEditableText('dueBills')}
                  </span>
                </button>
                <button
                  type="button"
                  className={`rounded-md border px-3 py-2 text-left text-sm ${
                    activeView === 'collected_bills'
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-900'
                  }`}
                  onClick={() => setActiveView('collected_bills')}
                >
                  <span className={activeView === 'collected_bills' ? 'text-white [&_svg]:text-white' : ''}>
                    {renderEditableText('collected')}
                  </span>
                </button>
              </div>

              {activeView === 'dashboard' && (
                <>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-lg border p-4">
                      <p className="text-xs text-slate-500">{renderEditableText('assignedCustomers')}</p>
                      <p className="mt-1 text-xl font-bold">124</p>
                      <p className="text-xs text-slate-500">{renderEditableText('totalCustomersAssigned')}</p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-xs text-slate-500">{renderEditableText('todaysCollection')}</p>
                      <p className="mt-1 text-xl font-bold">275,000 MMK</p>
                      <p className="text-xs text-slate-500">{renderEditableText('collectedToday')}</p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-xs text-slate-500">{renderEditableText('pendingBills')}</p>
                      <p className="mt-1 text-xl font-bold">22</p>
                      <p className="text-xs text-slate-500">{renderEditableText('billsToCollect')}</p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-xs text-slate-500">{renderEditableText('overdueBills')}</p>
                      <p className="mt-1 text-xl font-bold">5</p>
                      <p className="text-xs text-slate-500">{renderEditableText('requiresImmediateAttention')}</p>
                    </div>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="mb-2 text-sm font-medium">{renderEditableText('dueBills')}</p>
                    <p className="mb-3 text-sm text-slate-500">{renderEditableText('searchCustomersPlaceholder')}</p>
                    <div className="rounded-md border p-3">
                      <p className="text-sm font-medium">{renderEditableText('invoice')}: Apr 2026</p>
                      <p className="text-sm text-slate-600">{renderEditableText('due')}: 30/04/2026</p>
                      <div className="mt-3 flex gap-2">
                        <span className="inline-flex rounded-md border px-2 py-1 text-sm">{renderEditableText('details')}</span>
                        <span className="inline-flex rounded-md bg-slate-900 px-2 py-1 text-sm text-white [&_svg]:text-white">{renderEditableText('collectionFlow')}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeView === 'assigned_customers' && (
                <div className="rounded-lg border p-4">
                  <p className="mb-2 text-sm font-medium">{renderEditableText('assignedCustomers')}</p>
                  <p className="text-sm text-slate-500">{renderEditableText('searchCustomersPlaceholder')}</p>
                  <div className="mt-3 rounded-md border p-3">
                    <p className="text-sm text-slate-600">{renderEditableText('customerName')}: Aung Aung</p>
                    <p className="text-sm text-slate-600">{renderEditableText('customerCode')}: C0123</p>
                    <p className="text-sm text-slate-600">{renderEditableText('phoneNumber')}: 09xxxxxxx</p>
                    <p className="text-sm text-slate-600">{renderEditableText('package')}: Premium</p>
                    <p className="text-sm text-slate-600">{renderEditableText('monthlyFee')}: 35,000 MMK {renderEditableText('perMonth')}</p>
                    <span className="mt-3 inline-flex rounded-md border px-2 py-1 text-sm">{renderEditableText('viewDetails')}</span>
                  </div>
                </div>
              )}

              {activeView === 'assigned_bills' && (
                <div className="rounded-lg border p-4">
                  <p className="mb-2 text-sm font-medium">{renderEditableText('dueBills')}</p>
                  <p className="text-sm text-slate-500">{renderEditableText('searchCustomersPlaceholder')}</p>
                  <div className="mt-3 rounded-md border p-3">
                    <p className="text-sm font-medium">{renderEditableText('invoice')}: Apr 2026</p>
                    <p className="text-sm text-slate-600">{renderEditableText('customer')}: Ko Ko</p>
                    <p className="text-sm text-slate-600">{renderEditableText('amount')}: 35,000 MMK</p>
                    <p className="text-sm text-slate-600">{renderEditableText('due')}: 30/04/2026</p>
                    <div className="mt-3 flex gap-2">
                      <span className="inline-flex rounded-md border px-2 py-1 text-sm">{renderEditableText('details')}</span>
                      <span className="inline-flex rounded-md bg-slate-900 px-2 py-1 text-sm text-white [&_svg]:text-white">{renderEditableText('collectionFlow')}</span>
                    </div>
                  </div>
                </div>
              )}

              {activeView === 'collected_bills' && (
                <div className="rounded-lg border p-4">
                  <p className="mb-2 text-sm font-medium">{renderEditableText('collected')}</p>
                  <div className="rounded-md border p-3">
                    <p className="text-sm text-slate-600">{renderEditableText('invoice')}: Mar 2026</p>
                    <p className="text-sm text-slate-600">{renderEditableText('customer')}: Mya Mya</p>
                    <p className="text-sm text-slate-600">{renderEditableText('amount')}: 28,000 MMK</p>
                    <p className="text-sm text-slate-600">{renderEditableText('status')}: {renderEditableText('invoiceCompleted')}</p>
                    <div className="mt-3 flex gap-2">
                      <span className="inline-flex rounded-md border px-2 py-1 text-sm">{renderEditableText('details')}</span>
                      <span className="inline-flex rounded-md border px-2 py-1 text-sm">{renderEditableText('viewMapLocation')}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium">{renderEditableText('collectionWorkflow')}</p>
                <p className="text-sm text-slate-600">{renderEditableText('currentCollectionStatus')}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <span className="inline-flex rounded-md border px-2 py-1 text-sm">{renderEditableText('startCollection')}</span>
                  <span className="inline-flex rounded-md border px-2 py-1 text-sm">{renderEditableText('markArrived')}</span>
                  <span className="inline-flex rounded-md border px-2 py-1 text-sm">{renderEditableText('reschedule')}</span>
                  <span className="inline-flex rounded-md border px-2 py-1 text-sm">{renderEditableText('collected')}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">All Collector Text Keys</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative max-w-lg">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  className="pl-10"
                  placeholder="Search key or text..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                {filteredKeys.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedField(key)}
                    className={`rounded-md border p-3 text-left hover:bg-slate-50 ${
                      selectedField === key ? 'border-slate-900 bg-slate-50' : 'border-slate-200'
                    }`}
                  >
                    <p className="text-xs text-slate-500">{key}</p>
                    <p className="mt-1 flex items-center gap-2 text-sm text-slate-800">
                      <span className="line-clamp-2">{currentLanguageCopy[key] || '-'}</span>
                      <Pencil className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                    </p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="xl:sticky xl:top-24">
            <CardHeader>
              <CardTitle className="text-lg">Edit Text</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-slate-500">Key</p>
              <p className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-800">
                {selectedField}
              </p>
              <p className="text-xs text-slate-500">Label</p>
              <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {toFieldLabel(selectedField)}
              </p>

              {(currentLanguageCopy[selectedField] ?? '').length > 80 ? (
                <Textarea
                  value={currentLanguageCopy[selectedField] ?? ''}
                  rows={6}
                  onChange={(event) => handleFieldChange(selectedField, event.target.value)}
                />
              ) : (
                <Input
                  value={currentLanguageCopy[selectedField] ?? ''}
                  onChange={(event) => handleFieldChange(selectedField, event.target.value)}
                />
              )}

              <p className="text-xs text-slate-500">
                Language: {activeLanguage === 'mm' ? 'Burmese' : 'English'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
