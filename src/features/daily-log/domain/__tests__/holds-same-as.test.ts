import { holdsSameAs } from '../catalogues';
import type { DailyEntry } from '../catalogues';

import type { ISODate } from '@/types/iso-date';

/**
 * Whether a day on screen still matches the one that was read from the
 * database.
 *
 * It exists because the log grew a week strip: moving to another day replaces
 * everything on screen, and doing that to somebody who has just ticked four
 * symptoms and not pressed save is losing their work without saying so. The
 * screen asks this before it moves.
 *
 * The order of the symptoms is not part of the answer. They are a set, they
 * are stored and read back in whatever order the table gives them, and a day
 * that reads as changed because the same four came back in a different order
 * would block the strip for no reason at all.
 */
const DATE = '2026-10-11' as ISODate;

function entry(over: Partial<DailyEntry> = {}): DailyEntry {
  return { date: DATE, flowId: null, moodId: null, symptomIds: [], ...over };
}

describe('holdsSameAs', () => {
  it('is true for two empty days', () => {
    expect(holdsSameAs(entry(), entry())).toBe(true);
  });

  it('sees a flow that was chosen', () => {
    expect(holdsSameAs(entry({ flowId: 'light' }), entry())).toBe(false);
  });

  it('sees a mood that was chosen', () => {
    expect(holdsSameAs(entry({ moodId: 'calm' }), entry())).toBe(false);
  });

  it('sees a symptom that was added', () => {
    expect(holdsSameAs(entry({ symptomIds: ['cramps'] }), entry())).toBe(false);
  });

  it('sees a symptom that was removed', () => {
    expect(holdsSameAs(entry({ symptomIds: ['cramps'] }), entry({ symptomIds: ['cramps', 'acne'] }))).toBe(
      false
    );
  });

  it('does not care what order the symptoms are in', () => {
    // Read back from the table in another order, which is not a change.
    expect(
      holdsSameAs(entry({ symptomIds: ['cramps', 'acne'] }), entry({ symptomIds: ['acne', 'cramps'] }))
    ).toBe(true);
  });

  it('does not care which day it is', () => {
    // The screen compares what is on it against what was read for the *same*
    // day. Two different dates holding the same marks are the same marks.
    expect(holdsSameAs(entry(), entry({ date: '2026-10-12' as ISODate }))).toBe(true);
  });
});
