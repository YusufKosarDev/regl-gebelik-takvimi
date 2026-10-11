import type { SQLiteDatabase } from 'expo-sqlite';

import { loadAllDailyEntries } from '../data/daily-log-repository';
import type { DailyEntry } from '../domain/catalogues';
import type { PhaseCorrelation, PhasedDailyEntry, PhaseTally } from '../domain/symptom-phase-correlation';
import { correlatePhases, tallyPlacedDays } from '../domain/symptom-phase-correlation';

import { buildCyclePhaseIndex } from '@/features/cycle/application/build-cycle-phase-index';
import { loadCycleProfile } from '@/features/cycle/data/cycle-repository';
import type { CycleProfile } from '@/features/cycle/domain/types';
import type { ISODate } from '@/types/iso-date';

/**
 * Everything the recorded days have to say, read once.
 *
 * `profile` is carried so a screen can lay out any month without a second read,
 * and `phased` so it can mark the days without re-deriving which phase each
 * fell in - the summary and the calendar then cannot disagree.
 */
export type DailyLogHistory = {
  readonly today: ISODate;
  /** Ascending by date, as the repository gives them. */
  readonly entries: readonly DailyEntry[];
  /** `null` when onboarding has not finished, which is the one case with no cycle. */
  readonly profile: CycleProfile | null;
  readonly phased: readonly PhasedDailyEntry[];
  readonly symptomCorrelations: readonly PhaseCorrelation[];
  readonly moodCorrelations: readonly PhaseCorrelation[];
  /** How many placed days fall in each phase, which every share is measured against. */
  readonly placedDayTally: PhaseTally;
};

/**
 * Reads the daily log and places each day in the cycle.
 *
 * ## Why it never returns null
 *
 * "Nothing recorded yet" is a state the screen shows rather than an absence it
 * has to guard against, so an empty log comes back as an empty-but-complete
 * shape. The same is true of a profile that has no periods in it: the entries
 * are still worth listing, they simply cannot be placed.
 *
 * `today` is passed in like everywhere else in this layer, so the same database
 * on the same day always gives the same answer.
 *
 * The two reads go together because they describe the same thing from two
 * sides, and two awaited reads could land either side of a write - the entries
 * from before a period was recorded and the profile from after it.
 */
export async function getDailyLogHistory(
  db: SQLiteDatabase,
  today: ISODate
): Promise<DailyLogHistory> {
  const entries = await loadAllDailyEntries(db);

  /**
   * Read second, and not at all when there is nothing to place.
   *
   * These two used to go together in a `Promise.all`, which is the faster
   * shape and reads one thing it does not need: with no days logged the
   * function returns early and the profile is never looked at.
   *
   * It stopped being free when the insights moved onto the history tab. That
   * screen reads the period records and this in one trip, and both of them
   * load the profile - so an empty log cost two reads of the same row for one
   * screen, and the tests that script that mock call by call said so plainly
   * by failing.
   */
  const profile = entries.length === 0 ? null : await loadCycleProfile(db);

  if (entries.length === 0 || profile === null) {
    const unplaced = entries.map((entry) => ({ entry, phase: null }));

    return {
      today,
      entries,
      profile,
      phased: unplaced,
      symptomCorrelations: [],
      moodCorrelations: [],
      placedDayTally: tallyPlacedDays(unplaced),
    };
  }

  // The entries are ascending, so the ends of the index are the ends of the
  // log. Today is included because the log reaches it and the calendar will be
  // asked to show the month it is in.
  const phaseIndex = buildCyclePhaseIndex(profile, entries[0].date, today);

  const phased: readonly PhasedDailyEntry[] = entries.map((entry) => ({
    entry,
    phase: phaseIndex.get(entry.date) ?? null,
  }));

  return {
    today,
    entries,
    profile,
    phased,
    symptomCorrelations: correlatePhases(phased, (entry) => entry.symptomIds),
    moodCorrelations: correlatePhases(phased, (entry) =>
      entry.moodId === null ? [] : [entry.moodId]
    ),
    placedDayTally: tallyPlacedDays(phased),
  };
}
