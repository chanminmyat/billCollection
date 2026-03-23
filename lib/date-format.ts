const pad2 = (value: number) => String(value).padStart(2, '0');

const formatDateParts = (year: number, month: number, day: number) =>
  `${pad2(day)}-${pad2(month)}-${year}`;

export const formatDisplayDate = (
  value: string | number | Date | null | undefined,
  fallback = '—',
) => {
  if (value === null || value === undefined || value === '') return fallback;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return fallback;
    return formatDateParts(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  if (typeof value === 'number') {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return fallback;
    return formatDateParts(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
  }

  const trimmed = value.trim();
  if (!trimmed) return fallback;

  // Keep date-only strings timezone-safe by reformatting the literal date part.
  const isoDateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDateMatch) {
    const [, year, month, day] = isoDateMatch;
    return `${day}-${month}-${year}`;
  }

  const ddMmYyyyMatch = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (ddMmYyyyMatch) {
    return trimmed;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return fallback;

  return formatDateParts(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
};

export const formatDisplayDateRange = (
  from: string | number | Date | null | undefined,
  to: string | number | Date | null | undefined,
  fallback = '—',
) => {
  const fromText = formatDisplayDate(from, '');
  const toText = formatDisplayDate(to, '');
  if (!fromText && !toText) return fallback;
  return `${fromText || '—'} - ${toText || '—'}`;
};
