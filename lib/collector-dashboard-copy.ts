import rawCollectorDashboardCopy from './collector-dashboard-copy.json';

export const COLLECTOR_DASHBOARD_COPY_UPDATED_EVENT = 'collector_dashboard_copy_updated';
export const COLLECTOR_DASHBOARD_COPY_UPDATED_AT_STORAGE_KEY = 'collector_dashboard_copy_updated_at';

type CollectorDashboardLanguage = 'en' | 'mm';
type CollectorDashboardDictionary = Record<string, string>;

export type CollectorDashboardCopy = Record<CollectorDashboardLanguage, CollectorDashboardDictionary>;

const parsedDefault = rawCollectorDashboardCopy as CollectorDashboardCopy;

export const DEFAULT_COLLECTOR_DASHBOARD_COPY: CollectorDashboardCopy = {
  en: { ...parsedDefault.en },
  mm: { ...parsedDefault.mm },
};

export type CollectorDashboardCopyKey = keyof typeof DEFAULT_COLLECTOR_DASHBOARD_COPY.en;

export const COLLECTOR_DASHBOARD_COPY_KEYS = Object.keys(
  DEFAULT_COLLECTOR_DASHBOARD_COPY.en,
) as CollectorDashboardCopyKey[];

const normalizeLanguageCopy = (
  language: CollectorDashboardLanguage,
  value: unknown,
): CollectorDashboardDictionary => {
  const fallback = DEFAULT_COLLECTOR_DASHBOARD_COPY[language];
  const output: CollectorDashboardDictionary = { ...fallback };
  if (!value || typeof value !== 'object') return output;

  const candidate = value as Record<string, unknown>;
  for (const key of COLLECTOR_DASHBOARD_COPY_KEYS) {
    const nextValue = candidate[key];
    if (typeof nextValue === 'string') {
      output[key] = nextValue;
    }
  }
  return output;
};

export const normalizeCollectorDashboardCopy = (value: unknown): CollectorDashboardCopy => {
  if (!value || typeof value !== 'object') {
    return {
      en: { ...DEFAULT_COLLECTOR_DASHBOARD_COPY.en },
      mm: { ...DEFAULT_COLLECTOR_DASHBOARD_COPY.mm },
    };
  }

  const candidate = value as Partial<CollectorDashboardCopy>;
  return {
    en: normalizeLanguageCopy('en', candidate.en),
    mm: normalizeLanguageCopy('mm', candidate.mm),
  };
};
