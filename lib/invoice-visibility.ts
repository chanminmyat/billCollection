const RELEASE_DATE_KEYS = [
  'scheduledReleaseDate',
  'releaseDate',
  'availableAt',
  'publishAt',
  'releaseAt',
] as const;

const HIDDEN_STATUS_SET = new Set(['scheduled', 'pending_release', 'queued', 'draft']);

const parseDateSafe = (value: unknown): Date | null => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const atStartOfDay = (date: Date) => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

export const getInvoiceReleaseDate = (invoice: unknown): Date | null => {
  if (!invoice || typeof invoice !== 'object') return null;

  for (const key of RELEASE_DATE_KEYS) {
    const value = (invoice as Record<string, unknown>)[key];
    const parsed = parseDateSafe(value);
    if (parsed) return parsed;
  }

  return null;
};

export const isInvoiceReleased = (invoice: unknown, now: Date = new Date()) => {
  if (!invoice || typeof invoice !== 'object') return true;
  const record = invoice as Record<string, unknown>;

  const status = String(record.status ?? '').toLowerCase();
  if (HIDDEN_STATUS_SET.has(status)) {
    return false;
  }

  const today = atStartOfDay(now);
  const releaseDate = getInvoiceReleaseDate(record);
  if (releaseDate && atStartOfDay(releaseDate).getTime() > today.getTime()) {
    return false;
  }

  // Fallback: if backend doesn't send explicit release date but billing period starts in future,
  // keep it hidden until period start.
  const billingPeriodFrom = parseDateSafe(record.billingPeriodFrom);
  if (billingPeriodFrom && atStartOfDay(billingPeriodFrom).getTime() > today.getTime()) {
    return false;
  }

  return true;
};

export const filterReleasedInvoices = <T>(invoices: T[], now: Date = new Date()) =>
  invoices.filter((invoice) => isInvoiceReleased(invoice, now));
