const TZ = 'Africa/Johannesburg';

/**
 * Returns YYYY-MM-DD for "today" in Africa/Johannesburg.
 */
export function todayYMD(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date()); // en-CA yields YYYY-MM-DD
}

function parseYMD(date: string): { y: number; m: number; d: number } {
  const m = /^\d{4}-\d{2}-\d{2}$/.exec(date);
  if (!m) throw new Error(`Invalid date format: ${date}. Expected YYYY-MM-DD`);
  const [y, mo, d] = date.split('-').map(Number);
  return { y, m: mo, d };
}

export function addDays(date: string, days: number): string {
  const { y, m, d } = parseYMD(date);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
