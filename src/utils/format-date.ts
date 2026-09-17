import type { ISODate } from '@/types/iso-date';

/**
 * Renders an `ISODate` as a Turkish date for display, e.g. "17 Eylül 2026".
 *
 * Month names are a local table rather than `Intl`: Hermes ships without full
 * ICU data on Android unless it is explicitly enabled, so `Intl` would quietly
 * fall back to English on some devices. A fixed table is small and always right.
 *
 * Display only — the ISO string stays the value that moves through navigation
 * and storage.
 */

const MONTH_NAMES_TR = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
] as const;

export function formatDisplayDate(date: ISODate): string {
  const [year, month, day] = date.split('-');
  const monthName = MONTH_NAMES_TR[Number(month) - 1];

  return `${Number(day)} ${monthName} ${Number(year)}`;
}
