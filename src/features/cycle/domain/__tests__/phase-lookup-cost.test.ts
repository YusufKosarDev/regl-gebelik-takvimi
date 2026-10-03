import { buildCycleCalendarMonth } from '../../application/build-cycle-calendar-month';
import { getCycleDay } from '../cycle-day';
import { getCyclePhase } from '../cycle-phase';
import { getEstimatedFertilityLevel } from '../fertility-level';
import type { CycleProfile } from '../types';

import { addDays, toISODate } from '@/utils/date';

/**
 * How many times a lookup walks the recorded periods.
 *
 * ## Why this is worth a test
 *
 * Every one of these functions is pure, correct and covered. None of that
 * stopped `getCyclePhase` from walking the record list eleven times to answer
 * one question: it asked four phase functions in turn, each re-derived the
 * cycle day from the records, and three of them re-validated the whole profile
 * on the way to an ovulation estimate that only ever needed the settings.
 *
 * It was invisible for years because the cost is a function of how long someone
 * has used the app. With a handful of records it is nothing. With five years of
 * them the home screen spent 19 ms per render on it, and with ten, 53 ms — the
 * app at its slowest for the person who has trusted it longest, which is
 * exactly backwards.
 *
 * Nothing about the output changed, so no assertion anywhere else could have
 * caught the regression and none would catch it coming back. These count the
 * scans directly.
 *
 * The numbers are upper bounds rather than exact: making a lookup cheaper is
 * always welcome and should not fail a test. Making one dearer should.
 */

/** Counts full iterations of `periodRecords`, which is what a scan is. */
function countingProfile(records: number) {
  const list = Array.from({ length: records }, (_, index) => ({
    id: `period-${index}`,
    startDate: addDays(toISODate('2024-01-01'), index * 28),
    isOngoing: false,
  }));

  const counter = { scans: 0 };

  const profile = {
    settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
    periodRecords: new Proxy(list, {
      get(target, key) {
        if (key === Symbol.iterator) {
          counter.scans += 1;
        }

        return Reflect.get(target, key);
      },
    }) as unknown as CycleProfile['periodRecords'],
  } satisfies CycleProfile;

  return { profile, counter, lastStart: list[records - 1].startDate };
}

/**
 * One scan to validate the profile, one to find the reference period start.
 *
 * This is the unit the rest are counted in: nothing below should cost more than
 * the number of cycle days it answers for.
 */
const SCANS_PER_CYCLE_DAY_LOOKUP = 2;

describe('one question, one lookup', () => {
  it('reads the records once to name a phase', () => {
    const { profile, counter, lastStart } = countingProfile(10);

    getCyclePhase(profile, addDays(lastStart, 7));

    // Was 11. The phase rules need a cycle day and the settings, not the
    // records, so the day is worked out once and the four rules are asked.
    expect(counter.scans).toBeLessThanOrEqual(SCANS_PER_CYCLE_DAY_LOOKUP);
  });

  it('reads the records once to grade fertility', () => {
    const { profile, counter, lastStart } = countingProfile(10);

    getEstimatedFertilityLevel(profile, addDays(lastStart, 7));

    // Was 6: once for itself, twice more inside the ovulation estimate and the
    // window check, each of which re-derived the same day.
    expect(counter.scans).toBeLessThanOrEqual(SCANS_PER_CYCLE_DAY_LOOKUP);
  });

  it('costs a phase lookup no more than a bare cycle day lookup', () => {
    // Stated as a relationship rather than a number: naming the phase is the
    // settings arithmetic on top of finding the day, and that arithmetic must
    // never go back to the records.
    const bare = countingProfile(10);
    getCycleDay(bare.profile, addDays(bare.lastStart, 7));

    const phase = countingProfile(10);
    getCyclePhase(phase.profile, addDays(phase.lastStart, 7));

    expect(phase.counter.scans).toBe(bare.counter.scans);
  });
});

describe('a month of them', () => {
  it('reads the records once per day drawn, not five times', () => {
    const { profile, counter } = countingProfile(10);

    // January: 31 days.
    buildCycleCalendarMonth(profile, 2026, 1);

    // The month's own validation and its single period prediction, plus one
    // cycle day lookup per square. Each square used to cost five.
    const ownOverhead = 3;
    const budget = ownOverhead + 31 * SCANS_PER_CYCLE_DAY_LOOKUP;

    expect(counter.scans).toBeLessThanOrEqual(budget);
  });

  it('spends exactly one cycle day lookup on each extra square', () => {
    // The budget above is an upper bound, which a single stray lookup can hide
    // under. This measures the per-day cost directly instead: January has three
    // more days than February 2026, so the difference between the two is three
    // days' worth of work and nothing else. Reintroduce a second lookup per
    // square and this reads 18 where it wants 6.
    const january = countingProfile(10);
    buildCycleCalendarMonth(january.profile, 2026, 1);

    const february = countingProfile(10);
    buildCycleCalendarMonth(february.profile, 2026, 2);

    expect(january.counter.scans - february.counter.scans).toBe(
      3 * SCANS_PER_CYCLE_DAY_LOOKUP
    );
  });
});
