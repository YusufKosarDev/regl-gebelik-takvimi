import {
  MIN_SUGGESTION_DIFFERENCE_DAYS,
  suggestCycleLength,
} from '../cycle-length-suggestion';
import { MAX_CYCLE_LENGTH_DAYS, MIN_CYCLE_LENGTH_DAYS } from '../limits';
import {
  MIN_OBSERVATIONS,
  observeCycleLengths,
  type CycleLengthObservations,
} from '../observed-cycle-lengths';
import type { CycleProfile, PeriodRecord } from '../types';
import { validateCycleSettings } from '../validation';

import { addDays, toISODate } from '@/utils/date';

/**
 * Whether the recorded cycles are worth offering as a new setting.
 *
 * The cases that matter are the refusals. Offering is cheap to get right;
 * offering something the person cannot accept, or nagging about a difference
 * that is not there, is what makes a card like this worth switching off.
 */

function profileWithGaps(
  settingDays: number,
  gaps: readonly number[]
): CycleProfile {
  const records: PeriodRecord[] = [];
  let start = toISODate('2026-01-01');

  records.push({ id: `period-${start}`, startDate: start, isOngoing: false });

  for (const gap of gaps) {
    start = addDays(start, gap);
    records.push({ id: `period-${start}`, startDate: start, isOngoing: false });
  }

  return {
    settings: { averageCycleLengthDays: settingDays, averagePeriodLengthDays: 5 },
    periodRecords: records,
  };
}

function suggest(settingDays: number, gaps: readonly number[]) {
  const profile = profileWithGaps(settingDays, gaps);

  return suggestCycleLength(profile, observeCycleLengths(profile));
}

describe('when there is something to say', () => {
  it('offers the observed median against the stored setting', () => {
    const suggestion = suggest(28, [31, 31, 31]);

    expect(suggestion).toEqual({
      observedMedianDays: 31,
      settingDays: 28,
      differenceDays: 3,
      observationCount: 3,
    });
  });

  it('signs the difference, so a shorter observation is distinguishable', () => {
    // Both directions are worth offering. Somebody who entered 32 and cycles at
    // 27 is getting predictions five days late, which is the same size of wrong.
    const suggestion = suggest(32, [27, 27, 27]);

    expect(suggestion?.differenceDays).toBe(-5);
  });

  it('counts the observations it used, not the records', () => {
    // Four records make three gaps. A card saying "your last 4 cycles" when it
    // measured 3 would be overstating its evidence by a third.
    const suggestion = suggest(28, [31, 31, 31]);

    expect(suggestion?.observationCount).toBe(3);
  });
});

describe('when it stays quiet', () => {
  it('says nothing below the minimum number of observations', () => {
    expect(suggest(28, [31, 31])).toBeNull();
    expect(MIN_OBSERVATIONS).toBe(3);
  });

  it('says nothing when the records agree with the setting', () => {
    expect(suggest(30, [30, 30, 30])).toBeNull();
  });

  it('says nothing about a one-day difference', () => {
    // Inside the noise of noticing a period started and getting round to
    // recording it. Asking about it would train the person to dismiss the card.
    expect(suggest(30, [31, 31, 31])).toBeNull();
    expect(MIN_SUGGESTION_DIFFERENCE_DAYS).toBe(2);
  });

  it('speaks at exactly the minimum difference', () => {
    expect(suggest(29, [31, 31, 31])?.differenceDays).toBe(2);
  });

  it('says nothing when there are no observations at all', () => {
    const empty: CycleLengthObservations = {
      lengths: [],
      medianDays: null,
      shortestDays: null,
      longestDays: null,
      spreadDays: null,
      discardedCount: 0,
    };

    expect(suggestCycleLength(profileWithGaps(28, []), empty)).toBeNull();
  });
});

describe('every suggestion can actually be written', () => {
  it('offers only numbers the settings validator will take', () => {
    // The point of the implausible-gap filter, stated as the property it buys.
    // A suggestion the write would refuse is a dead end with a button on it.
    for (const gap of [MIN_CYCLE_LENGTH_DAYS, 20, 28, 45, MAX_CYCLE_LENGTH_DAYS]) {
      const suggestion = suggest(gap === 28 ? 40 : 28, [gap, gap, gap]);

      if (suggestion === null) {
        continue;
      }

      expect(() =>
        validateCycleSettings({
          averageCycleLengthDays: suggestion.observedMedianDays,
          averagePeriodLengthDays: 5,
        })
      ).not.toThrow();
    }
  });

  it('says nothing when a long logging gap is all there is', () => {
    // Four months away from the app. Without the filter upstream this would
    // offer 120 days, which the write refuses.
    expect(suggest(28, [120, 130, 140])).toBeNull();
  });
});
