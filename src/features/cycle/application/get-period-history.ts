import type { SQLiteDatabase } from 'expo-sqlite';

import { loadCycleProfile } from '../data/cycle-repository';
import type { PeriodRecord } from '../domain/types';

import { daysBetween } from '@/utils/date';

/**
 * Every recorded period, newest first.
 *
 * The order is set here rather than in the screen so the list arrives ready to
 * render, and the stored profile is copied before sorting so nothing reorders
 * the records the rest of the app is holding.
 *
 * Returns `null` when nothing has been saved yet. A saved profile with no
 * records comes back as an empty list — the caller may show the same thing for
 * both, but they are not the same state.
 */
export async function getPeriodHistory(
  db: SQLiteDatabase
): Promise<readonly PeriodRecord[] | null> {
  const profile = await loadCycleProfile(db);

  if (profile === null) {
    return null;
  }

  // `daysBetween(a, b)` is b minus a, which is already negative when `a` is the
  // later date — exactly what sorting newest first wants.
  return [...profile.periodRecords].sort((a, b) => daysBetween(a.startDate, b.startDate));
}
