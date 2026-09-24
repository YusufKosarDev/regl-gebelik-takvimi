import type { DailyEntry } from '../catalogues';
import { emptyDailyEntry } from '../catalogues';
import { sortDailyEntries, validateDailyEntries, validateDailyEntry } from '../validation';

import type { ISODate } from '@/types/iso-date';

const date = (value: string) => value as ISODate;

function entry(overrides: Partial<DailyEntry> = {}): DailyEntry {
  return { ...emptyDailyEntry(date('2026-10-14')), ...overrides };
}

describe('one day', () => {
  it('accepts a day with only flow', () => {
    expect(() => validateDailyEntry(entry({ flowId: 'light' }))).not.toThrow();
  });

  it('accepts a day with everything', () => {
    expect(() =>
      validateDailyEntry(
        entry({ flowId: 'medium', moodId: 'good', symptomIds: ['cramps', 'fatigue'] })
      )
    ).not.toThrow();
  });

  it('accepts an empty day, which is what clearing one produces', () => {
    // Emptiness is refused at the list level, where it would end up in a
    // payload, not here — the repository asks this about a day it is about to
    // delete.
    expect(() => validateDailyEntry(emptyDailyEntry(date('2026-10-14')))).not.toThrow();
  });

  it.each(['2026-13-01', '14-10-2026', '2026-10-1', '', 'bugün'])(
    'refuses %s as a date',
    (value) => {
      expect(() => validateDailyEntry(entry({ date: date(value) }))).toThrow();
    }
  );

  it.each([
    ['a blank flow id', { flowId: '   ' }],
    ['a blank mood id', { moodId: '' }],
    ['a blank symptom id', { symptomIds: [' '] }],
  ])('refuses %s', (_label, overrides) => {
    expect(() => validateDailyEntry(entry(overrides as Partial<DailyEntry>))).toThrow();
  });

  it('refuses the same symptom twice', () => {
    expect(() => validateDailyEntry(entry({ symptomIds: ['cramps', 'cramps'] }))).toThrow();
  });

  it('refuses symptoms that are not a list', () => {
    expect(() =>
      validateDailyEntry(entry({ symptomIds: 'cramps' as unknown as readonly string[] }))
    ).toThrow();
  });

  it('accepts an id no catalogue knows', () => {
    // A later build may have written it, or an earlier one may have retired
    // it. Refusing would throw away what somebody recorded.
    expect(() => validateDailyEntry(entry({ symptomIds: ['from-a-newer-build'] }))).not.toThrow();
  });

  it('says nothing about the values it refused', () => {
    // These messages travel into logs, and what is in here is a record of
    // somebody's body.
    const thrown = (() => {
      try {
        validateDailyEntry(entry({ date: date('nope'), symptomIds: ['cramps'] }));

        return null;
      } catch (error) {
        return error as Error;
      }
    })();

    expect(thrown?.message).not.toContain('cramps');
  });
});

describe('a list of days', () => {
  it('accepts days on different dates', () => {
    expect(() =>
      validateDailyEntries([
        entry({ date: date('2026-10-14'), flowId: 'light' }),
        entry({ date: date('2026-10-15'), moodId: 'good' }),
      ])
    ).not.toThrow();
  });

  it('accepts an empty list', () => {
    expect(() => validateDailyEntries([])).not.toThrow();
  });

  it('refuses two days on the same date', () => {
    // Nothing could say which one the person meant.
    expect(() =>
      validateDailyEntries([entry({ flowId: 'light' }), entry({ moodId: 'good' })])
    ).toThrow();
  });

  it('refuses a day holding nothing', () => {
    // An empty day is deleted, not stored. One arriving here means something
    // upstream is writing rows nobody asked for.
    expect(() => validateDailyEntries([emptyDailyEntry(date('2026-10-14'))])).toThrow();
  });

  it('refuses something that is not a list', () => {
    expect(() =>
      validateDailyEntries(null as unknown as readonly DailyEntry[])
    ).toThrow();
  });
});

describe('putting days in an order two devices agree on', () => {
  it('sorts by date', () => {
    const sorted = sortDailyEntries([
      entry({ date: date('2026-10-15'), flowId: 'light' }),
      entry({ date: date('2026-10-13'), flowId: 'light' }),
      entry({ date: date('2026-10-14'), flowId: 'light' }),
    ]);

    expect(sorted.map((day) => day.date)).toEqual(['2026-10-13', '2026-10-14', '2026-10-15']);
  });

  it('sorts the symptoms inside a day', () => {
    // A fingerprint has to reduce the same data to the same text wherever it
    // is computed, and neither SQLite nor Firestore promises an order.
    const sorted = sortDailyEntries([entry({ symptomIds: ['fatigue', 'acne', 'cramps'] })]);

    expect(sorted[0].symptomIds).toEqual(['acne', 'cramps', 'fatigue']);
  });

  it('does not mutate what it was given', () => {
    const original = entry({ symptomIds: ['fatigue', 'acne'] });
    const before = JSON.stringify(original);

    sortDailyEntries([original]);

    expect(JSON.stringify(original)).toBe(before);
  });

  it('is stable for a list that is already sorted', () => {
    const already = sortDailyEntries([
      entry({ date: date('2026-10-13'), symptomIds: ['acne'] }),
      entry({ date: date('2026-10-14'), symptomIds: ['cramps'] }),
    ]);

    expect(sortDailyEntries(already)).toEqual(already);
  });
});
