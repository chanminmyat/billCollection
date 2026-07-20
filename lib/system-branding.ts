export const SYSTEM_BRANDING_STORAGE_KEY = 'billpro_system_branding_v1';
export const SYSTEM_BRANDING_UPDATED_EVENT = 'billpro-system-branding-updated';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || 'http://localhost:4000';

export type SystemBranding = {
  systemName: string;
  systemTagline: string;
  logoDataUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  receiptCompanyName: string;
  receiptAddress: string;
  receiptPhone: string;
  receiptEmail: string;
  footerText: string;
};

export const DEFAULT_SYSTEM_BRANDING: SystemBranding = {
  systemName: 'Bill Pro',
  systemTagline: 'Billing Management System',
  logoDataUrl: null,
  primaryColor: '#2563EB',
  secondaryColor: '#0F172A',
  receiptCompanyName: 'Bill Pro',
  receiptAddress: '',
  receiptPhone: '',
  receiptEmail: '',
  footerText: '',
};

const canUseStorage = () => typeof window !== 'undefined';

export const normalizeBranding = (value: Partial<SystemBranding> | null | undefined): SystemBranding => ({
  systemName: value?.systemName?.trim() || DEFAULT_SYSTEM_BRANDING.systemName,
  systemTagline: value?.systemTagline?.trim() || DEFAULT_SYSTEM_BRANDING.systemTagline,
  logoDataUrl: value?.logoDataUrl?.trim() || null,
  primaryColor: value?.primaryColor?.trim() || DEFAULT_SYSTEM_BRANDING.primaryColor,
  secondaryColor: value?.secondaryColor?.trim() || DEFAULT_SYSTEM_BRANDING.secondaryColor,
  receiptCompanyName:
    value?.receiptCompanyName?.trim() ||
    value?.systemName?.trim() ||
    DEFAULT_SYSTEM_BRANDING.receiptCompanyName,
  receiptAddress: value?.receiptAddress?.trim() || '',
  receiptPhone: value?.receiptPhone?.trim() || '',
  receiptEmail: value?.receiptEmail?.trim() || '',
  footerText: value?.footerText?.trim() || '',
});

const cacheBranding = (branding: SystemBranding) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(SYSTEM_BRANDING_STORAGE_KEY, JSON.stringify(branding));
  window.dispatchEvent(new CustomEvent(SYSTEM_BRANDING_UPDATED_EVENT, { detail: branding }));
};

export const readSystemBranding = (): SystemBranding => {
  if (!canUseStorage()) return DEFAULT_SYSTEM_BRANDING;
  try {
    const raw = window.localStorage.getItem(SYSTEM_BRANDING_STORAGE_KEY);
    if (!raw) return DEFAULT_SYSTEM_BRANDING;
    return normalizeBranding(JSON.parse(raw) as Partial<SystemBranding>);
  } catch {
    return DEFAULT_SYSTEM_BRANDING;
  }
};

export const writeSystemBranding = (branding: Partial<SystemBranding>) => {
  if (!canUseStorage()) return DEFAULT_SYSTEM_BRANDING;
  const normalized = normalizeBranding(branding);
  cacheBranding(normalized);
  return normalized;
};

export const resetSystemBranding = () => {
  if (!canUseStorage()) return DEFAULT_SYSTEM_BRANDING;
  window.localStorage.removeItem(SYSTEM_BRANDING_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(SYSTEM_BRANDING_UPDATED_EVENT, { detail: DEFAULT_SYSTEM_BRANDING }));
  return DEFAULT_SYSTEM_BRANDING;
};

const parseBrandingResponse = async (response: Response) => {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof payload?.message === 'string'
        ? payload.message
        : Array.isArray(payload?.message)
          ? payload.message.join(', ')
          : 'Failed to sync system branding';
    throw new Error(message);
  }
  return normalizeBranding(payload as Partial<SystemBranding>);
};

export const fetchSystemBranding = async () => {
  const response = await fetch(`${API_BASE_URL}/system-settings/branding`, {
    headers: { Accept: 'application/json' },
  });
  const branding = await parseBrandingResponse(response);
  cacheBranding(branding);
  return branding;
};

export const saveSystemBranding = async (branding: Partial<SystemBranding>) => {
  const response = await fetch(`${API_BASE_URL}/system-settings/branding`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(normalizeBranding(branding)),
  });
  const saved = await parseBrandingResponse(response);
  cacheBranding(saved);
  return saved;
};

export const resetSystemBrandingRemote = async () => {
  const response = await fetch(`${API_BASE_URL}/system-settings/branding`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  });
  const branding = await parseBrandingResponse(response);
  cacheBranding(branding);
  return branding;
};
