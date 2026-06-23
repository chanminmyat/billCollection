'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Copy, Download, KeyRound, Pencil, RefreshCw, Search, ShieldCheck, ShieldOff } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

type TechnicianApiKeyRecord = {
  id: string;
  name: string;
  description?: string | null;
  keyPrefix: string;
  maskedKey: string;
  isActive: boolean;
  allowedIps?: string[];
  lastUsedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return '—';
  return new Date(parsed).toLocaleString('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

export default function SuperAdminTechnicianApiPage() {
  const [keys, setKeys] = useState<TechnicianApiKeyRecord[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [allowedIps, setAllowedIps] = useState('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBusyId, setIsBusyId] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAllowedIps, setEditAllowedIps] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [latestPlainKey, setLatestPlainKey] = useState<string | null>(null);

  const filteredKeys = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return keys;
    return keys.filter((key) =>
      [key.name, key.description ?? '', key.keyPrefix, key.maskedKey]
        .some((value) => value.toLowerCase().includes(query)),
    );
  }, [keys, search]);

  const integrationBase = `${API_BASE_URL}/technician-api/customers`;
  const changesFeedUrl = `${API_BASE_URL}/technician-api/customers-changes`;
  const sampleResponse = JSON.stringify(
    {
      customerId: 'd0d4a5b2-13cb-4a80-9b0a-4d4b0ed7f111',
      customerCode: 'CU-000123',
      customerName: 'Chan Example',
      customerStatus: 'disable',
      portalAccessStatus: 'active',
      serviceAccessState: 'blocked',
      shouldCutService: true,
      action: 'cut_service',
      contact: {
        primaryPhone: '09987654321',
        secondaryPhone: null,
        email: 'customer@example.com',
      },
      addresses: {
        installationAddress: 'No. 12, Sample Street',
        billingAddress: 'No. 12, Sample Street',
      },
      network: {
        routerId: 'RTR-01',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        onuSerial: 'ONU-12345678',
        vlanPort: 'VLAN-1001',
        networkZone: 'North Zone',
        ipType: 'static',
        staticIpAddress: '203.0.113.20',
      },
      subscription: {
        id: '7d1b8628-70a6-4879-9f70-a4af2a8f2222',
        serviceType: 'FTTH',
        serviceStartDate: '2026-01-01',
        contractStartDate: '2026-01-01',
        contractEndDate: '2026-12-31',
        installationDate: '2025-12-28',
        plan: {
          id: '1bd4c23f-cc8f-4754-9203-b1a777f73333',
          planCode: 'HOME-20M',
          planName: 'Home 20 Mbps',
          currency: 'MMK',
          monthlyFee: '25000.00',
        },
      },
      updatedAt: '2026-06-17T08:45:00.000Z',
    },
    null,
    2,
  );
  const sampleChangesResponse = JSON.stringify(
    {
      serverTime: '2026-06-17T09:00:00.000Z',
      updatedSinceApplied: '2026-06-17T08:30:00.000Z',
      count: 1,
      items: [
        {
          customerCode: 'CU-000123',
          customerStatus: 'disable',
          serviceAccessState: 'blocked',
          action: 'cut_service',
          network: {
            routerId: 'RTR-01',
            macAddress: 'AA:BB:CC:DD:EE:FF',
          },
          updatedAt: '2026-06-17T08:45:00.000Z',
        },
      ],
    },
    null,
    2,
  );

  const fetchKeys = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/technician-api/keys`);
      const data = await response.json().catch(() => []);
      if (!response.ok) {
        const message = data?.message ?? 'Failed to load technician API keys';
        throw new Error(Array.isArray(message) ? message.join(', ') : String(message));
      }
      setKeys(Array.isArray(data) ? data : []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load technician API keys');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setSuccess(`${label} copied.`);
      setError(null);
    } catch {
      setError(`Failed to copy ${label.toLowerCase()}.`);
    }
  };

  const downloadIntegrationDoc = () => {
    const content = [
      'Technician API Integration',
      '',
      `Base URL: ${API_BASE_URL}/technician-api`,
      'Required header:',
      'x-technician-api-key: <your-key>',
      '',
      'Initial full sync:',
      `GET ${integrationBase}`,
      '',
      'Changes polling:',
      `GET ${changesFeedUrl}?updatedSince=2026-06-17T08:30:00.000Z`,
      '',
      'Single customer:',
      `${integrationBase}/CU-000123`,
      '',
      'Action handling:',
      '- action = cut_service -> suspend service',
      '- action = restore_service -> re-enable service',
      '',
      'Important:',
      '- If allowed IPs are configured on the key, requests must come from those public IPs only.',
      '- Save the plain key when created or rotated. It is shown only once.',
      '',
      'Sample full record:',
      sampleResponse,
      '',
      'Sample changes response:',
      sampleChangesResponse,
      '',
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'technician-api-integration.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setSuccess('Technician integration document downloaded.');
    setError(null);
  };

  const handleCreateKey = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    setLatestPlainKey(null);

    try {
      const response = await fetch(`${API_BASE_URL}/technician-api/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description.trim() || undefined,
          allowedIps: allowedIps.trim() || undefined,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message = data?.message ?? 'Failed to create technician API key';
        throw new Error(Array.isArray(message) ? message.join(', ') : String(message));
      }
      setLatestPlainKey(String(data?.apiKey ?? ''));
      setSuccess(`Technician API key created for ${data?.name ?? name}. Save the plain key now.`);
      setName('');
      setDescription('');
      setAllowedIps('');
      await fetchKeys();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to create technician API key');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRotateKey = async (key: TechnicianApiKeyRecord) => {
    setIsBusyId(key.id);
    setError(null);
    setSuccess(null);
    setLatestPlainKey(null);
    try {
      const response = await fetch(`${API_BASE_URL}/technician-api/keys/${key.id}/rotate`, {
        method: 'POST',
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message = data?.message ?? 'Failed to rotate key';
        throw new Error(Array.isArray(message) ? message.join(', ') : String(message));
      }
      setLatestPlainKey(String(data?.apiKey ?? ''));
      setSuccess(`Key rotated for ${key.name}. Old key is no longer valid.`);
      await fetchKeys();
    } catch (rotateError) {
      setError(rotateError instanceof Error ? rotateError.message : 'Failed to rotate key');
    } finally {
      setIsBusyId(null);
    }
  };

  const handleToggleKey = async (key: TechnicianApiKeyRecord) => {
    setIsBusyId(key.id);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${API_BASE_URL}/technician-api/keys/${key.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !key.isActive }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message = data?.message ?? 'Failed to update key status';
        throw new Error(Array.isArray(message) ? message.join(', ') : String(message));
      }
      setSuccess(`Key ${key.name} is now ${data?.isActive ? 'active' : 'inactive'}.`);
      await fetchKeys();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Failed to update key status');
    } finally {
      setIsBusyId(null);
    }
  };

  const openEditDialog = (key: TechnicianApiKeyRecord) => {
    setEditingKeyId(key.id);
    setEditName(key.name);
    setEditDescription(key.description ?? '');
    setEditAllowedIps((key.allowedIps ?? []).join(', '));
    setIsEditOpen(true);
    setError(null);
    setSuccess(null);
  };

  const handleEditKey = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingKeyId) return;

    setIsEditSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${API_BASE_URL}/technician-api/keys/${editingKeyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          description: editDescription.trim() || '',
          allowedIps: editAllowedIps.trim(),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message = data?.message ?? 'Failed to update key';
        throw new Error(Array.isArray(message) ? message.join(', ') : String(message));
      }
      setSuccess(`Key ${data?.name ?? editName} updated.`);
      setIsEditOpen(false);
      setEditingKeyId(null);
      await fetchKeys();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to update key');
    } finally {
      setIsEditSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Technician API</h2>
          <p className="text-sm text-slate-500">
            Create integration keys for technician automation to cut or restore service based on customer status.
          </p>
        </div>
        <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
          Header: x-technician-api-key
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Technician API Key</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="grid gap-3 md:grid-cols-[1.2fr_1.8fr_auto]" onSubmit={handleCreateKey}>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Key name"
              required
            />
            <Input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Description for technician integration"
            />
            <Input
              value={allowedIps}
              onChange={(event) => setAllowedIps(event.target.value)}
              placeholder="Allowed public IPs, comma separated (optional)"
              className="md:col-span-2"
            />
            <Button type="submit" disabled={isSubmitting}>
              <KeyRound className="mr-2 h-4 w-4" />
              {isSubmitting ? 'Creating...' : 'Create Key'}
            </Button>
          </form>

          {latestPlainKey ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-900">Plain API key</p>
              <p className="mt-1 break-all font-mono text-sm text-amber-800">{latestPlainKey}</p>
              <div className="mt-3">
                <Button variant="outline" size="sm" onClick={() => void copyText(latestPlainKey, 'API key')}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Key
                </Button>
              </div>
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-600">{success}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integration Format</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-600">
          <div className="rounded-lg border border-slate-200 bg-slate-950 p-4 font-mono text-slate-100">
            <p>GET {integrationBase}</p>
            <p>x-technician-api-key: &lt;your-key&gt;</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void copyText(integrationBase, 'Feed URL')}>
              <Copy className="mr-2 h-4 w-4" />
              Copy Feed URL
            </Button>
            <Button variant="outline" size="sm" onClick={() => void copyText(changesFeedUrl, 'Changes feed URL')}>
              <Copy className="mr-2 h-4 w-4" />
              Copy Changes URL
            </Button>
            <Badge variant="secondary">Optional query: updatedSince=2026-06-17T00:00:00.000Z</Badge>
            <Button variant="outline" size="sm" onClick={downloadIntegrationDoc}>
              <Download className="mr-2 h-4 w-4" />
              Download Doc
            </Button>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-950 p-4 font-mono text-slate-100">
            <p>GET {changesFeedUrl}?updatedSince=2026-06-17T08:30:00.000Z</p>
            <p>x-technician-api-key: &lt;your-key&gt;</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="font-medium text-slate-900">Feed returns</p>
            <p>
              Customer status, portal access status, desired service state, router ID, MAC address, ONU serial,
              VLAN port, network zone, IP type, static IP, contact details and current subscription info.
            </p>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-900">Sample full customer record</p>
              <pre className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-950 p-4 text-xs text-slate-100">
                {sampleResponse}
              </pre>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-900">Sample changes polling response</p>
              <pre className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-950 p-4 text-xs text-slate-100">
                {sampleChangesResponse}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle>Existing Keys</CardTitle>
            <div className="relative w-full md:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search keys"
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-slate-500">Loading keys...</p>
          ) : filteredKeys.length === 0 ? (
            <p className="text-sm text-slate-500">No technician API keys found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Key Preview</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredKeys.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell>
                        <div className="font-medium text-slate-900">{key.name}</div>
                        <div className="text-xs text-slate-500">{key.description || '—'}</div>
                        <div className="text-xs text-slate-500">
                          Allowed IPs: {key.allowedIps && key.allowedIps.length > 0 ? key.allowedIps.join(', ') : 'any'}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-slate-700">{key.maskedKey}</TableCell>
                      <TableCell>
                        <Badge
                          variant={key.isActive ? 'default' : 'secondary'}
                          className={key.isActive ? 'bg-emerald-600 hover:bg-emerald-600' : ''}
                        >
                          {key.isActive ? 'active' : 'inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDateTime(key.lastUsedAt)}</TableCell>
                      <TableCell>{formatDateTime(key.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDialog(key)}
                            disabled={isBusyId === key.id}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handleRotateKey(key)}
                            disabled={isBusyId === key.id}
                          >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Rotate
                          </Button>
                          <Button
                            size="sm"
                            variant={key.isActive ? 'outline' : 'default'}
                            onClick={() => void handleToggleKey(key)}
                            disabled={isBusyId === key.id}
                          >
                            {key.isActive ? (
                              <ShieldOff className="mr-2 h-4 w-4" />
                            ) : (
                              <ShieldCheck className="mr-2 h-4 w-4" />
                            )}
                            {key.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Technician API Key</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleEditKey}>
            <Input
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              placeholder="Key name"
              required
            />
            <Input
              value={editDescription}
              onChange={(event) => setEditDescription(event.target.value)}
              placeholder="Description"
            />
            <Input
              value={editAllowedIps}
              onChange={(event) => setEditAllowedIps(event.target.value)}
              placeholder="Allowed public IPs, comma separated"
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isEditSubmitting}>
                {isEditSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
