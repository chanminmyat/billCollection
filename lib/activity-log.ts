export const ACTIVITY_LOG_STORAGE_KEY = 'billpro_activity_log_v1';
export const ACTIVITY_LOG_UPDATED_EVENT = 'billpro-activity-log-updated';
const MAX_ACTIVITY_LOG_COUNT = 2000;

export type ActivityLogModule = 'customer' | 'collector' | 'billing' | 'system';

export type ActivityLogEntry = {
  id: string;
  timestamp: string;
  module: ActivityLogModule;
  action: string;
  description: string;
  actorName?: string;
  actorRole?: string;
  actorId?: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  metadata?: Record<string, unknown>;
};

export type AppendActivityLogInput = Omit<ActivityLogEntry, 'id' | 'timestamp'> & {
  timestamp?: string;
};

const canUseStorage = () => typeof window !== 'undefined';

const safeParse = (raw: string | null): ActivityLogEntry[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ActivityLogEntry[]) : [];
  } catch {
    return [];
  }
};

export const readActivityLogs = (): ActivityLogEntry[] => {
  if (!canUseStorage()) return [];
  const raw = window.localStorage.getItem(ACTIVITY_LOG_STORAGE_KEY);
  const list = safeParse(raw);
  return [...list].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
};

export const writeActivityLogs = (entries: ActivityLogEntry[]) => {
  if (!canUseStorage()) return;
  const normalized = [...entries]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, MAX_ACTIVITY_LOG_COUNT);
  window.localStorage.setItem(ACTIVITY_LOG_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(ACTIVITY_LOG_UPDATED_EVENT));
};

export const appendActivityLog = (entry: AppendActivityLogInput) => {
  if (!canUseStorage()) return;
  const nowIso = entry.timestamp ?? new Date().toISOString();
  const next: ActivityLogEntry = {
    ...entry,
    id: `${nowIso}-${Math.random().toString(36).slice(2, 10)}`,
    timestamp: nowIso,
  };
  const current = readActivityLogs();
  writeActivityLogs([next, ...current]);
};

export const clearActivityLogs = () => {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(ACTIVITY_LOG_STORAGE_KEY);
};
