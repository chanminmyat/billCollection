export const BILLING_RULE_ASSIGNMENTS_STORAGE_KEY = 'billpro_billing_rule_assignments_v1';
export const BILLING_RULE_ASSIGNMENTS_UPDATED_EVENT = 'billing-rule-assignments-updated';

export type BillingRuleAssignments = {
  customers: Record<string, string>;
  invoices: Record<string, string>;
  updatedAt: string;
};

const emptyAssignments = (): BillingRuleAssignments => ({
  customers: {},
  invoices: {},
  updatedAt: new Date().toISOString(),
});

const emitUpdated = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(BILLING_RULE_ASSIGNMENTS_UPDATED_EVENT));
};

export const readBillingRuleAssignments = (): BillingRuleAssignments => {
  if (typeof window === 'undefined') {
    return emptyAssignments();
  }

  try {
    const raw = window.localStorage.getItem(BILLING_RULE_ASSIGNMENTS_STORAGE_KEY);
    if (!raw) return emptyAssignments();
    const parsed = JSON.parse(raw) as Partial<BillingRuleAssignments> | null;
    return {
      customers:
        parsed?.customers && typeof parsed.customers === 'object'
          ? (parsed.customers as Record<string, string>)
          : {},
      invoices:
        parsed?.invoices && typeof parsed.invoices === 'object'
          ? (parsed.invoices as Record<string, string>)
          : {},
      updatedAt:
        typeof parsed?.updatedAt === 'string' && parsed.updatedAt.trim()
          ? parsed.updatedAt
          : new Date().toISOString(),
    };
  } catch {
    return emptyAssignments();
  }
};

export const saveBillingRuleAssignments = (
  updater:
    | BillingRuleAssignments
    | ((current: BillingRuleAssignments) => BillingRuleAssignments),
) => {
  if (typeof window === 'undefined') {
    return emptyAssignments();
  }

  const current = readBillingRuleAssignments();
  const next =
    typeof updater === 'function'
      ? (updater as (current: BillingRuleAssignments) => BillingRuleAssignments)(current)
      : updater;

  const normalized: BillingRuleAssignments = {
    customers: next.customers ?? {},
    invoices: next.invoices ?? {},
    updatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(
    BILLING_RULE_ASSIGNMENTS_STORAGE_KEY,
    JSON.stringify(normalized),
  );
  emitUpdated();
  return normalized;
};

export const assignRuleToCustomersLocally = (ruleId: string, customerIds: string[]) => {
  const normalizedRuleId = ruleId.trim();
  const normalizedCustomerIds = customerIds.map((id) => id.trim()).filter(Boolean);
  if (!normalizedRuleId || normalizedCustomerIds.length === 0) {
    return readBillingRuleAssignments();
  }

  return saveBillingRuleAssignments((current) => {
    const nextCustomers = { ...current.customers };
    for (const customerId of normalizedCustomerIds) {
      nextCustomers[customerId] = normalizedRuleId;
    }
    return {
      ...current,
      customers: nextCustomers,
    };
  });
};

export const assignRuleToInvoicesLocally = (ruleId: string, invoiceIds: string[]) => {
  const normalizedRuleId = ruleId.trim();
  const normalizedInvoiceIds = invoiceIds.map((id) => id.trim()).filter(Boolean);
  if (!normalizedRuleId || normalizedInvoiceIds.length === 0) {
    return readBillingRuleAssignments();
  }

  return saveBillingRuleAssignments((current) => {
    const nextInvoices = { ...current.invoices };
    for (const invoiceId of normalizedInvoiceIds) {
      nextInvoices[invoiceId] = normalizedRuleId;
    }
    return {
      ...current,
      invoices: nextInvoices,
    };
  });
};

