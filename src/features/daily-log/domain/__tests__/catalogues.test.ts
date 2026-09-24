import type { CatalogueEntry, DailyEntry } from '../catalogues';
import {
  FLOW_LEVELS,
  MOODS,
  SYMPTOMS,
  emptyDailyEntry,
  entryById,
  hasAnything,
  labelFor,
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

  it('has no blank ids or labels', () => {
    for (const entry of catalogue) {
      expect(entry.id.trim()).not.toBe('');
      expect(entry.label.trim()).not.toBe('');
    }
  });

  it('has no two entries with the same label', () => {
    // Two rows reading the same would be indistinguishable on screen.
    const labels = catalogue.map((entry) => entry.label);

    expect(new Set(labels).size).toBe(labels.length);
  });

  it('offers everything that is not hidden', () => {
    expect(offered(catalogue)).toEqual(catalogue.filter((entry) => entry.hidden !== true));
  });

  it('can still name a hidden entry', () => {
    // The catalogue rule: retiring an entry must not make the days that hold
    // it unreadable.
    const retired: readonly CatalogueEntry[] = [
      ...catalogue,
      { id: 'retired-for-this-test', label: 'Artık sunulmuyor', hidden: true },
    ];

    expect(offered(retired)).not.toContainEqual(retired[retired.length - 1]);
    expect(labelFor(retired, 'retired-for-this-test')).toBe('Artık sunulmuyor');
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

  it('never calls a mood normal', () => {
    // What is normal for somebody is not this app's to say, and a scale with a
    // normal on it turns a note into a verdict.
    for (const mood of MOODS) {
      expect(mood.label.toLocaleLowerCase('tr')).not.toContain('normal');
    }
  });
});

describe('finding an entry by id', () => {
  it('returns it', () => {
    expect(entryById(SYMPTOMS, 'cramps')?.label).toBe('Kramp');
  });

  it('returns null for an id no catalogue has', () => {
    // A stored day can name something a later build retired or something a
    // newer build knows and this one does not. Neither is a fault.
    expect(entryById(SYMPTOMS, 'something-from-the-future')).toBeNull();
    expect(labelFor(SYMPTOMS, 'something-from-the-future')).toBeNull();
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
