const MINUS = '−';

/** Signed score with a real minus sign: +5, −3, 0. */
export function signed(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `${MINUS}${Math.abs(n)}`;
  return '0';
}

/** Unsigned except for negatives (for running totals). */
export function plain(n: number): string {
  return n < 0 ? `${MINUS}${Math.abs(n)}` : String(n);
}

export function dateLabel(ts: number): string {
  return new Date(ts).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function weekdayDate(ts: number): string {
  return new Date(ts).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function defaultSessionName(ts = Date.now()): string {
  return `Spielabend ${new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export const uid = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`).slice(0, 12);
