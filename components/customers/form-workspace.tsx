'use client';

import { useRef, type ReactNode } from 'react';
import { AlertCircle, Check, Circle, ListChecks } from 'lucide-react';

export const CUSTOMER_FORM_SECTIONS = [
  { id: 'customer-account', label: 'Account details' },
  { id: 'customer-identity', label: 'Customer identity' },
  { id: 'customer-contact', label: 'Contact details' },
  { id: 'customer-address', label: 'Addresses' },
  { id: 'customer-service', label: 'Service & plan' },
  { id: 'customer-network', label: 'Network details' },
  { id: 'customer-billing', label: 'Billing & fees' },
  { id: 'customer-collection', label: 'Collection' },
];

interface CustomerFormWorkspaceProps {
  children: ReactNode;
  actions: ReactNode;
  notice?: ReactNode;
  summary: Array<{ label: string; value: string }>;
  editing?: boolean;
  dirty?: boolean;
  errorCount?: number;
}

export function CustomerFormWorkspace({
  children,
  actions,
  notice,
  summary,
  editing,
  dirty,
  errorCount = 0,
}: CustomerFormWorkspaceProps) {
  const formRef = useRef<HTMLDivElement>(null);
  const reviewErrors = () => {
    const first =
      formRef.current?.querySelector<HTMLElement>('[data-field-error]');
    if (!first) return;
    first.closest('section')?.scrollIntoView({
      block: 'start',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    });
    first.parentElement
      ?.querySelector<HTMLElement>('input, textarea, button[role="combobox"]')
      ?.focus({ preventScroll: true });
  };
  return (
    <div ref={formRef} className="space-y-5">
      <nav
        aria-label="Customer form sections"
        className="flex gap-2 overflow-x-auto pb-1 2xl:hidden"
      >
        {CUSTOMER_FORM_SECTIONS.map((section, index) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs font-medium text-muted-foreground hover:border-primary/30 hover:text-primary"
          >
            <span className="text-[10px] text-primary/70">
              {String(index + 1).padStart(2, '0')}
            </span>
            {section.label}
          </a>
        ))}
      </nav>
      <div className="grid items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_240px]">
        <div className="min-w-0 space-y-5">
          {notice}
          {children}
        </div>
        <aside className="hidden space-y-5 2xl:sticky 2xl:top-6 2xl:block">
          <div className="rounded-xl border bg-card p-4">
            <p className="mb-4 flex items-center gap-2 text-xs font-semibold">
              <ListChecks className="h-4 w-4 text-primary" />
              In this form
            </p>
            <nav aria-label="Customer form outline" className="space-y-1">
              {CUSTOMER_FORM_SECTIONS.map((section, index) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="flex gap-3 rounded-md px-2 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-primary"
                >
                  <span className="text-[10px] text-primary/60">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  {section.label}
                </a>
              ))}
            </nav>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="mb-4 text-xs font-semibold">Account summary</p>
            <dl className="space-y-3">
              {summary.map((item) => (
                <div key={item.label}>
                  <dt className="text-[11px] text-muted-foreground">
                    {item.label}
                  </dt>
                  <dd className="mt-1 break-words text-xs font-medium">
                    {item.value || 'Not selected'}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </aside>
      </div>
      <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 shadow-[0_8px_30px_-10px_rgba(24,34,31,0.2)] sm:px-5">
        {errorCount > 0 ? (
          <button
            type="button"
            onClick={reviewErrors}
            className="flex min-h-[44px] items-center gap-2 rounded-md text-xs font-medium text-destructive underline-offset-4 hover:underline"
          >
            <AlertCircle className="h-4 w-4" />
            <span role="status">
              {errorCount} {errorCount === 1 ? 'field needs' : 'fields need'}{' '}
              attention
            </span>
          </button>
        ) : (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            {editing ? (
              <>
                <Circle
                  className={`h-2 w-2 ${dirty ? 'fill-amber-500 text-amber-500' : 'fill-emerald-600 text-emerald-600'}`}
                />
                {dirty ? 'Unsaved changes' : 'No unsaved changes'}
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5 text-primary" />
                Required fields are marked with *
              </>
            )}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 [&_button]:min-h-[44px]">
          {actions}
        </div>
      </div>
    </div>
  );
}
