import type { ReactNode } from 'react';
import { Wifi } from 'lucide-react';

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
  const tone = 'bg-slate-100 text-slate-700 ring-1 ring-slate-200';
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
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Wifi className="h-5 w-5" aria-hidden="true" />
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
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Internet services</p>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
            Payment receipt
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
        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
          <span className="text-xs font-medium text-slate-300">
            {amountLabel}
          </span>
          <span className="break-words text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
            {amount}
          </span>
        </div>
      )}
    </header>
  );
}
