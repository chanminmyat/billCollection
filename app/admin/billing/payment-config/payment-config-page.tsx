'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Layout from '@/app/components/layout';
import { useAuth } from '@/app/contexts/auth-context';
import { appendActivityLog } from '@/lib/activity-log';
import { formatDisplayDate } from '@/lib/date-format';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

type PaymentConfigPageProps = {
  mode: 'create' | 'list';
};

type PaymentAccountKind = 'wallet' | 'account';

type PaymentAccount = {
  id: string;
  kind: PaymentAccountKind;
  walletType?: string | null;
  bankType?: string | null;
  accountName: string;
  accountNumber: string;
  qrCodeDataUrl?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

const extractErrorMessage = (payload: unknown, fallback: string): string => {
  if (!payload || typeof payload !== 'object') return fallback;
  const data = payload as { message?: string | string[]; error?: string };
  if (Array.isArray(data.message) && data.message.length > 0) {
    return data.message.join(', ');
  }
  if (typeof data.message === 'string' && data.message.trim()) {
    return data.message;
  }
  if (typeof data.error === 'string' && data.error.trim()) {
    return data.error;
  }
  return fallback;
};

export default function PaymentConfigPage({ mode }: PaymentConfigPageProps) {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();

  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [search, setSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [kind, setKind] = useState<PaymentAccountKind>('wallet');
  const [walletType, setWalletType] = useState('');
  const [bankType, setBankType] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [qrCodeFile, setQrCodeFile] = useState<File | null>(null);
  const [qrCodePreviewUrl, setQrCodePreviewUrl] = useState<string | null>(null);
  const [qrCodeFileName, setQrCodeFileName] = useState('');

  const refreshAccounts = useCallback(async () => {
    setIsLoadingAccounts(true);
    try {
      const response = await fetch(`${API_BASE_URL}/billing/payment-accounts`, {
        headers: { Accept: 'application/json' },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(extractErrorMessage(payload, 'Failed to load payment accounts'));
      }
      const list = Array.isArray(payload) ? payload : [];
      const normalized = list
        .map((item) => {
          const kindValue = String(item?.kind ?? '').toLowerCase() === 'account' ? 'account' : 'wallet';
          return {
            id: String(item?.id ?? ''),
            kind: kindValue,
            walletType: item?.walletType ?? null,
            bankType: item?.bankType ?? null,
            accountName: String(item?.accountName ?? ''),
            accountNumber: String(item?.accountNumber ?? ''),
            qrCodeDataUrl: item?.qrCodeDataUrl ?? null,
            isActive: Boolean(item?.isActive ?? true),
            createdAt: String(item?.createdAt ?? ''),
            updatedAt: item?.updatedAt ? String(item.updatedAt) : undefined,
          } as PaymentAccount;
        })
        .filter((item) => item.id && item.accountName);
      setAccounts(normalized);
    } catch (error) {
      setAccounts([]);
      toast({
        title: 'Failed to load payment accounts',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingAccounts(false);
    }
  }, [toast]);

  useEffect(() => {
    refreshAccounts();
  }, [refreshAccounts]);

  useEffect(() => {
    return () => {
      if (qrCodePreviewUrl) {
        URL.revokeObjectURL(qrCodePreviewUrl);
      }
    };
  }, [qrCodePreviewUrl]);

  const filteredAccounts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return accounts;
    return accounts.filter((account) => {
      const paymentType = account.kind === 'wallet' ? account.walletType ?? '' : account.bankType ?? '';
      return (
        account.kind.toLowerCase().includes(keyword) ||
        paymentType.toLowerCase().includes(keyword) ||
        account.accountName.toLowerCase().includes(keyword) ||
        account.accountNumber.toLowerCase().includes(keyword)
      );
    });
  }, [accounts, search]);

  const resetForm = () => {
    setWalletType('');
    setBankType('');
    setAccountName('');
    setAccountNumber('');
    setQrCodeFile(null);
    setQrCodePreviewUrl(null);
    setQrCodeFileName('');
  };

  const handleQrUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file',
        description: 'QR file must be an image.',
        variant: 'destructive',
      });
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setQrCodeFile(file);
    setQrCodePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return previewUrl;
    });
    setQrCodeFileName(file.name);
  };

  const handleCreate = async () => {
    const nextName = accountName.trim();
    const nextNumber = accountNumber.trim();
    const nextWalletType = walletType.trim();
    const nextBankType = bankType.trim();

    if (kind === 'wallet' && !nextWalletType) {
      toast({
        title: 'Wallet type is required',
        description: 'Please enter wallet type.',
        variant: 'destructive',
      });
      return;
    }
    if (kind === 'account' && !nextBankType) {
      toast({
        title: 'Bank type is required',
        description: 'Please enter bank type.',
        variant: 'destructive',
      });
      return;
    }
    if (!nextName) {
      toast({
        title: 'Name is required',
        description: 'Please enter account holder name.',
        variant: 'destructive',
      });
      return;
    }
    if (!nextNumber) {
      toast({
        title: kind === 'wallet' ? 'Wallet number is required' : 'Account number is required',
        description: kind === 'wallet' ? 'Please enter wallet number.' : 'Please enter account number.',
        variant: 'destructive',
      });
      return;
    }
    if (kind === 'wallet' && !qrCodeFile) {
      toast({
        title: 'QR code is required',
        description: 'Please upload wallet QR code.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('kind', kind);
      formData.append('accountName', nextName);
      formData.append('accountNumber', nextNumber);
      formData.append('isActive', 'true');
      if (kind === 'wallet') {
        formData.append('walletType', nextWalletType);
        if (qrCodeFile) {
          formData.append('qrCode', qrCodeFile);
        }
      } else {
        formData.append('bankType', nextBankType);
      }

      const response = await fetch(`${API_BASE_URL}/billing/payment-accounts`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        body: formData,
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(extractErrorMessage(payload, 'Failed to create payment account'));
      }

      const created = payload as PaymentAccount;
      if (!created?.id) {
        throw new Error('Failed to create payment account');
      }

      appendActivityLog({
        module: 'billing',
        action: 'create payment account',
        description: `Created ${kind} payment account (${created.accountName ?? nextName})`,
        actorId: user?.id,
        actorName: user?.name,
        actorRole: user?.role,
        targetType: 'payment-account',
        targetId: created.id,
        targetName: created.accountName ?? nextName,
        metadata: {
          kind: created.kind ?? kind,
          walletType: created.walletType ?? (kind === 'wallet' ? nextWalletType : null),
          bankType: created.bankType ?? (kind === 'account' ? nextBankType : null),
        },
      });

      toast({
        title: 'Payment account created',
        description: `${created.accountName ?? nextName} has been saved.`,
      });
      resetForm();
      await refreshAccounts();
    } catch (error) {
      toast({
        title: 'Create failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  if (!user || user.role !== 'admin') {
    return <div>Access denied</div>;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Payment Config</h1>
            <p className="text-slate-600">Manage wallet and bank accounts for invoice payments.</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant={mode === 'create' ? 'default' : 'outline'}>
              <Link href="/admin/billing/payment-config/create">Create Payment Account</Link>
            </Button>
            <Button asChild variant={mode === 'list' ? 'default' : 'outline'}>
              <Link href="/admin/billing/payment-config/list">Payment Account List</Link>
            </Button>
          </div>
        </div>

        {mode === 'create' ? (
          <Card>
            <CardHeader>
              <CardTitle>Create Payment Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Payment Type</Label>
                  <Select
                    value={kind}
                    onValueChange={(value) => {
                      const nextKind: PaymentAccountKind = value === 'account' ? 'account' : 'wallet';
                      setKind(nextKind);
                      if (nextKind === 'wallet') {
                        setBankType('');
                      } else {
                        setWalletType('');
                        setQrCodeFile(null);
                        setQrCodePreviewUrl(null);
                        setQrCodeFileName('');
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wallet">Wallet</SelectItem>
                      <SelectItem value="account">Account</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{kind === 'wallet' ? 'Wallet Type' : 'Bank Type'}</Label>
                  <Input
                    value={kind === 'wallet' ? walletType : bankType}
                    onChange={(event) => {
                      if (kind === 'wallet') {
                        setWalletType(event.target.value);
                      } else {
                        setBankType(event.target.value);
                      }
                    }}
                    placeholder={kind === 'wallet' ? 'KBZPay, WavePay...' : 'KBZ, AYA, CB...'}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={accountName}
                    onChange={(event) => setAccountName(event.target.value)}
                    placeholder="Account holder name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{kind === 'wallet' ? 'Wallet Number' : 'Account Number'}</Label>
                  <Input
                    value={accountNumber}
                    onChange={(event) => setAccountNumber(event.target.value)}
                    placeholder={kind === 'wallet' ? '09xxxxxxxxx' : '000123456789'}
                  />
                </div>
              </div>

              {kind === 'wallet' && (
                <div className="space-y-3">
                  <Label>Upload QR Code</Label>
                  <Input type="file" accept="image/*" onChange={handleQrUpload} />
                  {qrCodeFileName ? <p className="text-xs text-slate-500">Selected: {qrCodeFileName}</p> : null}
                  {qrCodePreviewUrl ? (
                    <div className="inline-flex items-center rounded-md border border-slate-200 bg-white p-3">
                      <img src={qrCodePreviewUrl} alt="QR preview" className="h-36 w-36 rounded object-contain" />
                    </div>
                  ) : null}
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={handleCreate} disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Create Payment Account'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Payment Account List ({filteredAccounts.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by type, name, or number"
              />
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Wallet/Bank Type</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Number</TableHead>
                      <TableHead>QR</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingAccounts ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-8 text-center text-sm text-slate-500">
                          Loading payment accounts...
                        </TableCell>
                      </TableRow>
                    ) : filteredAccounts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-8 text-center text-sm text-slate-500">
                          No payment accounts found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAccounts.map((account) => (
                        <TableRow key={account.id}>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize">
                              {account.kind}
                            </Badge>
                          </TableCell>
                          <TableCell>{account.kind === 'wallet' ? account.walletType || '-' : account.bankType || '-'}</TableCell>
                          <TableCell>{account.accountName}</TableCell>
                          <TableCell>{account.accountNumber}</TableCell>
                          <TableCell>
                            {account.kind === 'wallet' && account.qrCodeDataUrl ? (
                              <a
                                href={account.qrCodeDataUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
                              >
                                View QR
                              </a>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={account.isActive ? 'default' : 'secondary'}>
                              {account.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDisplayDate(account.createdAt)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
