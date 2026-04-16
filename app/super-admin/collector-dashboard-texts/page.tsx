'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
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
  const [editingField, setEditingField] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');

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

  const previewCopy = useMemo(
    () => (activeLanguage === 'mm' ? copy.mm : copy.en),
    [activeLanguage, copy.en, copy.mm],
  );

  const handleFieldChange = (
    language: 'en' | 'mm',
    key: CollectorDashboardCopyKey,
    value: string,
  ) => {
    setCopy((prev) => ({
      ...prev,
      [language]: {
        ...prev[language],
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
      setEditingField(null);

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
    setEditingField(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Manage Collector Dashboard</h2>
          <p className="text-sm text-slate-500">
            Edit English and Burmese texts used in the collector dashboard.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleResetToDefault} disabled={saving || loading}>
            Reset To Default
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? 'Updating...' : 'Update System Texts'}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-lg">
            <span>Collector Dashboard Preview</span>
            <Badge variant="outline">
              {activeLanguage === 'mm' ? 'Burmese' : 'English'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">{previewCopy.assignedCustomers}</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">124</p>
              <p className="text-xs text-slate-500">{previewCopy.totalCustomersAssigned}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">{previewCopy.todaysCollection}</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">284,000 MMK</p>
              <p className="text-xs text-slate-500">{previewCopy.collectedToday}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">{previewCopy.pendingBills}</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">18</p>
              <p className="text-xs text-slate-500">{previewCopy.billsToCollect}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">{previewCopy.overdueBills}</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">3</p>
              <p className="text-xs text-slate-500">{previewCopy.requiresImmediateAttention}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Editable Fields</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadError ? <p className="text-sm text-rose-600">{loadError}</p> : null}
          <Tabs
            value={activeLanguage}
            onValueChange={(value) => {
              setActiveLanguage(value === 'mm' ? 'mm' : 'en');
              setEditingField(null);
            }}
          >
            <TabsList>
              <TabsTrigger value="en">English</TabsTrigger>
              <TabsTrigger value="mm">Burmese</TabsTrigger>
            </TabsList>

            {(['en', 'mm'] as const).map((language) => (
              <TabsContent key={language} value={language} className="mt-4 space-y-3">
                {loading ? (
                  <p className="text-sm text-slate-500">Loading collector dashboard texts...</p>
                ) : (
                  COLLECTOR_DASHBOARD_COPY_KEYS.map((fieldKey) => {
                    const rowId = `${language}:${fieldKey}`;
                    const isEditing = editingField === rowId;
                    const value = copy[language][fieldKey] ?? '';
                    return (
                      <div key={rowId} className="rounded-lg border border-slate-200 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{toFieldLabel(fieldKey)}</p>
                            <p className="text-xs text-slate-500">{fieldKey}</p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingField(isEditing ? null : rowId)}
                          >
                            {isEditing ? 'Done' : 'Edit'}
                          </Button>
                        </div>

                        <div className="mt-3">
                          {isEditing ? (
                            value.length > 64 ? (
                              <Textarea
                                autoFocus
                                value={value}
                                onChange={(event) =>
                                  handleFieldChange(language, fieldKey, event.target.value)
                                }
                                rows={3}
                              />
                            ) : (
                              <Input
                                autoFocus
                                value={value}
                                onChange={(event) =>
                                  handleFieldChange(language, fieldKey, event.target.value)
                                }
                              />
                            )
                          ) : (
                            <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
                              {value || '-'}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
