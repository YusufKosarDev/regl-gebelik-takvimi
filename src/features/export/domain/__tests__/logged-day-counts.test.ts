import type { DailyEntry } from '@/features/daily-log/domain/catalogues';
import type { ISODate } from '@/types/iso-date';

import { countLoggedDaysForDocument, MIN_DAYS_FOR_DOCUMENT_COUNT } from '../logged-day-counts';

/**
 * What the printable document is allowed to count, and what it leaves out.
 *
 * ## Why a floor at all, when the screen has none for counts
 *
 * `records-summary.tsx` draws no *bar* under five entries - "the length of a
 * bar is read as a measurement" - but it does print the count as a number,
 * because somebody is entitled to see what they recorded and a reader there can
 * look at the rest of the screen.
 *
 * A page cannot be asked a follow-up question. It arrives without the app,
 * beside somebody with the authority to act on it, and "Headache - 1 day" in
 * that setting reads as a finding rather than as a note somebody made once. So
 * the document carries only the counts the app elsewhere treats as enough to
 * mention, and `pdfCountsBelowFloor` says in words that the rest exist.
 *
 * ## Why the label resolver is an argument
 *
 * This counts; it does not know what anything is called. The catalogue lives in
 * `daily-log/presentation` and arrives already narrowed to one language, so
 * passing the lookup in keeps that import out of here and keeps this a pure
 * function of what it is given.
 */

function day(date: string, symptomIds: readonly string[], moodId: string | null): DailyEntry {
  return {
    date: date as ISODate,
    flowId: null,
    moodId,
    symptomIds,
    notes: null,
  } as DailyEntry;
}

/** Days all holding the same one thing, which is the shape most cases need. */
function daysHolding(symptom: string, howMany: number): readonly DailyEntry[] {
  return Array.from({ length: howMany }, (_, index) =>
    day(`2026-09-${String(index + 1).padStart(2, '0')}`, [symptom], null)
  );
}

/** Every id gets a word, which is the ordinary case. */
const named = (id: string): string | null => `name:${id}`;

describe('the floor', () => {
  it('is the five the daily-log domain already uses', () => {
    // Not a number chosen for this file. If the domain's threshold moves, this
    // moves with it rather than drifting apart from it.
    expect(MIN_DAYS_FOR_DOCUMENT_COUNT).toBe(5);
  });
});

describe('counting for the document', () => {
  it('lists something written on exactly the floor', () => {
    const counts = countLoggedDaysForDocument(daysHolding('cramps', 5), named);

    expect(counts.listed).toEqual([{ label: 'name:cramps', days: 5 }]);
    expect(counts.hasBelowFloor).toBe(false);
  });

  it('leaves out something one day short of it', () => {
    const counts = countLoggedDaysForDocument(daysHolding('cramps', 4), named);

    expect(counts.listed).toEqual([]);
  });

  it('says that something was left out, rather than only leaving it out', () => {
    const counts = countLoggedDaysForDocument(daysHolding('cramps', 4), named);

    expect(counts.hasBelowFloor).toBe(true);
  });

  it('counts moods alongside symptoms', () => {
    const entries = Array.from({ length: 6 }, (_, index) =>
      day(`2026-09-0${index + 1}`, [], 'good')
    );

    const counts = countLoggedDaysForDocument(entries, named);

    expect(counts.listed).toEqual([{ label: 'name:good', days: 6 }]);
  });

  it('counts a day holding both without one hiding the other', () => {
    const entries = Array.from({ length: 5 }, (_, index) =>
      day(`2026-09-0${index + 1}`, ['cramps'], 'bad')
    );

    const counts = countLoggedDaysForDocument(entries, named);

    expect(counts.listed).toEqual([
      { label: 'name:bad', days: 5 },
      { label: 'name:cramps', days: 5 },
    ]);
  });

  /**
   * Most written down first, and the tie broken by id.
   *
   * `most-logged.ts` reasons about exactly this: "Without the second key two
   * things written down the same number of times would come out in whatever
   * order the map happened to hold them." A document reshuffling itself between
   * two exports of the same data would be worse than on a screen, because the
   * two copies sit side by side on a desk.
   */
  it('puts the most written down first', () => {
    const entries = [
      ...Array.from({ length: 5 }, (_, index) => day(`2026-09-0${index + 1}`, ['cramps'], null)),
      ...Array.from({ length: 7 }, (_, index) => day(`2026-10-0${index + 1}`, ['fatigue'], null)),
    ];

    const counts = countLoggedDaysForDocument(entries, named);

    expect(counts.listed.map((row) => row.days)).toEqual([7, 5]);
  });

  it('counts a day once however many times the id appears on it', () => {
    // A stored day should not hold the same symptom twice, but it is a list in
    // the database and a count of days must not become a count of mentions.
    // `most-logged.ts` is what makes this true; this asserts it still arrives
    // here, because a page handed to a clinician is where it costs most.
    const entries = Array.from({ length: 5 }, (_, index) =>
      day(`2026-09-0${index + 1}`, ['cramps', 'cramps'], null)
    );

    const counts = countLoggedDaysForDocument(entries, named);

    expect(counts.listed).toEqual([{ label: 'name:cramps', days: 5 }]);
  });
});

describe('an id this build has no word for', () => {
  /**
   * `labelFor` returns `null` for an id a later build retired or an older one
   * never heard of, and says what to do with it: "the caller decides what to
   * show, which in practice means it shows nothing." A raw `sleep-trouble` on a
   * page handed to a clinician is worse than one fewer line.
   */
  it('is left off the page rather than printed as an id', () => {
    const counts = countLoggedDaysForDocument(daysHolding('retired-thing', 9), () => null);

    expect(counts.listed).toEqual([]);
  });

  /**
   * And it does not trip the note about short counts either.
   *
   * `pdfCountsBelowFloor` tells the reader that things written on fewer than
   * five days were left out. An unnamed id was left out for a different reason,
   * and printing that sentence over it would be the page explaining an absence
   * it has not got.
   *
   * The unnamed id here has to be *under* the floor for this to test anything:
   * with it above the floor the assertion holds whether the labels are resolved
   * before or after the floor is applied, which is the whole rule.
   */
  it('does not make the page claim something was below the floor', () => {
    const entries = [
      ...Array.from({ length: 6 }, (_, index) => day(`2026-09-0${index + 1}`, ['cramps'], null)),
      ...Array.from({ length: 3 }, (_, index) =>
        day(`2026-10-0${index + 1}`, ['retired-thing'], null)
      ),
    ];

    const counts = countLoggedDaysForDocument(entries, (id) =>
      id === 'retired-thing' ? null : `name:${id}`
    );

    expect(counts.listed).toEqual([{ label: 'name:cramps', days: 6 }]);
    expect(counts.hasBelowFloor).toBe(false);
  });
});

describe('nothing recorded', () => {
  it('lists nothing and claims nothing was left out', () => {
    const counts = countLoggedDaysForDocument([], named);

    expect(counts).toEqual({ listed: [], hasBelowFloor: false });
  });
});
