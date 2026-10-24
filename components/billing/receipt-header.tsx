import type { ReactNode } from 'react';
import { Building2 } from 'lucide-react';

interface ReceiptHeaderProps {
  number: string;
  date: string;
  company: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logo?: string | null;
  status?: string | null;
  amount?: ReactNode;
  amountLabel?: string;
}

export function ReceiptHeader({
  number,
  date,
  company,
  address,
  phone,
  email,
  logo,
  status,
  amount,
  amountLabel = 'Total amount',
}: ReceiptHeaderProps) {
  const normalized = (status || '').toLowerCase();
  const tone = normalized.includes('cancel')
    ? 'bg-slate-100 text-slate-700'
    : normalized === 'paid' || normalized === 'issued'
      ? 'bg-emerald-50 text-emerald-800'
      : normalized === 'overdue'
        ? 'bg-rose-50 text-rose-800'
        : 'bg-amber-50 text-amber-800';
  return (
    <header className="receipt-header">
      <div className="flex flex-col justify-between gap-7 sm:flex-row">
        <div className="flex min-w-0 items-start gap-3.5">
          {logo ? (
            <img
              src={logo}
              alt=""
              className="h-12 w-12 shrink-0 rounded-lg object-contain"
            />
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
              <Building2 className="h-5 w-5" aria-hidden="true" />
            </div>
          )}
          <div className="min-w-0 space-y-1 text-xs leading-relaxed text-slate-500">
            <p className="break-words text-base font-semibold text-slate-900">
              {company}
            </p>
            {address && (
              <p className="max-w-sm whitespace-pre-line break-words">
                {address}
              </p>
            )}
            {phone && <p>{phone}</p>}
            {email && <p className="break-all">{email}</p>}
          </div>
        </div>
        <div className="min-w-0 sm:text-right">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
            Receipt
          </h2>
          <p className="mt-2 break-all font-mono text-xs text-slate-500">
            {number}
          </p>
          <p className="mt-1 text-xs text-slate-500">Issued {date}</p>
          {status && (
            <span
              className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${tone}`}
            >
              {status}
            </span>
          )}
        </div>
      </div>
      {amount !== undefined && (
        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 px-5 py-4">
          <span className="text-xs font-medium text-emerald-900">
            {amountLabel}
          </span>
          <span className="break-words text-2xl font-semibold tracking-tight text-emerald-950 tabular-nums">
            {amount}
          </span>
        </div>
      )}
    </header>
  );
}
