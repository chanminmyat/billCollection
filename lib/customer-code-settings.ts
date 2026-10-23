const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || 'http://localhost:4000';

export type CustomerCodeSettings = {
  customPrefix: string;
  includeRegion: boolean;
  includeTownship: boolean;
  sequenceMode: 'per_prefix' | 'global';
  sequenceDigits: number;
  regionCodes: Record<string, string>;
  townshipCodes: Record<string, Record<string, string>>;
};

export const EMPTY_CUSTOMER_CODE_SETTINGS: CustomerCodeSettings = {
  customPrefix: '',
  includeRegion: true,
  includeTownship: true,
  sequenceMode: 'per_prefix',
  sequenceDigits: 3,
  regionCodes: {},
  townshipCodes: {},
};

const normalizeCode = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);

export const fallbackLocationCode = (value: string, fallback: string) =>
  normalizeCode(value).slice(0, 3) || fallback;

export const normalizeCustomerCodeSettings = (value: unknown): CustomerCodeSettings => {
  const source = value && typeof value === 'object' ? value as Partial<CustomerCodeSettings> : {};
  const customPrefix = normalizeCode(source.customPrefix);
  const includeRegion = typeof source.includeRegion === 'boolean' ? source.includeRegion : true;
  const includeTownship = typeof source.includeTownship === 'boolean' ? source.includeTownship : true;
  const sequenceMode = source.sequenceMode === 'global' ? 'global' : 'per_prefix';
  const sequenceDigits = Math.min(10, Math.max(1, Math.floor(Number(source.sequenceDigits) || 3)));
  const regionCodes: Record<string, string> = {};
  Object.entries(source.regionCodes ?? {}).forEach(([name, code]) => {
    const normalized = normalizeCode(code);
    if (name.trim() && normalized) regionCodes[name.trim()] = normalized;
  });

  const townshipCodes: Record<string, Record<string, string>> = {};
  Object.entries(source.townshipCodes ?? {}).forEach(([region, codes]) => {
    if (!codes || typeof codes !== 'object' || Array.isArray(codes)) return;
    const normalizedCodes: Record<string, string> = {};
    Object.entries(codes).forEach(([name, code]) => {
      const normalized = normalizeCode(code);
      if (name.trim() && normalized) normalizedCodes[name.trim()] = normalized;
    });
    if (region.trim() && Object.keys(normalizedCodes).length > 0) {
      townshipCodes[region.trim()] = normalizedCodes;
    }
  });

  return {
    customPrefix,
    includeRegion,
    includeTownship,
    sequenceMode,
    sequenceDigits,
    regionCodes,
    townshipCodes,
  };
};

const parseResponse = async (response: Response) => {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = Array.isArray(payload?.message)
      ? payload.message.join(', ')
      : payload?.message || 'Failed to save customer code settings.';
    throw new Error(message);
  }
  return normalizeCustomerCodeSettings(payload);
};

export const fetchCustomerCodeSettings = async () => {
  const response = await fetch(`${API_BASE_URL}/system-settings/customer-code`, {
    headers: { Accept: 'application/json' },
  });
  return parseResponse(response);
};

export const saveCustomerCodeSettings = async (settings: CustomerCodeSettings) => {
  const response = await fetch(`${API_BASE_URL}/system-settings/customer-code`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(normalizeCustomerCodeSettings(settings)),
  });
  return parseResponse(response);
};
