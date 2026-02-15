'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type EditorState = {
  content: string;
  loading: boolean;
  saving: boolean;
  error: string;
  success: string;
};

export default function ReferenceDataPage() {
  const [nrc, setNrc] = useState<EditorState>({
    content: '',
    loading: true,
    saving: false,
    error: '',
    success: ''
  });
  const [township, setTownship] = useState<EditorState>({
    content: '',
    loading: true,
    saving: false,
    error: '',
    success: ''
  });

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const [nrcResponse, townshipResponse] = await Promise.all([
          fetch('/api/reference-data/nrc'),
          fetch('/api/reference-data/township')
        ]);

        const nrcData = await nrcResponse.json().catch(() => ({}));
        const townshipData = await townshipResponse.json().catch(() => ({}));

        if (!isMounted) return;

        setNrc((prev) => ({
          ...prev,
          content: nrcData?.content ?? '',
          loading: false,
          error: nrcResponse.ok ? '' : nrcData?.message ?? 'Failed to load NRC data.'
        }));
        setTownship((prev) => ({
          ...prev,
          content: townshipData?.content ?? '',
          loading: false,
          error: townshipResponse.ok ? '' : townshipData?.message ?? 'Failed to load township data.'
        }));
      } catch (error) {
        if (!isMounted) return;
        setNrc((prev) => ({
          ...prev,
          loading: false,
          error: 'Failed to load NRC data.'
        }));
        setTownship((prev) => ({
          ...prev,
          loading: false,
          error: 'Failed to load township data.'
        }));
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSave = async (type: 'nrc' | 'township') => {
    if (type === 'nrc') {
      setNrc((prev) => ({ ...prev, saving: true, error: '', success: '' }));
      try {
        const response = await fetch('/api/reference-data/nrc', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ content: nrc.content })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.message ?? 'Failed to save NRC data.');
        }
        setNrc((prev) => ({ ...prev, saving: false, success: 'Saved successfully.' }));
      } catch (error) {
        setNrc((prev) => ({
          ...prev,
          saving: false,
          error: error instanceof Error ? error.message : 'Failed to save NRC data.'
        }));
      }
    } else {
      setTownship((prev) => ({ ...prev, saving: true, error: '', success: '' }));
      try {
        const response = await fetch('/api/reference-data/township', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ content: township.content })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.message ?? 'Failed to save township data.');
        }
        setTownship((prev) => ({ ...prev, saving: false, success: 'Saved successfully.' }));
      } catch (error) {
        setTownship((prev) => ({
          ...prev,
          saving: false,
          error: error instanceof Error ? error.message : 'Failed to save township data.'
        }));
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Reference Data</h2>
        <p className="text-sm text-slate-500">
          Manage NRC and township JSON data used in customer forms.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>NRC Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {nrc.loading ? (
            <p className="text-sm text-slate-500">Loading NRC data...</p>
          ) : (
            <Textarea
              value={nrc.content}
              onChange={(event) => setNrc((prev) => ({ ...prev, content: event.target.value }))}
              rows={16}
              className="font-mono text-xs"
            />
          )}
          {nrc.error && <p className="text-sm text-rose-600">{nrc.error}</p>}
          {nrc.success && <p className="text-sm text-emerald-600">{nrc.success}</p>}
          <Button onClick={() => handleSave('nrc')} disabled={nrc.saving || nrc.loading}>
            {nrc.saving ? 'Saving...' : 'Save NRC Data'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Township Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {township.loading ? (
            <p className="text-sm text-slate-500">Loading township data...</p>
          ) : (
            <Textarea
              value={township.content}
              onChange={(event) => setTownship((prev) => ({ ...prev, content: event.target.value }))}
              rows={16}
              className="font-mono text-xs"
            />
          )}
          {township.error && <p className="text-sm text-rose-600">{township.error}</p>}
          {township.success && <p className="text-sm text-emerald-600">{township.success}</p>}
          <Button onClick={() => handleSave('township')} disabled={township.saving || township.loading}>
            {township.saving ? 'Saving...' : 'Save Township Data'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
