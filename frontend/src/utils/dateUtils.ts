/**
 * dateUtils.ts — Business day calculation utilities.
 *
 * Computes the next trading day from a given date, skipping weekends.
 * Market holidays are not included — this covers weekday-only logic.
 */

/**
 * Check if a given date falls on a weekend (Saturday or Sunday).
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Format a Date as YYYY-MM-DD (ISO 8601 date-only).
 */
export function formatISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Get the next business day after a given date string.
 *
 * Skips Saturday → Monday, Sunday → Monday.
 * Input must be in YYYY-MM-DD format.
 *
 * @param dateStr - ISO date string (e.g. "2024-11-15")
 * @returns The next business day in YYYY-MM-DD format
 */
export function getNextBusinessDay(dateStr: string): string {
  if (!dateStr) return '—';

  const date = new Date(dateStr + 'T12:00:00'); // noon to avoid timezone edge cases
  if (isNaN(date.getTime())) return '—';

  // Advance by 1 day
  date.setDate(date.getDate() + 1);

  // Skip weekends
  while (isWeekend(date)) {
    date.setDate(date.getDate() + 1);
  }

  return formatISO(date);
}
