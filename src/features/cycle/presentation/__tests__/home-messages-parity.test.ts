import { describeCatalogueParity } from '../../../../../jest/catalogue-parity';
import { cycleLabels } from '../cycle-labels';
import { homeMessages, legendItemsIn, selectedDayRowsIn, summaryRowsIn } from '../home-messages';
import type { CycleCalendarDay } from '../../application/build-cycle-calendar-month';
import type { CycleDashboard } from '../../application/get-cycle-dashboard';

import { toISODate } from '@/utils/date';

/**
 * The home screen's words, in both languages.
 *
 * Its own file rather than a block inside `home-messages.test.ts`, which
 * asserts the Turkish and predates the second language. Nothing in it moved.
 */

describe('parity', () => {
  describeCatalogueParity(homeMessages, {
    functions: [
      ['cycleDayValue', [1], [14]],
      ['openSourceLabel', ['NHS']],
      ['calendarMonthLabel', ['September 2026']],
      ['legendItemLabel', ['P', 'Period day']],
      ['labelledValue', ['Cycle day', 'Day 14']],
    ],
    // Both are ": " joins of two values that have already been translated.
    identical: ['labelledValue', 'legendItemLabel'],
  });
});

describe('the weekday headers', () => {
  it('has seven in each language', () => {
    expect(homeMessages.tr.weekdayLabels).toHaveLength(7);
    expect(homeMessages.en.weekdayLabels).toHaveLength(7);
  });

  it('starts both on Monday', () => {
    // A device fact rather than a language one, and following it means
    // rewriting the grid's padding arithmetic. Until then, both are Monday
    // first and this says so out loud.
    expect(homeMessages.tr.weekdayLabels[0]).toBe('Pzt');
    expect(homeMessages.en.weekdayLabels[0]).toBe('Mon');
  });

  it('repeats no day in either language', () => {
    for (const labels of [homeMessages.tr.weekdayLabels, homeMessages.en.weekdayLabels]) {
      expect(new Set(labels).size).toBe(7);
    }
  });
});

describe('the legend', () => {
  it('explains four marks and not the fifth', () => {
    // The peak mark is left out on purpose: the peak day is by definition the
    // estimated ovulation day, so a filled circle never appears in a month.
    expect(legendItemsIn(homeMessages.tr)).toHaveLength(4);
    expect(legendItemsIn(homeMessages.en)).toHaveLength(4);
  });

  it('uses letters a reader of that language would look for', () => {
    // R and Y are the first letters of the Turkish words, P and O of the
    // English ones. A letter that matches no word on screen is a letter
    // nobody can decode.
    const turkish = legendItemsIn(homeMessages.tr).map((item) => item.marker);
    const english = legendItemsIn(homeMessages.en).map((item) => item.marker);

    expect(turkish.slice(0, 2)).toEqual(['R', 'Y']);
    expect(english.slice(0, 2)).toEqual(['P', 'O']);
  });

  it('gives the two symbols words rather than reading them aloud', () => {
    // "○" spoken is either nothing or noise.
    for (const items of [legendItemsIn(homeMessages.tr), legendItemsIn(homeMessages.en)]) {
      const circle = items.find((item) => item.marker === '○');

      expect(circle?.spokenMarker).not.toBe('○');
      expect(circle?.spokenMarker.trim()).not.toBe('');
    }
  });
});

describe('the rows', () => {
  const dashboard = (overrides: Partial<CycleDashboard> = {}): CycleDashboard =>
    ({
      cycleDay: 14,
      phase: 'ovulatory',
      fertilityLevel: 'peak',
      nextPeriodStart: toISODate('2026-10-01'),
      ...overrides,
    }) as CycleDashboard;

  it('carries the contraception warning on the fertility row, not beside it', () => {
    // The number and the warning about it cannot be separated by a layout.
    const rows = summaryRowsIn(homeMessages.en, cycleLabels.en, dashboard(), 'en');
    const fertility = rows.find((row) => row.label === homeMessages.en.rowFertility);

    expect(fertility?.note).toBe(homeMessages.en.fertilityDisclaimer);
    expect(fertility?.note).toMatch(/must not be used as a method of contraception/i);
  });

  it('says a cycle has not started rather than showing day zero', () => {
    const rows = summaryRowsIn(
      homeMessages.en,
      cycleLabels.en,
      dashboard({ cycleDay: null }),
      'en'
    );

    expect(rows[0]?.value).toBe(homeMessages.en.cycleNotStarted);
  });

  it('renders the next period date in the language it was given', () => {
    const rows = summaryRowsIn(homeMessages.en, cycleLabels.en, dashboard(), 'en');

    expect(rows[3]?.value).toBe('1 October 2026');
  });

  it('builds the selected day from the day the calendar already holds', () => {
    const day = {
      date: toISODate('2026-09-17'),
      cycleDay: 3,
      phase: 'menstrual',
      fertilityLevel: 'low',
      isPredictedPeriodStart: false,
    } as CycleCalendarDay;

    const rows = selectedDayRowsIn(homeMessages.en, cycleLabels.en, day);

    expect(rows.map((row) => row.value)).toEqual(['Day 3', 'Period', 'Low']);
  });
});
