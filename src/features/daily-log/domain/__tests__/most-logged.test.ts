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

describe('a day that names the same thing twice', () => {
  /**
   * One day is one day, however the row is shaped.
   *
   * `symptomIds` is a list in the database, and nothing in the schema stops it
   * holding `cramps` twice. Today's chips are a toggle so the screen cannot
   * produce such a row - but that is a property of this version of the UI, not
   * of the data, and every heading over these numbers says "gün" / "days".
   * Counting mentions under that heading is simply a wrong number, and it gets
   * wronger the further from the screen it travels: the printable export puts
   * it on a page somebody hands to a clinician.
   *
   * So the count is of days, and the shape of the row is irrelevant to it.
   */
  it('counts it once', () => {
    const days = [entry('2026-10-01', ['cramps', 'cramps'])];

    expect(mostLogged(days, symptomsOf, 5)).toEqual([{ id: 'cramps', count: 1 }]);
  });

  it('still counts the other days it falls on', () => {
    const days = [
      entry('2026-10-01', ['cramps', 'cramps']),
      entry('2026-10-02', ['cramps']),
      entry('2026-10-03', ['cramps', 'cramps', 'cramps']),
    ];

    expect(mostLogged(days, symptomsOf, 5)).toEqual([{ id: 'cramps', count: 3 }]);
  });

  it('does not let a repeat push a thing up the order', () => {
    // The order is "most written down first". A day holding `acne` three times
    // is still one day, so two days of `cramps` comes first.
    const days = [
      entry('2026-10-01', ['acne', 'acne', 'acne']),
      entry('2026-10-02', ['cramps']),
      entry('2026-10-03', ['cramps']),
    ];

    expect(mostLogged(days, symptomsOf, 5)).toEqual([
      { id: 'cramps', count: 2 },
      { id: 'acne', count: 1 },
    ]);
  });

  it('counts the distinct things on the day towards the limit, not the mentions', () => {
    const days = [entry('2026-10-01', ['a', 'a', 'b', 'b'])];

    expect(mostLogged(days, symptomsOf, 5)).toHaveLength(2);
  });
});
