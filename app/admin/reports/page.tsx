'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '@/app/components/layout';
import { useAuth } from '@/app/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, RefreshCw } from 'lucide-react';
import townshipData from '@/lib/township.json';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
type ReportType = 'headcount' | 'collection' | 'invoice-history' | 'plans' | 'plan-history' | 'rules' | 'payment-terms' | 'status-history';
type AnyRow = Record<string, any>;
type StatusHistory = {
  id: string; entityType: string; entityId: string; entityCode?: string; entityName?: string;
  previousStatus: string; status: string; reason: string; source: string; actorName: string; changedAt: string;
};
type PlanHistory = {
  id: string; customerId: string; customerCode: string; customerName: string; customerPhone?: string;
  previousPlanId?: string; previousPlanCode?: string; previousPlanName?: string; previousMonthlyFee?: string | number;
  newPlanId?: string; newPlanCode?: string; newPlanName?: string; newMonthlyFee?: string | number;
  effectiveDate?: string; actorId?: string; actorRole?: string; actorName: string; source: string; changedAt: string;
};

const REPORTS: Array<{ id: ReportType; label: string; description: string }> = [
  { id: 'headcount', label: 'Customer / Headcount', description: 'Customer register and customer status counts. Date range uses customer creation date.' },
  { id: 'collection', label: 'Collection', description: 'Invoice collection, paid amounts, outstanding balances and payment methods. Date range uses payment date for paid invoices, otherwise invoice date.' },
  { id: 'invoice-history', label: 'Invoice Revisions', description: 'Invoices revised by an admin, with the previous and replacement invoice numbers, revision date, reason, and customer details. Date range uses the revision date.' },
  { id: 'plans', label: 'Plans', description: 'Customer counts and recurring plan fees by subscribed plan. Date range uses customer creation date.' },
  { id: 'plan-history', label: 'Plan Changes', description: 'Customer-by-customer plan changes with previous and new plans, fee changes, date, and the admin who made the update. History is recorded from the time this backend feature is deployed.' },
  { id: 'rules', label: 'Billing Rules', description: 'Customers grouped by assigned billing rule and rule configuration.' },
  { id: 'payment-terms', label: 'Payment Terms', description: 'Customer counts by prepaid/postpaid timing and billing schedule.' },
  { id: 'status-history', label: 'Status Changes', description: 'Customer and collector status changes, including the saved reason and automatic system transitions. Date range uses change date.' },
];

const unwrap = (value: any, key: string) => Array.isArray(value) ? value : Array.isArray(value?.[key]) ? value[key] : Array.isArray(value?.data) ? value.data : [];
const nameOf = (customer: AnyRow) => String(customer?.companyName || customer?.personalName || customer?.user?.name || customer?.name || '—');
const amountOf = (value: unknown) => Number.parseFloat(String(value ?? 0)) || 0;
const money = (value: unknown) => `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(amountOf(value))} MMK`;
const dateValue = (value: unknown) => {
  if (!value) return '';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toISOString().slice(0, 10);
};
const addressParts = (customer: AnyRow) => {
  const raw = customer?.installationAddress ?? customer?.installation_address ?? '';
  if (raw && typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try { const parsed = JSON.parse(raw); if (parsed && typeof parsed === 'object') return parsed; } catch { /* stored as a formatted address */ }
  }
  return {};
};
const locationOf = (customer: AnyRow, key: 'region' | 'township' | 'city') => {
  const raw = customer?.installationAddress ?? customer?.installation_address ?? '';
  const address = addressParts(customer);
  const direct = address?.[key] ?? customer?.[key] ?? customer?.installationLocation?.[key];
  if (direct) return String(direct);
  if (key === 'township') {
    const explicit = customer?.installationTownship ?? customer?.currentTownship ?? customer?.township;
    if (explicit) return String(explicit);
  }
  if (key === 'region') {
    const explicit = customer?.installationRegion ?? customer?.region;
    if (explicit) return String(explicit);
  }
  // Older API records store only the formatted address string. Resolve exact
  // location names against the bundled reference data instead of guessing from
  // abbreviations or splitting arbitrary address words.
  const text = typeof raw === 'string' ? raw : '';
  const tokens = text.split(',').map((part: string) => part.trim()).filter(Boolean);
  const locations = townshipData as Record<string, Record<string, string[]>>;
  if (key === 'region') {
    const regions = Object.keys(locations);
    return tokens.find((token: string) => regions.includes(token)) ?? '';
  }
  if (key === 'township') {
    for (const districts of Object.values(locations)) {
      for (const townships of Object.values(districts)) {
        const found = tokens.find((token: string) => townships.includes(token));
        if (found) return found;
      }
    }
  }
  return String(customer?.city ?? '');
};
const planOf = (customer: AnyRow) => customer?.subscription?.plan ?? customer?.plan ?? {};
const paymentTermOf = (rule: AnyRow | undefined) => String(rule?.prepaidPostpaid ?? rule?.paymentTiming ?? rule?.billingModel ?? rule?.billingType ?? 'Unassigned');
const safeDate = (value: unknown) => dateValue(value);
const inRange = (value: unknown, from: string, to: string) => {
  if (!from && !to) return true;
  const date = safeDate(value);
  return Boolean(date) && (!from || date >= from) && (!to || date <= to);
};
const unique = (items: string[]) => Array.from(new Set(items.filter(Boolean))).sort((a, b) => a.localeCompare(b));
const columnsByReport: Record<ReportType, string[]> = {
  headcount: ['Customer ID', 'Customer Name', 'Phone No', 'Address', 'Region', 'City', 'Installation Township', 'Installation Plan', 'Current Township', 'Current Plan', 'Installation Date', 'Collect Day', 'Amount', 'Status', 'Status Date', 'Remark', 'Collector', 'Billing Rule'],
  collection: ['Invoice No', 'Customer ID', 'Customer Name', 'Phone No', 'Township', 'Billing Period', 'Invoice Date', 'Due Date', 'Paid Date', 'Amount', 'Status', 'Payment Method', 'Receipt No', 'Collector', 'Billing Rule'],
  'invoice-history': ['Revision Date', 'Previous Invoice No', 'New Invoice No', 'Customer ID', 'Customer Name', 'Phone No', 'Region', 'Township', 'Reason for Edit', 'Changed By'],
  plans: ['Customer ID', 'Customer Name', 'Phone No', 'Region', 'Township', 'Current Plan', 'Plan Code', 'Monthly Fee (MMK)', 'Plan Start Date', 'Billing Rule', 'Customer Status'],
  'plan-history': ['Change Date', 'Customer ID', 'Customer Name', 'Phone No', 'Region', 'Township', 'Previous Plan', 'Previous Plan Code', 'Previous Fee (MMK)', 'New Plan', 'New Plan Code', 'New Fee (MMK)', 'Current Plan', 'Billing Rule', 'Changed By', 'Actor ID', 'Actor Role', 'Source'],
  rules: ['Billing Rule', 'Billing Model', 'Billing Type', 'Payment Timing', 'Billing Mode', 'Due After Days', 'Active', 'Customers'],
  'payment-terms': ['Payment Timing', 'Billing Model', 'Billing Mode', 'Customers', 'Monthly Fees (MMK)'],
  'status-history': ['Date', 'Type', 'Customer / Collector ID', 'Name', 'Phone No', 'Region', 'Township', 'Current Plan', 'Previous Status', 'New Status', 'Current Status', 'Reason / Note', 'Change Source', 'Changed By'],
};

export default function ReportsPage() {
  const { user, isLoading } = useAuth();
  const [report, setReport] = useState<ReportType>('headcount');
  const [customers, setCustomers] = useState<AnyRow[]>([]);
  const [invoices, setInvoices] = useState<AnyRow[]>([]);
  const [collectors, setCollectors] = useState<AnyRow[]>([]);
  const [rules, setRules] = useState<AnyRow[]>([]);
  const [history, setHistory] = useState<StatusHistory[]>([]);
  const [planHistory, setPlanHistory] = useState<PlanHistory[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [region, setRegion] = useState('all');
  const [township, setTownship] = useState('all');
  const [status, setStatus] = useState('all');
  const [collector, setCollector] = useState('all');
  const [plan, setPlan] = useState('all');
  const [rule, setRule] = useState('all');
  const [term, setTerm] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true); setError('');
    const requests = [
      ['customers', '/customers'], ['invoices', '/billing/invoices'], ['collectors', '/collectors'],
      ['rules', '/billing/rules'], ['history', '/system-settings/status-history'], ['planHistory', '/system-settings/customer-plan-history'],
    ] as const;
    const results = await Promise.all(requests.map(async ([key, path]) => {
      try {
        const response = await fetch(`${API_BASE_URL}${path}`, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error(`${key}: ${response.status}`);
        return { key, data: await response.json() };
      } catch (cause) { return { key, error: cause instanceof Error ? cause.message : `${key} unavailable` }; }
    }));
    const failed = results.filter((result) => 'error' in result);
    for (const result of results) {
      if ('error' in result) continue;
      if (result.key === 'customers') setCustomers(unwrap(result.data, 'customers'));
      if (result.key === 'invoices') setInvoices(unwrap(result.data, 'invoices'));
      if (result.key === 'collectors') setCollectors(unwrap(result.data, 'collectors'));
      if (result.key === 'rules') setRules(unwrap(result.data, 'rules'));
      if (result.key === 'history') setHistory(unwrap(result.data, 'history'));
      if (result.key === 'planHistory') setPlanHistory(unwrap(result.data, 'history'));
    }
    if (failed.length) setError(`Some report data could not be loaded (${failed.map((x) => x.key).join(', ')}). Refresh or check your access; available report data is still shown.`);
    setLoading(false);
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const customerById = useMemo(() => new Map(customers.map((item) => [String(item.id), item])), [customers]);
  const ruleById = useMemo(() => new Map(rules.map((item) => [String(item.id), item])), [rules]);
  const collectorByCode = useMemo(() => new Map(collectors.flatMap((item) => [[String(item.collectorCode ?? ''), item], [String(item.id ?? ''), item]])), [collectors]);
  const latestStatusByCustomer = useMemo(() => {
    const latest = new Map<string, StatusHistory>();
    history.filter((entry) => entry.entityType === 'customer').forEach((entry) => {
      const current = latest.get(String(entry.entityId));
      if (!current || String(entry.changedAt).localeCompare(String(current.changedAt)) > 0) latest.set(String(entry.entityId), entry);
    });
    return latest;
  }, [history]);
  const options = useMemo(() => ({
    regions: unique(customers.map((c) => locationOf(c, 'region'))),
    townships: unique(customers.map((c) => locationOf(c, 'township'))),
    statuses: unique(customers.map((c) => String(c.status ?? ''))),
    collectors: unique(collectors.map((c) => String(c.user?.name ?? c.name ?? c.collectorCode ?? ''))),
    plans: unique([...customers.map((c) => String(planOf(c).planName ?? planOf(c).name ?? planOf(c).planCode ?? '')), ...planHistory.flatMap((entry) => [String(entry.previousPlanName ?? entry.previousPlanCode ?? ''), String(entry.newPlanName ?? entry.newPlanCode ?? '')])]),
    rules: unique(rules.map((r) => String(r.name ?? ''))),
    terms: unique(rules.map(paymentTermOf)),
  }), [customers, collectors, rules, planHistory]);

  const matchesCustomer = useCallback((customer: AnyRow) => {
    const customerRule = ruleById.get(String(customer.billingRuleId ?? '')) ?? rules.find((r) => r.name === customer.billingRuleName);
    const collectorItem = collectorByCode.get(String(customer.collectorCode ?? ''));
    const customerCollector = String(collectorItem?.user?.name ?? collectorItem?.name ?? customer.collectorCode ?? '');
    const customerPlan = String(planOf(customer).planName ?? planOf(customer).name ?? planOf(customer).planCode ?? '');
    const customerTerm = paymentTermOf(customerRule);
    const keyword = search.trim().toLowerCase();
    const haystack = [customer.customerCode, nameOf(customer), customer.primaryPhone, customer.contactEmail, customer.installationAddress, customerCollector, customerPlan, customer.billingRuleName].join(' ').toLowerCase();
    return (region === 'all' || locationOf(customer, 'region') === region)
      && (township === 'all' || locationOf(customer, 'township') === township)
      && (status === 'all' || String(customer.status ?? '').toLowerCase() === status.toLowerCase())
      && (collector === 'all' || customerCollector === collector)
      && (plan === 'all' || customerPlan === plan)
      && (rule === 'all' || String(customer.billingRuleName ?? customerRule?.name ?? '') === rule)
      && (term === 'all' || customerTerm === term)
      && (!keyword || haystack.includes(keyword));
  }, [ruleById, rules, collectorByCode, search, region, township, status, collector, plan, rule, term]);

  const filteredCustomers = useMemo(() => customers.filter((customer) => matchesCustomer(customer) && inRange(customer.createdAt, from, to)), [customers, matchesCustomer, from, to]);
  const filteredInvoices = useMemo(() => invoices.filter((invoice) => {
    const customer = invoice.customer ?? customerById.get(String(invoice.customerId ?? '')) ?? {};
    const date = String(invoice.status).toLowerCase() === 'paid' ? (invoice.paidAt ?? invoice.paidDate ?? invoice.invoiceDate) : (invoice.invoiceDate ?? invoice.issuedAt);
    if (!inRange(date, from, to) || !matchesCustomer(customer)) return false;
    const keyword = search.trim().toLowerCase();
    return !keyword || [invoice.invoiceNo, invoice.receiptNo, nameOf(customer), customer.customerCode, customer.primaryPhone].join(' ').toLowerCase().includes(keyword);
  }), [invoices, customerById, from, to, matchesCustomer, search]);
  const filteredInvoiceRevisions = useMemo(() => invoices.flatMap((invoice) => {
    const events = Array.isArray(invoice.collectionEvents) ? invoice.collectionEvents : [];
    const customer = invoice.customer ?? customerById.get(String(invoice.customerId ?? '')) ?? {};
    const keyword = search.trim().toLowerCase();
    return events
      .filter((event: AnyRow) => event.type === 'invoice_edited_revision')
      .filter((event: AnyRow) => inRange(event.timestamp, from, to) && matchesCustomer(customer))
      .filter((event: AnyRow) => !keyword || [invoice.invoiceNo, event.relatedInvoiceNo, event.relatedInvoiceId, event.note, event.actorName, nameOf(customer), customer.customerCode, customer.primaryPhone].join(' ').toLowerCase().includes(keyword))
      .map((event: AnyRow) => ({ invoice, event, customer }));
  }), [invoices, customerById, from, to, matchesCustomer, search]);
  const filteredHistory = useMemo(() => history.filter((entry) => {
    const customer = customerById.get(String(entry.entityId)) ?? {};
    const keyword = search.trim().toLowerCase();
    return inRange(entry.changedAt, from, to)
      && (status === 'all' || String(entry.status).toLowerCase() === status.toLowerCase())
      && (region === 'all' || locationOf(customer, 'region') === region)
      && (township === 'all' || locationOf(customer, 'township') === township)
      && (!keyword || [entry.entityCode, entry.entityName, entry.reason, entry.actorName, entry.previousStatus, entry.status].join(' ').toLowerCase().includes(keyword));
  }), [history, customerById, from, to, status, region, township, search]);
  const filteredPlanHistory = useMemo(() => planHistory.filter((entry) => {
    const customer = customerById.get(String(entry.customerId)) ?? {};
    const newPlanView = { ...customer, subscription: { ...customer.subscription, plan: {
      ...planOf(customer), planName: entry.newPlanName, planCode: entry.newPlanCode, monthlyFee: entry.newMonthlyFee,
    } } };
    const keyword = search.trim().toLowerCase();
    return inRange(entry.effectiveDate ?? entry.changedAt, from, to)
      && matchesCustomer(newPlanView)
      && (!keyword || [entry.customerCode, entry.customerName, entry.customerPhone, entry.previousPlanName, entry.previousPlanCode, entry.newPlanName, entry.newPlanCode, entry.actorName].join(' ').toLowerCase().includes(keyword));
  }), [planHistory, customerById, from, to, matchesCustomer, search]);

  const rows: AnyRow[] = useMemo(() => {
    if (report === 'headcount') return filteredCustomers.map((customer) => {
      const subscription = customer.subscription ?? {};
      const p = planOf(customer);
      const currentTownship = locationOf(customer, 'township');
      const assignedCollector = collectorByCode.get(String(customer.collectorCode ?? ''));
      const billingRule = ruleById.get(String(customer.billingRuleId ?? ''));
      const lastStatusChange = latestStatusByCustomer.get(String(customer.id));
      return {
        'Customer ID': customer.customerCode ?? customer.accountNumber ?? customer.id,
        'Customer Name': nameOf(customer), 'Phone No': customer.primaryPhone ?? customer.user?.phone ?? '',
        Address: customer.installationAddress ?? '', Region: locationOf(customer, 'region'), City: locationOf(customer, 'city'),
        'Installation Township': locationOf(customer, 'township'), 'Installation Plan': customer.installationPlanName ?? customer.initialPlanName ?? '',
        'Current Township': currentTownship, 'Current Plan': p.planName ?? p.planCode ?? '',
        'Installation Date': subscription.installationDate ?? subscription.serviceStartDate ?? '',
        'Collect Day': customer.collectionDay ?? customer.collectDay ?? '',
        Amount: amountOf(p.monthlyFee ?? customer.monthlyFee), Status: customer.status ?? '',
        'Status Date': lastStatusChange?.changedAt ?? customer.statusChangedAt ?? '', Remark: lastStatusChange?.reason ?? customer.statusDescription ?? customer.remark ?? '',
        Collector: assignedCollector?.user?.name ?? assignedCollector?.name ?? customer.collectorCode ?? '',
        'Billing Rule': customer.billingRuleName ?? billingRule?.name ?? '',
      };
    });
    if (report === 'collection') return filteredInvoices.map((invoice) => {
      const customer = invoice.customer ?? customerById.get(String(invoice.customerId ?? '')) ?? {};
      const c = collectorByCode.get(String(customer.collectorCode ?? invoice.collectorCode ?? ''));
      const statusValue = String(invoice.status ?? 'unpaid').toLowerCase();
      return {
        'Invoice No': invoice.invoiceNo ?? invoice.id, 'Customer ID': customer.customerCode ?? '',
        'Customer Name': nameOf(customer), 'Phone No': customer.primaryPhone ?? '', Township: locationOf(customer, 'township'),
        'Billing Period': invoice.billingPeriodFrom && invoice.billingPeriodTo ? `${invoice.billingPeriodFrom} - ${invoice.billingPeriodTo}` : invoice.billingMonth ?? '',
        'Invoice Date': invoice.invoiceDate ?? invoice.issuedAt ?? '', 'Due Date': invoice.dueDate ?? '',
        'Paid Date': invoice.paidAt ?? invoice.paidDate ?? '', Amount: amountOf(invoice.totalAmount ?? invoice.amount),
        Status: statusValue, 'Payment Method': invoice.paymentMethod ?? '', 'Receipt No': invoice.receiptNo ?? '',
        Collector: c?.user?.name ?? c?.name ?? customer.collectorCode ?? '', 'Billing Rule': invoice.billingRuleName ?? customer.billingRuleName ?? '',
      };
    });
    if (report === 'invoice-history') return filteredInvoiceRevisions.map(({ invoice, event, customer }) => ({
      'Revision Date': event.timestamp,
      'Previous Invoice No': event.relatedInvoiceNo || event.relatedInvoiceId || '—',
      'New Invoice No': invoice.invoiceNo ?? invoice.id,
      'Customer ID': customer.customerCode ?? '',
      'Customer Name': nameOf(customer),
      'Phone No': customer.primaryPhone ?? '',
      Region: locationOf(customer, 'region'),
      Township: locationOf(customer, 'township'),
      'Reason for Edit': event.note ?? '',
      'Changed By': event.actorName ?? event.actorRole ?? 'Admin',
    }));
    if (report === 'status-history') return filteredHistory.map((entry) => {
      const customer = customerById.get(String(entry.entityId));
      const collectorProfile = collectors.find((item) => String(item.id) === String(entry.entityId));
      const currentPlan = customer ? planOf(customer) : {};
      return {
        Date: entry.changedAt, Type: entry.entityType, 'Customer / Collector ID': entry.entityCode ?? customer?.customerCode ?? collectorProfile?.collectorCode ?? entry.entityId,
        Name: entry.entityName ?? (customer ? nameOf(customer) : collectorProfile?.user?.name ?? '—'),
        'Phone No': customer?.primaryPhone ?? collectorProfile?.user?.phone ?? '',
        Region: customer ? locationOf(customer, 'region') : '', Township: customer ? locationOf(customer, 'township') : '',
        'Current Plan': currentPlan.planName ?? currentPlan.planCode ?? '',
        'Previous Status': entry.previousStatus, 'New Status': entry.status,
        'Current Status': customer?.status ?? collectorProfile?.status ?? entry.status,
        'Reason / Note': entry.reason, 'Change Source': entry.source, 'Changed By': entry.actorName,
      };
    });
    if (report === 'plans') {
      return filteredCustomers.map((customer) => {
        const currentPlan = planOf(customer);
        const assignedRule = ruleById.get(String(customer.billingRuleId ?? ''));
        return {
          'Customer ID': customer.customerCode ?? customer.id, 'Customer Name': nameOf(customer),
          'Phone No': customer.primaryPhone ?? '', Region: locationOf(customer, 'region'), Township: locationOf(customer, 'township'),
          'Current Plan': currentPlan.planName ?? currentPlan.name ?? currentPlan.planCode ?? 'Unassigned',
          'Plan Code': currentPlan.planCode ?? '', 'Monthly Fee (MMK)': amountOf(currentPlan.monthlyFee ?? customer.monthlyFee),
          'Plan Start Date': customer.subscription?.serviceStartDate ?? customer.subscription?.installationDate ?? '',
          'Billing Rule': customer.billingRuleName ?? assignedRule?.name ?? '', 'Customer Status': customer.status ?? '',
        };
      });
    }
    if (report === 'plan-history') return filteredPlanHistory.map((entry) => {
      const customer = customerById.get(String(entry.customerId)) ?? {};
      const currentPlan = planOf(customer);
      const assignedRule = ruleById.get(String(customer.billingRuleId ?? ''));
      return {
        'Change Date': entry.effectiveDate ?? entry.changedAt, 'Customer ID': entry.customerCode || customer.customerCode || entry.customerId,
        'Customer Name': entry.customerName || nameOf(customer), 'Phone No': entry.customerPhone || customer.primaryPhone || '',
        Region: locationOf(customer, 'region'), Township: locationOf(customer, 'township'),
        'Previous Plan': entry.previousPlanName || (entry.previousPlanCode ? '' : 'No previous plan'),
        'Previous Plan Code': entry.previousPlanCode ?? '', 'Previous Fee (MMK)': amountOf(entry.previousMonthlyFee),
        'New Plan': entry.newPlanName ?? '', 'New Plan Code': entry.newPlanCode ?? '',
        'New Fee (MMK)': amountOf(entry.newMonthlyFee), 'Current Plan': currentPlan.planName ?? currentPlan.planCode ?? '',
        'Billing Rule': customer.billingRuleName ?? assignedRule?.name ?? '',
        'Changed By': entry.actorName, 'Actor ID': entry.actorId ?? '', 'Actor Role': entry.actorRole ?? '', Source: entry.source,
      };
    });
    if (report === 'rules') return rules.filter((item) => rule === 'all' || item.name === rule).map((item) => ({
      'Billing Rule': item.name ?? 'Unnamed', 'Billing Model': item.billingModel ?? item.billingType ?? '',
      'Billing Type': item.billingType ?? '', 'Payment Timing': paymentTermOf(item), 'Billing Mode': item.billingMode ?? item.cycle ?? '',
      'Due After Days': item.dueAfterDays ?? '', Active: item.isActive === false ? 'No' : 'Yes',
      Customers: filteredCustomers.filter((customer) => String(customer.billingRuleId ?? '') === String(item.id) || customer.billingRuleName === item.name).length,
    }));
    const groups = new Map<string, { model: string; count: number; amount: number }>();
    for (const customer of filteredCustomers) {
      const billingRule = ruleById.get(String(customer.billingRuleId ?? '')) ?? rules.find((r) => r.name === customer.billingRuleName);
      const paymentTiming = paymentTermOf(billingRule);
      const billingModel = String(billingRule?.billingModel ?? billingRule?.billingType ?? 'Recurring');
      const key = `${paymentTiming} | ${billingModel}`;
      const group = groups.get(key) ?? { model: billingModel, count: 0, amount: 0 };
      group.count += 1; group.amount += amountOf(planOf(customer).monthlyFee); groups.set(key, group);
    }
    return Array.from(groups.entries()).map(([key, value]) => ({ 'Payment Timing': key.split(' | ')[0], 'Billing Model': value.model, 'Billing Mode': '', Customers: value.count, 'Monthly Fees (MMK)': value.amount }));
  }, [report, filteredCustomers, filteredInvoices, filteredInvoiceRevisions, filteredHistory, filteredPlanHistory, rules, rule, ruleById, collectorByCode, customerById, collectors, latestStatusByCustomer]);

  const reportTotal = useMemo(() => {
    if (report === 'collection') return rows.reduce((sum, row) => sum + (String(row.Status).toLowerCase() === 'paid' ? amountOf(row.Amount) : 0), 0);
    if (report === 'headcount') return rows.length;
    if (report === 'status-history' || report === 'plan-history' || report === 'invoice-history') return rows.length;
    return rows.reduce((sum, row) => sum + amountOf(row['Monthly Fees (MMK)'] ?? row['Monthly Fee (MMK)']), 0);
  }, [report, rows]);

  const exportExcel = async () => {
    setExporting(true);
    try {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'ISP Billing System'; workbook.created = new Date();
      const summary = workbook.addWorksheet('Report Summary');
      summary.addRows([
        ['ISP Billing System — Report'], ['Report', REPORTS.find((item) => item.id === report)?.label ?? report],
        ['Date range', `${from || 'All dates'} to ${to || 'All dates'}`], ['Generated at', new Date().toLocaleString()],
        ['Applied filters', [`Region: ${region}`, `Township: ${township}`, `Status: ${status}`, `Collector: ${collector}`, `Plan: ${plan}`, `Rule: ${rule}`, `Payment term: ${term}`, `Search: ${search || '—'}`].join(' | ')],
        ['Rows', rows.length], [report === 'collection' ? 'Paid total (MMK)' : 'Monthly total / count', reportTotal],
      ]);
      summary.getRow(1).font = { bold: true, size: 16, color: { argb: 'FF1D4ED8' } };
      summary.columns = [{ width: 28 }, { width: 100 }];
      const sheet = workbook.addWorksheet((REPORTS.find((item) => item.id === report)?.label ?? 'Report').slice(0, 31));
      const headers = columnsByReport[report];
      sheet.addRow(headers);
      rows.forEach((row) => sheet.addRow(headers.map((header) => row[header] ?? '')));
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
      sheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + Math.min(headers.length, 26))}1` };
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
      sheet.columns = headers.map((header) => ({ header, width: Math.max(16, Math.min(36, header.length + 6)) }));
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `ISP-${report}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? `Excel export failed: ${cause.message}` : 'Excel export failed.');
    } finally { setExporting(false); }
  };

  if (isLoading) return <div className="min-h-screen bg-slate-50" />;
  if (!user || user.role !== 'admin') return <div>Access denied</div>;
  const activeDescription = REPORTS.find((item) => item.id === report)?.description;
  const filterSelect = (label: string, value: string, setValue: (value: string) => void, values: string[]) => (
    <label className="flex min-w-36 flex-col gap-1 text-xs font-medium text-slate-600">{label}
      <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900" value={value} onChange={(event) => setValue(event.target.value)}>
        <option value="all">All {label.toLowerCase()}</option>{values.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </label>
  );
  const formatCell = (header: string, value: unknown) => {
    if (value == null || value === '') return '—';
    if (header === 'Amount' || header.includes('(MMK)')) return money(value);
    if ((header === 'Date' || header === 'Change Date' || header === 'Revision Date') && typeof value === 'string' && value.includes('T')) {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
    }
    if (header.toLowerCase().includes('date')) return safeDate(value) || String(value);
    return String(value);
  };
  const reportColumnWidth = (header: string) => {
    if (header === 'Address' || header === 'Reason for Edit' || header === 'Reason / Note') return 260;
    if (header === 'Customer Name' || header === 'Billing Period') return 180;
    if (header === 'Region' || header === 'Township' || header === 'Installation Township' || header === 'Current Township') return 150;
    if (header.includes('Date')) return 145;
    if (header.includes('Amount') || header.includes('(MMK)')) return 135;
    return 140;
  };

  return <Layout>
    <div className="space-y-5 p-1 sm:p-2">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div><h1 className="text-2xl font-bold text-slate-900">Reports</h1><p className="mt-1 text-sm text-slate-500">Live operational reports from your ISP billing data</p></div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadData()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
          <Button onClick={() => void exportExcel()} disabled={exporting || loading}><Download className="mr-2 h-4 w-4" />{exporting ? 'Preparing…' : 'Export Excel'}</Button>
        </div>
      </div>
      {error && <div role="alert" className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</div>}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">{REPORTS.map((item) => <button key={item.id} onClick={() => setReport(item.id)} className={`rounded-lg border px-3 py-3 text-left text-sm font-semibold transition ${report === item.id ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>{item.label}</button>)}</div>

      <Card><CardHeader className="pb-3"><CardTitle className="text-base">Report filters</CardTitle><p className="text-sm text-slate-500">{activeDescription}</p></CardHeader><CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">From date<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 rounded-md border border-slate-200 px-3 text-sm" /></label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">To date<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 rounded-md border border-slate-200 px-3 text-sm" /></label>
          {filterSelect('Region', region, setRegion, options.regions)}
          {filterSelect('Township', township, setTownship, options.townships)}
          {filterSelect('Status', status, setStatus, unique([...options.statuses, ...history.map((x) => x.status)]))}
          {filterSelect('Collector', collector, setCollector, options.collectors)}
          {filterSelect('Plan', plan, setPlan, options.plans)}
          {filterSelect('Rule', rule, setRule, options.rules)}
          {filterSelect('Payment term', term, setTerm, options.terms)}
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">Search<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, ID, phone, reason…" className="h-10 rounded-md border border-slate-200 px-3 text-sm" /></label>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm text-slate-600"><span>{rows.length.toLocaleString()} result{rows.length === 1 ? '' : 's'}</span><span>{report === 'collection' ? `Paid total in results: ${money(reportTotal)}` : report === 'headcount' || report === 'status-history' || report === 'plan-history' || report === 'invoice-history' ? `${reportTotal.toLocaleString()} ${report === 'headcount' ? 'customers' : report === 'plan-history' ? 'plan changes' : report === 'invoice-history' ? 'invoice revisions' : 'status changes'}` : `Monthly total in results: ${money(reportTotal)}`}</span></div>
      </CardContent></Card>

      <Card><CardContent className="p-0"><div className="max-h-[70vh] overflow-auto rounded-lg"><table className="table-fixed border-collapse text-left text-sm" style={{ width: `${columnsByReport[report].reduce((total, header) => total + reportColumnWidth(header), 0)}px`, minWidth: '100%' }}><colgroup>{columnsByReport[report].map((header) => <col key={header} style={{ width: `${reportColumnWidth(header)}px` }} />)}</colgroup><thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase tracking-wide text-slate-600"><tr>{columnsByReport[report].map((header) => <th key={header} className="overflow-hidden text-ellipsis whitespace-nowrap border-b px-3 py-3 font-semibold" title={header}>{header}</th>)}</tr></thead><tbody>{loading && rows.length === 0 ? <tr><td colSpan={columnsByReport[report].length} className="px-4 py-12 text-center text-slate-500">Loading live report data…</td></tr> : rows.length === 0 ? <tr><td colSpan={columnsByReport[report].length} className="px-4 py-12 text-center text-slate-500">No records match these filters.</td></tr> : rows.map((row, index) => <tr key={String(row['Invoice No'] ?? row['New Invoice No'] ?? row['Customer ID'] ?? row['Billing Rule'] ?? row['Plan'] ?? row.Date ?? index)} className="border-b last:border-0 hover:bg-slate-50">{columnsByReport[report].map((header) => <td key={header} className="overflow-hidden text-ellipsis whitespace-nowrap px-3 py-3 text-slate-700" title={String(row[header] ?? '')}>{formatCell(header, row[header])}</td>)}</tr>)}</tbody></table></div></CardContent></Card>
      <p className="text-xs text-slate-500">Amounts are shown in MMK. Excel export contains this report with the current filters and a summary of the filters used.</p>
    </div>
  </Layout>;
}
