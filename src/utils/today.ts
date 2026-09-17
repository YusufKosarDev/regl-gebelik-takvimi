import type { ISODate } from '@/types/iso-date';
import { formatLocalDate } from '@/utils/date';

/**
 * The one place the app reads the clock.
 *
 * Kept out of `date.ts` on purpose: that module is pure and every function in it
 * is deterministic. This one is not, so it lives on its own and callers can see
 * exactly where time enters the system.
 *
 * `getFullYear`, `getMonth` and `getDate` are the *local* accessors. Going
 * through `toISOString()` instead would format in UTC and hand back yesterday or
 * tomorrow for anyone east or west of Greenwich.
 */
export function getTodayLocalISODate(): ISODate {
  const now = new Date();

  return formatLocalDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}
