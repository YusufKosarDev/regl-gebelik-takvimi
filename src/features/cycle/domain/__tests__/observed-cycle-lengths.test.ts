import {
  MIN_OBSERVATIONS,
  OBSERVATION_WINDOW,
  observeCycleLengths,
} from '../observed-cycle-lengths';
import type { CycleProfile, PeriodRecord } from '../types';

import type { ISODate } from '@/types/iso-date';
import { addDays, toISODate } from '@/utils/date';

/**
 * What the recorded periods say about cycle length.
 *
 * The interesting cases are all about what is *not* counted: a hole in the
 * record is not a long cycle, and a three-year-old cycle is not evidence about
 * now. Those two rules are the reason this module exists rather than a
 * three-line average.
 */

/** Periods starting on the given day, then at each gap after it. */
function profileWithGaps(firstStart: string, gaps: readonly number[]): CycleProfile {
  const records: PeriodRecord[] = [];
  let start = toISODate(firstStart);

  records.push({ id: `period-${start}`, startDate: start, isOngoing: false });

  for (const gap of gaps) {
    start = addDays(start, gap);
    records.push({ id: `period-${start}`, startDate: start, isOngoing: false });
  }

  return {
    settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
    periodRecords: records,
  };
}

describe('counting the gaps', () => {
  it('says nothing when there is one period or none', () => {
    const none: CycleProfile = {
      settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
      periodRecords: [],
    };

    expect(observeCycleLengths(none).lengths).toEqual([]);
    expect(observeCycleLengths(none).medianDays).toBeNull();

    const one = profileWithGaps('2026-01-01', []);

    expect(observeCycleLengths(one).lengths).toEqual([]);
    expect(observeCycleLengths(one).medianDays).toBeNull();
  });

  it('measures the gap between two consecutive starts', () => {
    const observations = observeCycleLengths(profileWithGaps('2026-01-01', [31]));

    expect(observations.lengths).toEqual([31]);
    expect(observations.medianDays).toBe(31);
    expect(observations.shortestDays).toBe(31);
    expect(observations.longestDays).toBe(31);
  });

  it('has no spread until there are two gaps to compare', () => {
    expect(observeCycleLengths(profileWithGaps('2026-01-01', [31])).spreadDays).toBeNull();
    expect(observeCycleLengths(profileWithGaps('2026-01-01', [28, 31])).spreadDays).toBe(3);
  });

  it('counts the gaps whatever order the records arrive in', () => {
    // The domain does not promise an order, so the module sorts a copy. A
    // caller that happens to hold them backwards must get the same answer.
    const ordered = profileWithGaps('2026-01-01', [28, 30, 32]);
    const shuffled: CycleProfile = {
      ...ordered,
      periodRecords: [...ordered.periodRecords].reverse(),
    };

    expect(observeCycleLengths(shuffled).lengths).toEqual(
      observeCycleLengths(ordered).lengths
    );
  });

  it('leaves the records in the order it was given them', () => {
    const profile = profileWithGaps('2026-01-01', [28, 30]);
    const before = profile.periodRecords.map((record) => record.startDate);

    observeCycleLengths(profile);

    expect(profile.periodRecords.map((record) => record.startDate)).toEqual(before);
  });
});

describe('discarding what is not a cycle', () => {
  it('drops a gap longer than a cycle can be, and says it dropped one', () => {
    // Four months of not logging. This is the case the filter exists for: 120
    // is outside the range a setting may hold, so without the filter the app
    // would offer a number the write would then refuse.
    const observations = observeCycleLengths(profileWithGaps('2026-01-01', [28, 120, 30]));

    expect(observations.lengths).toEqual([28, 30]);
    expect(observations.discardedCount).toBe(1);
  });

  it('drops a gap shorter than a cycle can be', () => {
    // Two starts a week apart is a correction or a mistake, not a 7-day cycle.
    const observations = observeCycleLengths(profileWithGaps('2026-01-01', [7, 29]));

    expect(observations.lengths).toEqual([29]);
    expect(observations.discardedCount).toBe(1);
  });

  it('reports nothing but the discarded count when every gap is implausible', () => {
    const observations = observeCycleLengths(profileWithGaps('2026-01-01', [120, 150]));

    expect(observations.lengths).toEqual([]);
    expect(observations.medianDays).toBeNull();
    expect(observations.discardedCount).toBe(2);
  });

  it('keeps the gaps exactly on the bounds', () => {
    // The bounds are what a setting may hold, so a gap on one is a gap a
    // suggestion could be made from.
    const observations = observeCycleLengths(profileWithGaps('2026-01-01', [15, 90]));

    expect(observations.lengths).toEqual([15, 90]);
    expect(observations.discardedCount).toBe(0);
  });
});

describe('the median', () => {
  it('takes the middle of an odd number of gaps', () => {
    expect(observeCycleLengths(profileWithGaps('2026-01-01', [26, 31, 36])).medianDays).toBe(31);
  });

  it('takes the lower middle of an even number, so the answer is a whole number', () => {
    // 28 and 31 would average to 29.5. The setting it may be written into has
    // to be an integer, so the lower middle is taken rather than a rounding
    // rule being invented.
    expect(observeCycleLengths(profileWithGaps('2026-01-01', [28, 31])).medianDays).toBe(28);
  });

  it('is moved less by one long cycle than a mean would be', () => {
    // The whole reason for a median. Four ordinary cycles and one long one:
    // the mean would be 34, the median stays at 30.
    const observations = observeCycleLengths(profileWithGaps('2026-01-01', [29, 30, 30, 31, 50]));

    expect(observations.medianDays).toBe(30);
  });
});

describe('the window', () => {
  it('counts only the most recent gaps', () => {
    const gaps = Array.from({ length: OBSERVATION_WINDOW + 5 }, (_, index) =>
      index < 5 ? 40 : 28
    );

    const observations = observeCycleLengths(profileWithGaps('2020-01-01', gaps));

    // The five 40-day cycles are older than the window and drop out entirely.
    expect(observations.lengths).toHaveLength(OBSERVATION_WINDOW);
    expect(observations.lengths.every((length) => length === 28)).toBe(true);
  });

  it('counts a discarded gap as discarded even when it falls outside the window', () => {
    // The count is about the record, not about the window: somebody told that
    // 5 gaps were counted deserves to know 1 was thrown away.
    const observations = observeCycleLengths(
      profileWithGaps('2020-01-01', [200, ...Array.from({ length: 4 }, () => 28)])
    );

    expect(observations.discardedCount).toBe(1);
  });
});

describe('the minimum', () => {
  it('is three, and reaching it is a question for the caller not this module', () => {
    // This module reports what it sees; whether that is enough to say anything
    // is `suggestCycleLength`'s decision. Stated here so the constant is not
    // mistaken for a filter applied inside.
    const two = observeCycleLengths(profileWithGaps('2026-01-01', [28, 30]));

    expect(MIN_OBSERVATIONS).toBe(3);
    expect(two.lengths).toHaveLength(2);
    expect(two.medianDays).not.toBeNull();
  });
});
