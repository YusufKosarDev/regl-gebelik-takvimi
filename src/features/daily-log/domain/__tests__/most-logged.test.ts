import type { DailyEntry } from '../catalogues';
import { mostLogged } from '../most-logged';

import type { ISODate } from '@/types/iso-date';

/**
 * How often each thing was written down.
 *
 * Deliberately not `PhaseCorrelation.placedCount`, which is the obvious thing
 * to reach for and would be wrong. That one counts only the days the cycle can
 * place - days before the first recorded period have no phase and are left out
 * of it on purpose - and `symptom-phase-correlation.ts` carries a warning
 * saying a caller must not mistake it for how many days were recorded.
 *
 * A list headed "what you write down most" has to count every day that holds
 * the thing, placed or not, or it quietly understates somebody's first month.
 */
function entry(date: string, symptomIds: readonly string[], moodId: string | null = null): DailyEntry {
  return { date: date as ISODate, flowId: null, moodId, symptomIds };
}

const symptomsOf = (day: DailyEntry) => day.symptomIds;

describe('mostLogged', () => {
  it('counts every day that holds the thing', () => {
    const days = [
      entry('2026-10-01', ['cramps']),
      entry('2026-10-02', ['cramps', 'acne']),
      entry('2026-10-03', ['cramps']),
    ];

    expect(mostLogged(days, symptomsOf, 5)).toEqual([
      { id: 'cramps', count: 3 },
      { id: 'acne', count: 1 },
    ]);
  });

  it('puts the most written down first', () => {
    const days = [
      entry('2026-10-01', ['acne']),
      entry('2026-10-02', ['acne']),
      entry('2026-10-03', ['cramps']),
      entry('2026-10-04', ['acne']),
    ];

    expect(mostLogged(days, symptomsOf, 5).map((row) => row.id)).toEqual(['acne', 'cramps']);
  });

  it('breaks a tie by id, so the list does not reshuffle itself', () => {
    // Two things written down the same number of times must come out in the
    // same order every time the screen is opened.
    const days = [entry('2026-10-01', ['cramps', 'acne'])];

    expect(mostLogged(days, symptomsOf, 5).map((row) => row.id)).toEqual(['acne', 'cramps']);
  });

  it('gives back no more than it was asked for', () => {
    const days = [entry('2026-10-01', ['a', 'b', 'c', 'd'])];

    expect(mostLogged(days, symptomsOf, 2)).toHaveLength(2);
  });

  it('has nothing to say about no days', () => {
    expect(mostLogged([], symptomsOf, 5)).toEqual([]);
  });

  it('counts a day that the cycle could not place, because it still happened', () => {
    // The whole reason this is not `placedCount`. Nothing here knows or cares
    // about phases: a day written down before the first period was recorded is
    // a day the person wrote down.
    const days = [entry('2026-01-01', ['cramps'])];

    expect(mostLogged(days, symptomsOf, 5)).toEqual([{ id: 'cramps', count: 1 }]);
  });

  it('counts whatever it is handed, not only symptoms', () => {
    // Same injection the correlation does, for the same reason: the domain
    // stays clear of the catalogue and of the language.
    const days = [entry('2026-10-01', [], 'calm'), entry('2026-10-02', [], 'calm')];

    expect(mostLogged(days, (day) => (day.moodId === null ? [] : [day.moodId]), 5)).toEqual([
      { id: 'calm', count: 2 },
    ]);
  });
});
