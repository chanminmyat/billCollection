export const COLLECTION_WORKFLOW_STORAGE_KEY = 'billpro_collection_workflow_v1';
export const COLLECTION_WORKFLOW_UPDATED_EVENT = 'billpro-collection-workflow-updated';

export type CollectionWorkflowStatus =
  | 'idle'
  | 'en_route'
  | 'arrived'
  | 'rescheduled'
  | 'office_transfer'
  | 'collected_pending_admin'
  | 'completed';

export type CollectionWorkflowEventType =
  | 'en_route'
  | 'arrived'
  | 'rescheduled'
  | 'office_transfer'
  | 'collector_collected'
  | 'admin_confirmed';

export type CollectionWorkflowEvent = {
  id: string;
  type: CollectionWorkflowEventType;
  label: string;
  note?: string;
  timestamp: string;
  actorName?: string;
  actorRole?: string;
};

export type CollectionWorkflowRecord = {
  invoiceId: string;
  invoiceNo?: string;
  customerId?: string;
  customerCode?: string;
  status: CollectionWorkflowStatus;
  updatedAt: string;
  events: CollectionWorkflowEvent[];
};

export type CollectionWorkflowMap = Record<string, CollectionWorkflowRecord>;

type AppendCollectionWorkflowEventInput = {
  invoiceId: string;
  invoiceNo?: string;
  customerId?: string;
  customerCode?: string;
  status: CollectionWorkflowStatus;
  type: CollectionWorkflowEventType;
  label: string;
  note?: string;
  actorName?: string;
  actorRole?: string;
  timestamp?: string;
};

const canUseStorage = () => typeof window !== 'undefined';

const safeParse = (raw: string | null): CollectionWorkflowMap => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return parsed as CollectionWorkflowMap;
  } catch {
    return {};
  }
};

export const readCollectionWorkflowMap = (): CollectionWorkflowMap => {
  if (!canUseStorage()) return {};
  return safeParse(window.localStorage.getItem(COLLECTION_WORKFLOW_STORAGE_KEY));
};

export const writeCollectionWorkflowMap = (map: CollectionWorkflowMap) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(COLLECTION_WORKFLOW_STORAGE_KEY, JSON.stringify(map));
  window.dispatchEvent(new CustomEvent(COLLECTION_WORKFLOW_UPDATED_EVENT));
};

export const readCollectionWorkflow = (invoiceId: string) => {
  const map = readCollectionWorkflowMap();
  return map[invoiceId] ?? null;
};

export const appendCollectionWorkflowEvent = (
  input: AppendCollectionWorkflowEventInput,
): CollectionWorkflowRecord => {
  const nowIso = input.timestamp ?? new Date().toISOString();
  const map = readCollectionWorkflowMap();
  const existing = map[input.invoiceId];

  const event: CollectionWorkflowEvent = {
    id: `${nowIso}-${Math.random().toString(36).slice(2, 10)}`,
    type: input.type,
    label: input.label,
    note: input.note?.trim() || undefined,
    timestamp: nowIso,
    actorName: input.actorName,
    actorRole: input.actorRole,
  };

  const nextRecord: CollectionWorkflowRecord = {
    invoiceId: input.invoiceId,
    invoiceNo: input.invoiceNo ?? existing?.invoiceNo,
    customerId: input.customerId ?? existing?.customerId,
    customerCode: input.customerCode ?? existing?.customerCode,
    status: input.status,
    updatedAt: nowIso,
    events: [...(existing?.events ?? []), event],
  };

  map[input.invoiceId] = nextRecord;
  writeCollectionWorkflowMap(map);
  return nextRecord;
};

export const getCollectionWorkflowStatusLabel = (status: CollectionWorkflowStatus) => {
  if (status === 'en_route') return 'On the way';
  if (status === 'arrived') return 'Arrived';
  if (status === 'rescheduled') return 'Rescheduled';
  if (status === 'office_transfer') return 'Office Transfer';
  if (status === 'collected_pending_admin') return 'Collected';
  if (status === 'completed') return 'Completed';
  return 'Not Started';
};

export const getCollectionWorkflowStatusClassName = (status: CollectionWorkflowStatus) => {
  if (status === 'completed') return 'bg-emerald-100 text-emerald-800';
  if (status === 'collected_pending_admin') return 'bg-amber-100 text-amber-800';
  if (status === 'office_transfer') return 'bg-indigo-100 text-indigo-800';
  if (status === 'rescheduled') return 'bg-rose-100 text-rose-800';
  if (status === 'arrived') return 'bg-cyan-100 text-cyan-800';
  if (status === 'en_route') return 'bg-blue-100 text-blue-800';
  return 'bg-slate-100 text-slate-700';
};
