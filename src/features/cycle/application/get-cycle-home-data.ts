import type { SQLiteDatabase } from 'expo-sqlite';

import { cycleDailySupport } from '../data/cycle-daily-support';
import { loadCycleProfile } from '../data/cycle-repository';
import type { CycleDailySupport } from '../domain/daily-support';
import { getCycleDailySupport } from '../domain/daily-support';
import type { CycleProfile } from '../domain/types';

import type { CycleDashboard } from './get-cycle-dashboard';
import { buildCycleDashboard } from './get-cycle-dashboard';

import { currentLanguage } from '@/i18n';
import type { Language } from '@/i18n/language';
import type { ISODate } from '@/types/iso-date';

/**
 * What the home screen needs from storage, in one read.
 *
 * The profile comes back alongside the summary so the screen can lay out any
 * month from it without another query. Calendars for other months are built
 * from this with `buildCycleCalendarGridForMonth`.
 *
 * `dailySupport` is the content written for the phase the dashboard already
 * worked out, looked up rather than recalculated: the phase is decided once, in
 * `buildCycleDashboard`, so the words and the summary above them cannot end up
 * describing different days. It is `null` when there is no phase to look up,
 * and `null` again for a phase nothing is written for.
 */
export type CycleHomeData = {
  readonly dashboard: CycleDashboard;
  readonly profile: CycleProfile;
  readonly dailySupport: CycleDailySupport | null;
};

/** Returns `null` when nothing has been saved yet. */
/**
 * @param language which half of the written content to read.
 *
 * Defaults to the language as it is now rather than to Turkish, because one of
 * the two callers is the widget snapshot, which runs outside any render and has
 * no language to pass. The home screen passes the one it is showing, which is
 * the same answer a moment later.
 */
export async function getCycleHomeData(
  db: SQLiteDatabase,
  today: ISODate,
  language: Language = currentLanguage()
): Promise<CycleHomeData | null> {
  const profile = await loadCycleProfile(db);

  if (profile === null) {
    return null;
  }

  const dashboard = buildCycleDashboard(profile, today);

  return {
    dashboard,
    profile,
    dailySupport:
      dashboard.phase === null
        ? null
        : getCycleDailySupport(cycleDailySupport[language], dashboard.phase),
  };
}
