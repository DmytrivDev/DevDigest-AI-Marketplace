import { t } from '../i18n/en';

// Dates and plurals, locale "en", all dates in UTC so builds do not depend on the machine's zone.

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const monthFmt = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const plural = new Intl.PluralRules('en');

export const formatDate = (iso: string): string => dateFmt.format(new Date(iso));
export const formatMonth = (iso: string): string => monthFmt.format(new Date(iso));
/** "Oct 14" for chart axes. */
export const formatShortDate = (iso: string): string =>
  dateFmt.format(new Date(iso)).replace(/,\s*\d{4}$/, '');

export function pluralize(n: number, one: string, other = `${one}s`): string {
  return `${n} ${plural.select(n) === 'one' ? one : other}`;
}

export function formatBytes(bytes: number): string {
  return bytes < 1024 ? t.units.bytes(bytes) : t.units.kilobytes((bytes / 1024).toFixed(1));
}

export function relativeTime(iso: string, now: Date = new Date()): string {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const days = Math.round((new Date(iso).getTime() - now.getTime()) / 86_400_000);
  if (Math.abs(days) < 1) return t.time.today;
  if (Math.abs(days) < 30) return rtf.format(days, 'day');
  if (Math.abs(days) < 365) return rtf.format(Math.round(days / 30), 'month');
  return rtf.format(Math.round(days / 365), 'year');
}

export const shortSha = (sha: string): string => sha.slice(0, 7);
