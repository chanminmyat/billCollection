const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || 'http://localhost:4000';

export const DEFAULT_PLAN_CHANGE_REASONS = [
  'Customer requested upgrade',
  'Customer requested downgrade',
  'Promotion or discount',
  'Plan no longer available',
  'Technical requirement',
];

const unwrapReasons = (payload: unknown): string[] => {
  const value = Array.isArray(payload) ? payload : (payload as { reasons?: unknown[] } | null)?.reasons;
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((reason) => String(reason ?? '').trim()).filter(Boolean)));
};

export const fetchPlanChangeReasons = async () => {
  const response = await fetch(`${API_BASE_URL}/system-settings/plan-change-reasons`, {
    headers: { Accept: 'application/json' },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof payload?.message === 'string' ? payload.message : 'Failed to load plan change reasons');
  return unwrapReasons(payload);
};

export const savePlanChangeReasons = async (reasons: string[]) => {
  const response = await fetch(`${API_BASE_URL}/system-settings/plan-change-reasons`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ reasons: Array.from(new Set(reasons.map((reason) => reason.trim()).filter(Boolean))) }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof payload?.message === 'string' ? payload.message : 'Failed to save plan change reasons');
  return unwrapReasons(payload);
};
