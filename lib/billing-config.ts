export type FirstInvoiceMode = 'fixed' | 'anniversary';

export type FixedBillingWindow = {
  startDay: number;
  dueDay: number;
};

export const BILLING_CONFIG_STORAGE_KEY = 'super_admin_billing_config_v1';

export const DEFAULT_FIXED_BILLING_WINDOW: FixedBillingWindow = {
  startDay: 1,
  dueDay: 15
};

const MIN_DAY = 1;
const MAX_DAY = 31;

const clampDay = (value: number) => {
  if (!Number.isFinite(value)) return MIN_DAY;
  return Math.min(MAX_DAY, Math.max(MIN_DAY, Math.trunc(value)));
};

export const normalizeFixedBillingWindow = (
  value?: Partial<FixedBillingWindow> | null
): FixedBillingWindow => {
  const startDay = clampDay(
    typeof value?.startDay === 'number'
      ? value.startDay
      : DEFAULT_FIXED_BILLING_WINDOW.startDay
  );
  let dueDay = clampDay(
    typeof value?.dueDay === 'number' ? value.dueDay : DEFAULT_FIXED_BILLING_WINDOW.dueDay
  );

  // Keep due day on/after the start day for a clear "start -> due" window.
  if (dueDay < startDay) {
    dueDay = startDay;
  }

  return { startDay, dueDay };
};

export const getFixedBillingWindow = (): FixedBillingWindow => {
  if (typeof window === 'undefined') {
    return DEFAULT_FIXED_BILLING_WINDOW;
  }

  try {
    const raw = window.localStorage.getItem(BILLING_CONFIG_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_FIXED_BILLING_WINDOW;
    }
    const parsed = JSON.parse(raw) as Partial<FixedBillingWindow>;
    return normalizeFixedBillingWindow(parsed);
  } catch {
    return DEFAULT_FIXED_BILLING_WINDOW;
  }
};

export const saveFixedBillingWindow = (
  value: Partial<FixedBillingWindow>
): FixedBillingWindow => {
  const normalized = normalizeFixedBillingWindow(value);

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(BILLING_CONFIG_STORAGE_KEY, JSON.stringify(normalized));
  }

  return normalized;
};
