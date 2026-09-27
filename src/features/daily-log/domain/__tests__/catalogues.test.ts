import type { CatalogueEntry, DailyEntry } from '../catalogues';
import {
  FLOW_LEVELS,
  MOODS,
  SYMPTOMS,
  emptyDailyEntry,
  entryById,
  hasAnything,
  offered,
} from '../catalogues';

import type { ISODate } from '@/types/iso-date';

const date = (value: string) => value as ISODate;

const CATALOGUES: readonly (readonly [string, readonly CatalogueEntry[]])[] = [
  ['flow', FLOW_LEVELS],
  ['symptoms', SYMPTOMS],
  ['moods', MOODS],
];

describe.each(CATALOGUES)('the %s catalogue', (_name, catalogue) => {
  it('has no two entries with the same id', () => {
    // A duplicate id makes a stored day ambiguous, and nothing downstream could
    // say which entry was meant.
    const ids = catalogue.map((entry) => entry.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has no blank ids', () => {
    // The label half of this moved to the presentation catalogue test, which is
    // where the words now live.
    for (const entry of catalogue) {
      expect(entry.id.trim()).not.toBe('');
    }
  });

  it('offers everything that is not hidden', () => {
    expect(offered(catalogue)).toEqual(catalogue.filter((entry) => entry.hidden !== true));
  });

  it('can still name a hidden entry', () => {
    // The catalogue rule: retiring an entry must not make the days that hold
    // it unreadable.
    const retired: readonly CatalogueEntry[] = [
      ...catalogue,
      { id: 'retired-for-this-test', hidden: true },
    ];

    expect(offered(retired)).not.toContainEqual(retired[retired.length - 1]);
    expect(entryById(retired, 'retired-for-this-test')).not.toBeNull();
  });
});

describe('the catalogues as shipped', () => {
  it('offers four flow levels, spotting first', () => {
    // Spotting is its own level rather than a lighter shade of light: it
    // happens on days that belong to no period at all.
    expect(offered(FLOW_LEVELS).map((entry) => entry.id)).toEqual([
      'spotting',
      'light',
      'medium',
      'heavy',
    ]);
  });

  it('offers ten symptoms', () => {
    // The number is a design decision: more turns a quick note into a form.
    expect(offered(SYMPTOMS)).toHaveLength(10);
  });

  it('offers five moods, best to worst', () => {
    expect(offered(MOODS).map((entry) => entry.id)).toEqual([
      'very-good',
      'good',
      'okay',
      'bad',
      'very-bad',
    ]);
  });

  it('has no mood id calling itself normal', () => {
    // What is normal for somebody is not this app's to say. The ids are checked
    // here and the words each language uses are checked in the presentation
    // catalogue test, which is where they live.
    for (const mood of MOODS) {
      expect(mood.id).not.toContain('normal');
    }
  });
});

describe('finding an entry by id', () => {
  it('returns it', () => {
    expect(entryById(SYMPTOMS, 'cramps')?.id).toBe('cramps');
  });

  it('returns null for an id no catalogue has', () => {
    // A stored day can name something a later build retired or something a
    // newer build knows and this one does not. Neither is a fault. The label
    // half of this is asserted in the presentation catalogue test.
    expect(entryById(SYMPTOMS, 'something-from-the-future')).toBeNull();
  });
});

describe('whether a day holds anything', () => {
  const day = (overrides: Partial<DailyEntry> = {}): DailyEntry => ({
    ...emptyDailyEntry(date('2026-10-14')),
    ...overrides,
  });

  it('says no for a day nobody touched', () => {
    expect(hasAnything(emptyDailyEntry(date('2026-10-14')))).toBe(false);
  });

  it.each([
    ['flow alone', day({ flowId: 'light' })],
    ['mood alone', day({ moodId: 'good' })],
    ['one symptom alone', day({ symptomIds: ['cramps'] })],
  ])('says yes for %s', (_label, entry) => {
    expect(hasAnything(entry)).toBe(true);
  });

  it('gives an empty day the date it was asked about', () => {
    expect(emptyDailyEntry(date('2026-10-14')).date).toBe('2026-10-14');
  });
});
