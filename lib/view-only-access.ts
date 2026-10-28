export const VIEW_ONLY_MODULES = [
  { id: 'customers', label: 'Customers', href: '/admin/customers/customer-list' },
  { id: 'collectors', label: 'Collectors', href: '/admin/collectors/collector-list' },
  { id: 'invoices', label: 'Invoices', href: '/admin/billing' },
  { id: 'billing_rules', label: 'Billing Rules', href: '/admin/billing?tab=rule-config' },
  { id: 'receipts', label: 'Receipts', href: '/admin/billing/receipt/list' },
  { id: 'reports', label: 'Reports', href: '/admin/reports' },
  { id: 'payment_config', label: 'Payment Accounts', href: '/admin/billing/payment-config/list' },
] as const;

export type ViewOnlyModule = (typeof VIEW_ONLY_MODULES)[number]['id'];
export type UserAccess = { role?: string; permissions?: string[] } | null | undefined;

export const hasViewOnlyAccess = (user: UserAccess, module: ViewOnlyModule) =>
  user?.role === 'viewer' && Array.isArray(user.permissions) && user.permissions.includes(module);

export const getViewOnlyHomePath = (permissions?: string[]) =>
  VIEW_ONLY_MODULES.find((module) => permissions?.includes(module.id))?.href ?? '/admin';
