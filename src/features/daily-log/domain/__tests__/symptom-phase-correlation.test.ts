import type { DailyEntry } from '../catalogues';
import {
  MIN_ENTRIES_FOR_CORRELATION,
  NOTABLE_SHARE_MARGIN,
  correlatePhases,
  tallyPlacedDays,
  type PhasedDailyEntry,
} from '../symptom-phase-correlation';

import type { CyclePhase } from '@/features/cycle/domain/phases';
import type { ISODate } from '@/types/iso-date';

/**
 * Where the recorded days holding each symptom fell across the cycle.
 *
 * Most of this file is about what the module refuses to say. Counting is easy;
 * the hard part is not producing a number that looks like a finding and is
 * actually a description of how long the luteal phase is.
 */

let nextDay = 0;

function entry(symptoms: readonly string[], moodId: string | null = null): DailyEntry {
  nextDay += 1;

  return {
    date: `2026-01-${String(nextDay).padStart(2, '0')}` as ISODate,
    flowId: null,
    moodId,
    symptomIds: symptoms,
  };
}

/** `count` days in `phase`, each holding `symptoms`. */
function days(
  count: number,
  phase: CyclePhase | null,
  symptoms: readonly string[] = []
): PhasedDailyEntry[] {
  return Array.from({ length: count }, () => ({ entry: entry(symptoms), phase }));
}

beforeEach(() => {
  nextDay = 0;
});

const symptomsOf = (e: DailyEntry) => e.symptomIds;

describe('counting', () => {
  it('reports where the days holding a symptom fell', () => {
    const [correlation] = correlatePhases(
      [...days(3, 'luteal', ['cramps']), ...days(1, 'menstrual', ['cramps'])],
      symptomsOf
    );

    expect(correlation.id).toBe('cramps');
    expect(correlation.placedCount).toBe(4);
    expect(correlation.byPhase.luteal).toBe(3);
    expect(correlation.byPhase.menstrual).toBe(1);
    expect(correlation.dominantPhase).toBe('luteal');
    expect(correlation.dominantCount).toBe(3);
  });

  it('counts a day once per symptom it holds', () => {
    const correlations = correlatePhases(days(2, 'luteal', ['cramps', 'headache']), symptomsOf);

    expect(correlations.map((c) => c.id).sort()).toEqual(['cramps', 'headache']);
    expect(correlations.every((c) => c.placedCount === 2)).toBe(true);
  });

  it('counts moods through the same function', () => {
    // One function, two questions, differing only in what is pulled off a day.
    const phased: PhasedDailyEntry[] = [
      { entry: entry([], 'bad'), phase: 'luteal' },
      { entry: entry([], 'bad'), phase: 'luteal' },
      { entry: entry([], null), phase: 'luteal' },
    ];

    const [correlation] = correlatePhases(phased, (e) =>
      e.moodId === null ? [] : [e.moodId]
    );

    expect(correlation.id).toBe('bad');
    expect(correlation.placedCount).toBe(2);
  });

  it('is sorted by how much there is to say, then by id', () => {
    const correlations = correlatePhases(
      [...days(3, 'luteal', ['cramps']), ...days(5, 'luteal', ['acne'])],
      symptomsOf
    );

    expect(correlations.map((c) => c.id)).toEqual(['acne', 'cramps']);
  });
});

describe('days the cycle cannot place', () => {
  it('leaves them out of the count entirely', () => {
    // Days before the first recorded period have no phase. Counting them in the
    // denominator would understate every share; counting them in the numerator
    // would mean inventing a phase for them.
    const [correlation] = correlatePhases(
      [...days(3, 'luteal', ['cramps']), ...days(7, null, ['cramps'])],
      symptomsOf
    );

    expect(correlation.placedCount).toBe(3);
    expect(correlation.dominantShare).toBe(1);
  });

  it('reports nothing at all when nothing can be placed', () => {
    expect(correlatePhases(days(10, null, ['cramps']), symptomsOf)).toEqual([]);
  });

  it('tallies the placed days separately, which is the baseline', () => {
    const tally = tallyPlacedDays([...days(4, 'luteal'), ...days(2, 'menstrual'), ...days(9, null)]);

    expect(tally).toEqual({ menstrual: 2, follicular: 0, ovulatory: 0, luteal: 4 });
  });
});

describe('what counts as worth saying', () => {
  it('is not notable below the minimum number of days', () => {
    // Every one of the four days is luteal, so the share is 100% - and it is
    // still four days.
    const [correlation] = correlatePhases(days(4, 'luteal', ['cramps']), symptomsOf);

    expect(correlation.dominantShare).toBe(1);
    expect(correlation.isNotable).toBe(false);
    expect(MIN_ENTRIES_FOR_CORRELATION).toBe(5);
  });

  it('becomes notable at the minimum, given it also beats chance', () => {
    const [correlation] = correlatePhases(
      [...days(5, 'luteal', ['cramps']), ...days(5, 'follicular')],
      symptomsOf
    );

    expect(correlation.placedCount).toBe(5);
    expect(correlation.isNotable).toBe(true);
  });

  it('is not notable when the share only describes the shape of the cycle', () => {
    // The point of the whole module. Thirty placed days, twenty of them luteal,
    // and a symptom scattered across them in the same proportion. "67% of your
    // cramps were luteal" is true and says nothing: two thirds of the days were.
    const phased = [
      ...days(20, 'luteal'),
      ...days(10, 'follicular'),
      ...days(10, 'luteal', ['cramps']),
      ...days(5, 'follicular', ['cramps']),
    ];

    const [correlation] = correlatePhases(phased, symptomsOf);

    expect(correlation.dominantPhase).toBe('luteal');
    expect(correlation.dominantShare).toBeCloseTo(10 / 15);
    expect(correlation.expectedShare).toBeCloseTo(30 / 45);
    expect(correlation.isNotable).toBe(false);
  });

  it('is notable when the share clearly beats the days available', () => {
    // Same cycle shape, but the symptom concentrates: fourteen of fifteen in
    // luteal against two thirds of the days being luteal.
    const phased = [
      ...days(20, 'luteal'),
      ...days(10, 'follicular'),
      ...days(14, 'luteal', ['cramps']),
      ...days(1, 'follicular', ['cramps']),
    ];

    const [correlation] = correlatePhases(phased, symptomsOf);

    expect(correlation.dominantShare - correlation.expectedShare).toBeGreaterThanOrEqual(
      NOTABLE_SHARE_MARGIN
    );
    expect(correlation.isNotable).toBe(true);
  });
});

describe('determinism', () => {
  it('breaks a tie by the cycle order rather than by insertion order', () => {
    const forwards = correlatePhases(
      [...days(2, 'menstrual', ['cramps']), ...days(2, 'luteal', ['cramps'])],
      symptomsOf
    );

    nextDay = 0;

    const backwards = correlatePhases(
      [...days(2, 'luteal', ['cramps']), ...days(2, 'menstrual', ['cramps'])],
      symptomsOf
    );

    expect(forwards[0].dominantPhase).toBe('menstrual');
    expect(backwards[0].dominantPhase).toBe('menstrual');
  });
});
