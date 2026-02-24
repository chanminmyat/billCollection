'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Calendar,
  DollarSign,
  FileText,
  Search,
  RefreshCw,
  Eye,
  Download,
  Plus,
  Minus,
  Save,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../../contexts/auth-context';
import Layout from '../../components/layout';
import { useToast } from '@/hooks/use-toast';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

type InvoiceStatus = 'paid' | 'unpaid' | 'overdue' | 'cancelled';
type AdjustmentType = 'plus' | 'minus';
type AdjustmentValueType = 'fixed' | 'percent';

type InvoiceAdjustment = {
  id: string;
  description: string;
  type: AdjustmentType;
  valueType: AdjustmentValueType;
  value: string;
  amount: string;
  rememberForNext: boolean;
  sortOrder: number;
};

type InvoiceRecord = {
  id: string;
  invoiceNo?: string | null;
  invoiceType?: string;
  invoiceDate?: string | null;
  billingPeriodFrom?: string | null;
  billingPeriodTo?: string | null;
  dueDate?: string | null;
  status: InvoiceStatus;
  currency?: string;
  monthlyFee?: string;
  installationFee?: string;
  additionalFees?: string;
  discountAmount?: string;
  subtotalAmount?: string;
  plusAmount?: string;
  minusAmount?: string;
  totalAmount?: string;
  paymentMethod?: string | null;
  receiptNo?: string | null;
  paidAt?: string | null;
  customer?: {
    id: string;
    customerCode?: string;
    personalName?: string | null;
    companyName?: string | null;
    primaryPhone?: string | null;
    installationAddress?: string | null;
  };
  subscription?: {
    id: string;
    serviceType?: string;
    plan?: {
      id: string;
      planCode?: string;
      planName?: string;
      monthlyFee?: string;
      currency?: string;
    } | null;
  } | null;
  adjustments?: InvoiceAdjustment[];
};

type AdjustmentFormRow = {
  description: string;
  type: AdjustmentType;
  valueType: AdjustmentValueType;
  value: string;
  rememberForNext: boolean;
  sortOrder: number;
};

const toNumber = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatMoney = (value: string | number | null | undefined, currency = 'MMK') =>
  `${toNumber(value).toLocaleString()} ${currency}`;

const statusBadgeVariant = (status: InvoiceStatus) => {
  if (status === 'paid') return 'default';
  if (status === 'unpaid') return 'secondary';
  return 'destructive';
};

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export default function BillingPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'all' | InvoiceStatus>('all');

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);
  const [adjustmentRows, setAdjustmentRows] = useState<AdjustmentFormRow[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('KBZPay');
  const [receiptNo, setReceiptNo] = useState('');
  const [isSavingAdjustments, setIsSavingAdjustments] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);

  const fetchInvoices = async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const response = await fetch(`${API_BASE_URL}/billing/invoices`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? 'Failed to load invoices');
      }

      const data = await response.json().catch(() => []);
      const list = Array.isArray(data) ? data : [];
      setInvoices(list);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load invoices';
      setLoadError(message);
      setInvoices([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchInvoices();
    }
  }, [user?.role]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const customerName =
        invoice.customer?.personalName || invoice.customer?.companyName || 'Unknown Customer';
      const customerCode = invoice.customer?.customerCode || '';
      const invoiceNo = invoice.invoiceNo || '';

      const matchesSearch =
        customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customerCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoiceNo.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = selectedStatus === 'all' || invoice.status === selectedStatus;
      return matchesSearch && matchesStatus;
    });
  }, [invoices, searchTerm, selectedStatus]);

  const stats = useMemo(() => {
    const totalInvoices = invoices.length;
    const paidCount = invoices.filter((invoice) => invoice.status === 'paid').length;
    const unpaidCount = invoices.filter((invoice) => invoice.status === 'unpaid').length;
    const overdueCount = invoices.filter((invoice) => invoice.status === 'overdue').length;

    const paidRevenue = invoices
      .filter((invoice) => invoice.status === 'paid')
      .reduce((sum, invoice) => sum + toNumber(invoice.totalAmount), 0);

    const outstanding = invoices
      .filter((invoice) => invoice.status !== 'paid')
      .reduce((sum, invoice) => sum + toNumber(invoice.totalAmount), 0);

    return {
      totalInvoices,
      paidCount,
      unpaidCount,
      overdueCount,
      paidRevenue,
      outstanding,
    };
  }, [invoices]);

  const openInvoiceDetail = (invoice: InvoiceRecord) => {
    setSelectedInvoice(invoice);
    const rows =
      invoice.adjustments?.map((adjustment, index) => ({
        description: adjustment.description,
        type: adjustment.type,
        valueType: adjustment.valueType,
        value: toNumber(adjustment.value).toString(),
        rememberForNext: Boolean(adjustment.rememberForNext),
        sortOrder: adjustment.sortOrder ?? index,
      })) ?? [];
    setAdjustmentRows(rows);
    setPaymentMethod(invoice.paymentMethod || 'KBZPay');
    setReceiptNo(invoice.receiptNo || '');
    setDetailOpen(true);
  };

  const addAdjustmentRow = (type: AdjustmentType) => {
    setAdjustmentRows((prev) => [
      ...prev,
      {
        description: '',
        type,
        valueType: 'fixed',
        value: '',
        rememberForNext: false,
        sortOrder: prev.length,
      },
    ]);
  };

  const updateAdjustmentRow = <K extends keyof AdjustmentFormRow>(
    index: number,
    key: K,
    value: AdjustmentFormRow[K],
  ) => {
    setAdjustmentRows((prev) =>
      prev.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)),
    );
  };

  const removeAdjustmentRow = (index: number) => {
    setAdjustmentRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
  };

  const adjustmentPreview = useMemo(() => {
    if (!selectedInvoice) {
      return {
        baseSubtotal: 0,
        plusTotal: 0,
        minusTotal: 0,
        discountBase: 0,
        total: 0,
      };
    }

    const baseSubtotal =
      toNumber(selectedInvoice.monthlyFee) +
      toNumber(selectedInvoice.installationFee) +
      toNumber(selectedInvoice.additionalFees);

    const dynamic = adjustmentRows.reduce(
      (acc, row) => {
        const raw = toNumber(row.value);
        const amount = row.valueType === 'percent' ? (baseSubtotal * raw) / 100 : raw;
        if (row.type === 'plus') {
          acc.plus += amount;
        } else {
          acc.minus += amount;
        }
        return acc;
      },
      { plus: 0, minus: 0 },
    );

    const discountBase = toNumber(selectedInvoice.discountAmount);
    const minusTotal = discountBase + dynamic.minus;
    const total = baseSubtotal + dynamic.plus - minusTotal;

    return {
      baseSubtotal,
      plusTotal: dynamic.plus,
      minusTotal,
      discountBase,
      total,
    };
  }, [selectedInvoice, adjustmentRows]);

  const saveAdjustments = async () => {
    if (!selectedInvoice) return;
    if (selectedInvoice.status === 'paid') {
      toast({
        title: 'Invoice is locked',
        description: 'Paid invoices cannot be changed.',
        variant: 'destructive',
      });
      return;
    }

    const invalid = adjustmentRows.find(
      (row) => row.description.trim().length === 0 || toNumber(row.value) < 0,
    );

    if (invalid) {
      toast({
        title: 'Invalid adjustment',
        description: 'Each row needs a description and non-negative value.',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingAdjustments(true);

    try {
      const payload = {
        adjustments: adjustmentRows.map((row, index) => ({
          description: row.description.trim(),
          type: row.type,
          valueType: row.valueType,
          value: toNumber(row.value),
          rememberForNext: row.rememberForNext,
          sortOrder: row.sortOrder ?? index,
        })),
      };

      const response = await fetch(`${API_BASE_URL}/billing/invoices/${selectedInvoice.id}/adjustments`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? 'Failed to save adjustments');
      }

      const updated = (await response.json()) as InvoiceRecord;

      setSelectedInvoice(updated);
      setInvoices((prev) => prev.map((invoice) => (invoice.id === updated.id ? updated : invoice)));

      const rows =
        updated.adjustments?.map((adjustment, index) => ({
          description: adjustment.description,
          type: adjustment.type,
          valueType: adjustment.valueType,
          value: toNumber(adjustment.value).toString(),
          rememberForNext: Boolean(adjustment.rememberForNext),
          sortOrder: adjustment.sortOrder ?? index,
        })) ?? [];
      setAdjustmentRows(rows);

      toast({
        title: 'Invoice updated',
        description: 'Adjustments saved successfully.',
      });
    } catch (error) {
      toast({
        title: 'Failed to save',
        description: error instanceof Error ? error.message : 'Failed to save adjustments',
        variant: 'destructive',
      });
    } finally {
      setIsSavingAdjustments(false);
    }
  };

  const markInvoicePaid = async () => {
    if (!selectedInvoice) return;

    setIsMarkingPaid(true);
    try {
      const response = await fetch(`${API_BASE_URL}/billing/invoices/${selectedInvoice.id}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentMethod: paymentMethod.trim() || undefined,
          receiptNo: receiptNo.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? 'Failed to mark invoice as paid');
      }

      const updated = (await response.json()) as InvoiceRecord;
      setSelectedInvoice(updated);
      setInvoices((prev) => prev.map((invoice) => (invoice.id === updated.id ? updated : invoice)));

      toast({
        title: 'Payment updated',
        description: 'Invoice marked as paid. Pending customer is activated.',
      });
    } catch (error) {
      toast({
        title: 'Payment failed',
        description: error instanceof Error ? error.message : 'Failed to mark paid',
        variant: 'destructive',
      });
    } finally {
      setIsMarkingPaid(false);
    }
  };

  const exportInvoicePdf = () => {
    if (!selectedInvoice) return;

    const customerName =
      selectedInvoice.customer?.personalName ||
      selectedInvoice.customer?.companyName ||
      'Unknown Customer';
    const customerCode = selectedInvoice.customer?.customerCode || '—';
    const customerPhone = selectedInvoice.customer?.primaryPhone || '—';
    const customerAddress = selectedInvoice.customer?.installationAddress || '—';
    const packageName =
      selectedInvoice.subscription?.plan?.planName ||
      selectedInvoice.subscription?.plan?.planCode ||
      '—';
    const currency = selectedInvoice.currency || 'MMK';

    let rowNumber = 1;
    const itemRows: string[] = [];

    itemRows.push(`
      <tr>
        <td>${rowNumber++}</td>
        <td>Monthly Internet Fee</td>
        <td class="right">1</td>
        <td class="right">${escapeHtml(formatMoney(selectedInvoice.monthlyFee, currency))}</td>
        <td class="right">${escapeHtml(formatMoney(selectedInvoice.monthlyFee, currency))}</td>
      </tr>
    `);

    if (toNumber(selectedInvoice.installationFee) > 0) {
      itemRows.push(`
        <tr>
          <td>${rowNumber++}</td>
          <td>Installation Fee</td>
          <td class="right">1</td>
          <td class="right">${escapeHtml(formatMoney(selectedInvoice.installationFee, currency))}</td>
          <td class="right">${escapeHtml(formatMoney(selectedInvoice.installationFee, currency))}</td>
        </tr>
      `);
    }

    if (toNumber(selectedInvoice.additionalFees) > 0) {
      itemRows.push(`
        <tr>
          <td>${rowNumber++}</td>
          <td>Additional Fee</td>
          <td class="right">1</td>
          <td class="right">${escapeHtml(formatMoney(selectedInvoice.additionalFees, currency))}</td>
          <td class="right">${escapeHtml(formatMoney(selectedInvoice.additionalFees, currency))}</td>
        </tr>
      `);
    }

    for (const adjustment of selectedInvoice.adjustments || []) {
      itemRows.push(`
        <tr>
          <td>${rowNumber++}</td>
          <td>${escapeHtml(adjustment.description || 'Adjustment')}</td>
          <td class="right">1</td>
          <td class="right">${
            adjustment.valueType === 'percent'
              ? `${escapeHtml(toNumber(adjustment.value).toString())}%`
              : escapeHtml(formatMoney(adjustment.value, currency))
          }</td>
          <td class="right">${
            adjustment.type === 'minus' ? '-' : ''
          }${escapeHtml(formatMoney(adjustment.amount, currency))}</td>
        </tr>
      `);
    }

    const summaryRows =
      selectedInvoice.status === 'paid'
        ? ''
        : `
          <tr>
            <td colspan="4" class="right bold">Subtotal</td>
            <td class="right bold">${escapeHtml(formatMoney(selectedInvoice.subtotalAmount, currency))}</td>
          </tr>
          <tr>
            <td colspan="4" class="right bold">Plus</td>
            <td class="right bold">${escapeHtml(formatMoney(selectedInvoice.plusAmount, currency))}</td>
          </tr>
          <tr>
            <td colspan="4" class="right bold">Minus</td>
            <td class="right bold">${escapeHtml(formatMoney(selectedInvoice.minusAmount, currency))}</td>
          </tr>
        `;

    const paidDate = selectedInvoice.paidAt
      ? new Date(selectedInvoice.paidAt).toLocaleDateString()
      : '__________';

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(selectedInvoice.invoiceNo || selectedInvoice.id)} - Invoice</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; color: #111827; }
            .page { max-width: 980px; margin: 24px auto; border: 2px solid #111827; padding: 20px; }
            h1 { text-align: center; margin: 0 0 20px; font-size: 42px; letter-spacing: 0.5px; }
            .section { margin-top: 18px; font-size: 14px; line-height: 1.55; }
            .title { font-weight: 700; margin-bottom: 8px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 14px; }
            th, td { border: 1px solid #111827; padding: 6px 8px; }
            th { background: #f3f4f6; }
            .right { text-align: right; }
            .bold { font-weight: 700; }
            .total { font-size: 16px; font-weight: 700; }
            @media print { .page { margin: 0; border-width: 1px; } }
          </style>
        </head>
        <body>
          <div class="page">
            <h1>Invoice</h1>

            <div class="section">
              <div>Company Name: ABC Internet Service Provider</div>
              <div>Address: No. 123, Main Road, Yangon</div>
              <div>Phone: 09-xxxxxxx</div>
              <div>Email:</div>
            </div>

            <div class="section grid">
              <div>
                <div class="title">Invoice Information</div>
                <div>Invoice No: ${escapeHtml(selectedInvoice.invoiceNo || selectedInvoice.id)}</div>
                <div>Invoice Date: ${escapeHtml(selectedInvoice.invoiceDate || '—')}</div>
                <div>Billing Period: ${escapeHtml(selectedInvoice.billingPeriodFrom || '—')} - ${escapeHtml(
      selectedInvoice.billingPeriodTo || '—'
    )}</div>
                <div>Due Date: ${escapeHtml(selectedInvoice.dueDate || '—')}</div>
              </div>
              <div>
                <div class="title">Customer Information</div>
                <div>Customer ID: ${escapeHtml(customerCode)}</div>
                <div>Customer Name: ${escapeHtml(customerName)}</div>
                <div>Phone No: ${escapeHtml(customerPhone)}</div>
                <div>Address: ${escapeHtml(customerAddress)}</div>
                <div>Package: ${escapeHtml(packageName)}</div>
              </div>
            </div>

            <div class="section">
              <div class="title">Charges Details</div>
              <table>
                <thead>
                  <tr>
                    <th style="width: 10%">No</th>
                    <th>Description</th>
                    <th style="width: 10%">Qty</th>
                    <th style="width: 20%">Unit Price</th>
                    <th style="width: 20%">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemRows.join('')}
                  ${summaryRows}
                  <tr>
                    <td colspan="4" class="right total">Total Amount</td>
                    <td class="right total">${escapeHtml(formatMoney(selectedInvoice.totalAmount, currency))}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="section">
              <div class="title">Payment Information</div>
              <div>Payment Method: ${escapeHtml(selectedInvoice.paymentMethod || '—')}</div>
              <div>Payment Status: ${escapeHtml(selectedInvoice.status)}</div>
              <div>Payment Date: ${escapeHtml(paidDate)}</div>
              <div>Receipt No: ${escapeHtml(selectedInvoice.receiptNo || '__________')}</div>
            </div>

            <div class="section">
              <div class="title">Notes / Terms</div>
              <div>Please pay before the due date to avoid service suspension.</div>
              <div>No refund after billing period started.</div>
              <div>This is a system-generated invoice.</div>
            </div>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        title: 'Popup blocked',
        description: 'Please allow popups to export invoice as PDF.',
        variant: 'destructive',
      });
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  if (!user || user.role !== 'admin') {
    return <div>Access denied</div>;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Billing Management</h1>
            <p className="text-slate-600">Real invoices from backend with dynamic + / - adjustments</p>
          </div>
          <Button variant="outline" onClick={fetchInvoices} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{stats.totalInvoices}</div>
                <FileText className="h-4 w-4 text-slate-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Paid</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-emerald-600">{stats.paidCount}</div>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Unpaid</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-amber-600">{stats.unpaidCount}</div>
                <Calendar className="h-4 w-4 text-amber-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-rose-600">{stats.overdueCount}</div>
                <Calendar className="h-4 w-4 text-rose-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Paid Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-xl font-bold">{formatMoney(stats.paidRevenue)}</div>
                <DollarSign className="h-4 w-4 text-slate-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-xl font-bold text-rose-600">{formatMoney(stats.outstanding)}</div>
                <DollarSign className="h-4 w-4 text-rose-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by invoice no, customer name, or customer code"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="pl-10"
                />
              </div>
              <Select
                value={selectedStatus}
                onValueChange={(value) => setSelectedStatus(value as 'all' | InvoiceStatus)}
              >
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoices ({filteredInvoices.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && <p className="mb-4 text-sm text-slate-500">Loading invoices...</p>}
            {loadError && <p className="mb-4 text-sm text-rose-600">{loadError}</p>}
            {!isLoading && !loadError && filteredInvoices.length === 0 && (
              <p className="mb-4 text-sm text-slate-500">No invoices found.</p>
            )}

            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => {
                    const customerName =
                      invoice.customer?.personalName ||
                      invoice.customer?.companyName ||
                      'Unknown Customer';
                    return (
                      <TableRow key={invoice.id}>
                        <TableCell>
                          <div className="font-medium">{invoice.invoiceNo || invoice.id}</div>
                          <div className="text-xs text-slate-500">{invoice.invoiceDate || '—'}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{customerName}</div>
                          <div className="text-xs text-slate-500">{invoice.customer?.customerCode || '—'}</div>
                        </TableCell>
                        <TableCell>
                          {(invoice.billingPeriodFrom || '—') + ' to ' + (invoice.billingPeriodTo || '—')}
                        </TableCell>
                        <TableCell>{invoice.dueDate || '—'}</TableCell>
                        <TableCell>{formatMoney(invoice.totalAmount, invoice.currency)}</TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(invoice.status)}>{invoice.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={() => openInvoiceDetail(invoice)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-4 md:hidden">
              {filteredInvoices.map((invoice) => {
                const customerName =
                  invoice.customer?.personalName || invoice.customer?.companyName || 'Unknown Customer';
                return (
                  <Card key={invoice.id}>
                    <CardContent className="space-y-3 pt-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm text-slate-500">{invoice.invoiceNo || invoice.id}</p>
                          <p className="text-base font-semibold text-slate-900">{customerName}</p>
                        </div>
                        <Badge variant={statusBadgeVariant(invoice.status)}>{invoice.status}</Badge>
                      </div>

                      <div className="space-y-1 text-sm text-slate-700">
                        <p>Invoice Date: {invoice.invoiceDate || '—'}</p>
                        <p>Due Date: {invoice.dueDate || '—'}</p>
                        <p>Total: {formatMoney(invoice.totalAmount, invoice.currency)}</p>
                      </div>

                      <Button className="w-full" variant="outline" onClick={() => openInvoiceDetail(invoice)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Invoice
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Dialog
          open={detailOpen}
          onOpenChange={(open) => {
            setDetailOpen(open);
            if (!open) {
              setSelectedInvoice(null);
              setAdjustmentRows([]);
              setReceiptNo('');
              setPaymentMethod('KBZPay');
            }
          }}
        >
          <DialogContent className="inset-0 left-0 top-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none border-0 p-4 sm:rounded-none sm:p-6">
            <DialogHeader>
              <DialogTitle>Invoice Detail</DialogTitle>
            </DialogHeader>

            {selectedInvoice && (
              <div className="space-y-6">
                <div className="rounded-lg border border-slate-300 bg-white p-5 text-slate-900">
                  <div className="mb-3 flex justify-end">
                    <Button variant="outline" size="sm" onClick={exportInvoicePdf}>
                      <Download className="mr-2 h-4 w-4" />
                      Export as PDF
                    </Button>
                  </div>
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
                      <p>Invoice No: {selectedInvoice.invoiceNo || selectedInvoice.id}</p>
                      <p>Invoice Date: {selectedInvoice.invoiceDate || '—'}</p>
                      <p>
                        Billing Period: {(selectedInvoice.billingPeriodFrom || '—') + ' - ' + (selectedInvoice.billingPeriodTo || '—')}
                      </p>
                      <p>Due Date: {selectedInvoice.dueDate || '—'}</p>
                    </div>

                    <div className="space-y-1 text-sm">
                      <p className="font-semibold">Customer Information</p>
                      <p>Customer ID: {selectedInvoice.customer?.customerCode || '—'}</p>
                      <p>
                        Customer Name:{' '}
                        {selectedInvoice.customer?.personalName ||
                          selectedInvoice.customer?.companyName ||
                          'Unknown'}
                      </p>
                      <p>Phone No: {selectedInvoice.customer?.primaryPhone || '—'}</p>
                      <p>Address: {selectedInvoice.customer?.installationAddress || '—'}</p>
                      <p>
                        Package:{' '}
                        {selectedInvoice.subscription?.plan?.planName ||
                          selectedInvoice.subscription?.plan?.planCode ||
                          '—'}
                      </p>
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
                            <TableCell className="text-right">{formatMoney(selectedInvoice.monthlyFee, selectedInvoice.currency)}</TableCell>
                            <TableCell className="text-right">{formatMoney(selectedInvoice.monthlyFee, selectedInvoice.currency)}</TableCell>
                          </TableRow>
                          {toNumber(selectedInvoice.installationFee) > 0 && (
                            <TableRow>
                              <TableCell>2</TableCell>
                              <TableCell>Installation Fee</TableCell>
                              <TableCell className="text-right">1</TableCell>
                              <TableCell className="text-right">{formatMoney(selectedInvoice.installationFee, selectedInvoice.currency)}</TableCell>
                              <TableCell className="text-right">{formatMoney(selectedInvoice.installationFee, selectedInvoice.currency)}</TableCell>
                            </TableRow>
                          )}
                          {toNumber(selectedInvoice.additionalFees) > 0 && (
                            <TableRow>
                              <TableCell>3</TableCell>
                              <TableCell>Additional Fee</TableCell>
                              <TableCell className="text-right">1</TableCell>
                              <TableCell className="text-right">{formatMoney(selectedInvoice.additionalFees, selectedInvoice.currency)}</TableCell>
                              <TableCell className="text-right">{formatMoney(selectedInvoice.additionalFees, selectedInvoice.currency)}</TableCell>
                            </TableRow>
                          )}
                          {(selectedInvoice.adjustments || []).map((adjustment, index) => (
                            <TableRow key={adjustment.id || `${adjustment.description}-${index}`}>
                              <TableCell>{index + 4}</TableCell>
                              <TableCell>{adjustment.description}</TableCell>
                              <TableCell className="text-right">1</TableCell>
                              <TableCell className="text-right">
                                {adjustment.valueType === 'percent'
                                  ? `${toNumber(adjustment.value)}%`
                                  : formatMoney(adjustment.value, selectedInvoice.currency)}
                              </TableCell>
                              <TableCell className="text-right">
                                {adjustment.type === 'minus' ? '-' : ''}
                                {formatMoney(adjustment.amount, selectedInvoice.currency)}
                              </TableCell>
                            </TableRow>
                          ))}
                          {selectedInvoice.status !== 'paid' && (
                            <>
                              <TableRow>
                                <TableCell colSpan={4} className="text-right font-semibold">Subtotal</TableCell>
                                <TableCell className="text-right font-semibold">
                                  {formatMoney(selectedInvoice.subtotalAmount, selectedInvoice.currency)}
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell colSpan={4} className="text-right font-semibold">Plus</TableCell>
                                <TableCell className="text-right font-semibold">
                                  {formatMoney(selectedInvoice.plusAmount, selectedInvoice.currency)}
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell colSpan={4} className="text-right font-semibold">Minus</TableCell>
                                <TableCell className="text-right font-semibold">
                                  {formatMoney(selectedInvoice.minusAmount, selectedInvoice.currency)}
                                </TableCell>
                              </TableRow>
                            </>
                          )}
                          <TableRow>
                            <TableCell colSpan={4} className="text-right text-base font-bold">Total Amount</TableCell>
                            <TableCell className="text-right text-base font-bold">
                              {formatMoney(selectedInvoice.totalAmount, selectedInvoice.currency)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div className="mt-8 space-y-1 text-sm">
                    <p className="font-semibold">Payment Information</p>
                    <p>Payment Method: {selectedInvoice.paymentMethod || '—'}</p>
                    <p>Payment Status: {selectedInvoice.status}</p>
                    <p>Payment Date: {selectedInvoice.paidAt ? new Date(selectedInvoice.paidAt).toLocaleDateString() : '__________'}</p>
                    <p>Receipt No: {selectedInvoice.receiptNo || '__________'}</p>
                  </div>

                  <div className="mt-8 space-y-1 text-sm">
                    <p className="font-semibold">Notes / Terms</p>
                    <p>Please pay before the due date to avoid service suspension.</p>
                    <p>No refund after billing period started.</p>
                    <p>This is a system-generated invoice.</p>
                  </div>
                </div>

                {selectedInvoice.status !== 'paid' ? (
                  <>
                    <Card>
                      <CardHeader>
                        <CardTitle>Adjustments (Admin configurable + / -)</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => addAdjustmentRow('plus')}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Plus Fee
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => addAdjustmentRow('minus')}>
                            <Minus className="mr-2 h-4 w-4" />
                            Add Minus Fee
                          </Button>
                        </div>

                        {adjustmentRows.length === 0 && (
                          <p className="text-sm text-slate-500">No adjustment rows. Add plus or minus fees.</p>
                        )}

                        <div className="space-y-3">
                          {adjustmentRows.map((row, index) => (
                            <div key={index} className="rounded-md border p-3">
                              <div className="grid gap-3 md:grid-cols-6">
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

                                <div>
                                  <Label>Remember</Label>
                                  <div className="mt-2 flex items-center gap-2">
                                    <Checkbox
                                      checked={row.rememberForNext}
                                      onCheckedChange={(checked) =>
                                        updateAdjustmentRow(index, 'rememberForNext', checked === true)
                                      }
                                    />
                                    <span className="text-xs text-slate-600">Use in next invoice</span>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-3 flex justify-end">
                                <Button size="sm" variant="ghost" onClick={() => removeAdjustmentRow(index)}>
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Remove
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="rounded-md border bg-slate-50 p-3 text-sm">
                          <p>Preview Subtotal: {formatMoney(adjustmentPreview.baseSubtotal, selectedInvoice.currency)}</p>
                          <p>Preview Plus: {formatMoney(adjustmentPreview.plusTotal, selectedInvoice.currency)}</p>
                          <p>Preview Minus: {formatMoney(adjustmentPreview.minusTotal, selectedInvoice.currency)}</p>
                          <p className="font-semibold">Preview Total: {formatMoney(adjustmentPreview.total, selectedInvoice.currency)}</p>
                        </div>

                        <div className="flex justify-end">
                          <Button onClick={saveAdjustments} disabled={isSavingAdjustments}>
                            <Save className="mr-2 h-4 w-4" />
                            {isSavingAdjustments ? 'Saving...' : 'Save Adjustments'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Mark Invoice Paid</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <Label>Payment Method</Label>
                            <Input
                              value={paymentMethod}
                              onChange={(event) => setPaymentMethod(event.target.value)}
                              placeholder="KBZPay / Cash / Transfer"
                            />
                          </div>
                          <div>
                            <Label>Receipt No</Label>
                            <Input
                              value={receiptNo}
                              onChange={(event) => setReceiptNo(event.target.value)}
                              placeholder="Optional"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <Button onClick={markInvoicePaid} disabled={isMarkingPaid}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            {isMarkingPaid ? 'Updating...' : 'Mark as Paid'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle>Final Amount (Paid Invoice)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-slate-600">This invoice is already paid and locked.</p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">
                        {formatMoney(selectedInvoice.totalAmount, selectedInvoice.currency)}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
