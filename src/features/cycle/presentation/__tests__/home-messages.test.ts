import {
  FERTILITY_DISCLAIMER,
  homeMessages,
  selectedDayRows,
  summaryRows,
  summaryRowsIn,
} from '../home-messages';
import { cycleLabels } from '../cycle-labels';

import type { CycleCalendarDay } from '@/features/cycle/application/build-cycle-calendar-month';
import type { CycleDashboard } from '@/features/cycle/application/get-cycle-dashboard';
import type { ISODate } from '@/types/iso-date';

/**
 * The two row builders the home screen split produced.
 *
 * They were expressions inside the component until the screen was split, where
 * only a rendering test could reach them. They are the same four facts about two
 * different days, so what is asserted here is mostly that they agree.
 */

const TODAY = '2026-03-10' as ISODate;

function dashboard(overrides: Partial<CycleDashboard> = {}): CycleDashboard {
  return {
    today: TODAY,
    cycleDay: 5,
    phase: 'menstrual',
    fertilityLevel: 'low',
    nextPeriodStart: '2026-04-02' as ISODate,
    isBeyondHorizon: false,
    ...overrides,
  };
}

function day(overrides: Partial<CycleCalendarDay> = {}): CycleCalendarDay {
  return {
    date: TODAY,
    cycleDay: 5,
    phase: 'menstrual',
    fertilityLevel: 'low',
    isPredictedPeriodStart: false,
    isPredictedPeriodDay: false,
    isBeyondHorizon: false,
    ...overrides,
  };
}

describe('summaryRows', () => {
  it('names the four facts in order', () => {
    expect(summaryRows(dashboard(), 'tr').map((row) => row.label)).toEqual([
      'Döngü günü',
      'Döngü evresi',
      'Doğurganlık tahmini',
      'Sonraki regl tahmini',
    ]);
  });

  it('reads the values off the dashboard', () => {
    const rows = summaryRows(dashboard(), 'tr');

    expect(rows[0]?.value).toBe('5. gün');
    expect(rows[1]?.value).toBe('Regl');
    expect(rows[2]?.value).toBe('Düşük');
    expect(rows[3]?.value).toBe('2 Nisan 2026');
  });

  it('says a cycle has not started rather than showing a day', () => {
    expect(summaryRows(dashboard({ cycleDay: null }), 'tr')[0]?.value).toBe('Henüz başlamadı');
  });

  it('says the next period cannot be worked out yet rather than guessing', () => {
    expect(summaryRows(dashboard({ nextPeriodStart: null }), 'tr')[3]?.value).toBe(
      'Henüz hesaplanamıyor'
    );
  });

  // The warning is the reason the row has a note at all. Attached to the row, it
  // cannot be laid out away from the estimate it qualifies.
  it('carries the contraception warning on the fertility row and nowhere else', () => {
    const rows = summaryRows(dashboard(), 'tr');

    expect(rows[2]?.note).toBe(FERTILITY_DISCLAIMER);
    expect(rows.filter((row) => row.note !== undefined)).toHaveLength(1);
  });

  it('keeps the warning when the estimate is unknown', () => {
    expect(summaryRows(dashboard({ fertilityLevel: null }), 'tr')[2]).toEqual({
      label: 'Doğurganlık tahmini',
      value: 'Bilinmiyor',
      note: FERTILITY_DISCLAIMER,
    });
  });
});

describe('selectedDayRows', () => {
  it('names the three facts a calendar square carries, in order', () => {
    expect(selectedDayRows(day()).map((row) => row.label)).toEqual([
      'Döngü günü',
      'Döngü evresi',
      'Doğurganlık tahmini',
    ]);
  });

  it('reads the values off the day itself', () => {
    expect(selectedDayRows(day({ cycleDay: 12, phase: 'ovulatory', fertilityLevel: 'peak' }))).toEqual([
      { label: 'Döngü günü', value: '12. gün' },
      { label: 'Döngü evresi', value: 'Yumurtlama' },
      { label: 'Doğurganlık tahmini', value: 'En yüksek', note: FERTILITY_DISCLAIMER },
    ]);
  });

  it('says a cycle has not started rather than showing a day', () => {
    expect(selectedDayRows(day({ cycleDay: null }))[0]?.value).toBe('Henüz başlamadı');
  });

  /**
   * A day in the calendar and today in the summary are the same four facts
   * minus the prediction, so the wording has to match or the same day reads
   * two ways.
   *
   * Compared whole, notes included. It used to strip the note off the summary
   * rows before comparing - `summary.slice(0, 3).map(({ label, value }) => …)`
   * - which is how the two screens disagreed about the contraception warning
   * while a test called their wording identical. The stripping *was* the
   * difference it was supposed to catch.
   */
  it('words the facts it shares with the summary identically', () => {
    const summary = summaryRows(dashboard(), 'tr');
    const selected = selectedDayRows(day());

    expect(selected).toEqual(summary.slice(0, 3));
  });
});

/**
 * The fertility row has two ways of saying nothing, and they are not the same.
 *
 * Before the first record the app genuinely does not know. Past the predicted
 * period it declines to estimate. Both leave `fertilityLevel` null, so a row
 * reading only the null would say "Bilinmiyor" to both - which is the
 * collision the selected-day card had.
 */
describe('the fertility row past the horizon', () => {
  it('says the estimate does not reach, not that the answer is unknown', () => {
    const rows = summaryRows(
      dashboard({ fertilityLevel: null, isBeyondHorizon: true }),
      'tr'
    );

    expect(rows[2]?.value).toBe(homeMessages.tr.fertilityBeyondHorizon);
    expect(rows[2]?.value).not.toBe(cycleLabels.tr.unknownLabel);
  });

  it('still says unknown for a day the cycle cannot place at all', () => {
    const rows = summaryRows(
      dashboard({ fertilityLevel: null, isBeyondHorizon: false }),
      'tr'
    );

    expect(rows[2]?.value).toBe(cycleLabels.tr.unknownLabel);
  });
});

/**
 * The next-period row once the predicted day has gone by.
 *
 * It showed `predictNextPeriodStart` whatever the date was, so somebody ten
 * days late read a prediction for a day that had already passed - stated as
 * fact, directly under a fertility row that had just declined to estimate.
 *
 * The boundary is `isBeyondHorizon`, the same one the hero and the card use,
 * so three screens stop at one moment for one reason.
 */
describe('the next period row past the horizon', () => {
  it('says the expected day has passed instead of naming it', () => {
    const rows = summaryRows(dashboard({ isBeyondHorizon: true }), 'tr');

    expect(rows[3]?.value).toBe(homeMessages.tr.nextPeriodExpectedDayPassed);
    expect(rows[3]?.note).toBeUndefined();
  });

  it('still names the day while the predicted period is running', () => {
    // The boundary this turns on: inside the predicted period the date is
    // still the answer, and an off-by-one here would take it away a day early.
    const rows = summaryRows(dashboard({ isBeyondHorizon: false }), 'tr');

    expect(rows[3]?.value).toBe('2 Nisan 2026');
  });

  it('leaves a stale profile its own message, with its note', () => {
    // The ordering this depends on: stale is checked first, so records older
    // than STALE_PREDICTION_DAYS keep the message that explains how to get a
    // prediction back rather than the plainer one. Both states are past the
    // horizon - a 90-day-old record is past it by definition - so moving the
    // horizon branch above the stale one would make that branch unreachable
    // without failing anything else.
    const rows = summaryRowsIn(
      homeMessages.tr,
      cycleLabels.tr,
      dashboard({ isBeyondHorizon: true }),
      'tr',
      {
        observations: {
          lengths: [],
          shortestDays: null,
          longestDays: null,
          medianDays: null,
          spreadDays: null,
          discardedCount: 0,
        },
        cycleLengthSuggestion: null,
        predictionConfidence: 'stale',
        nextPeriodRange: null,
      }
    );

    expect(rows[3]?.value).toBe(homeMessages.tr.nextPeriodStale);
    expect(rows[3]?.note).toBe(homeMessages.tr.predictionStaleNote);
  });

  it('does not say the same thing as the stale row', () => {
    // They decline for different reasons: one because the records are too old
    // to compute from, one because the day computed has been and gone.
    expect(homeMessages.tr.nextPeriodExpectedDayPassed).not.toBe(
      homeMessages.tr.nextPeriodStale
    );
    expect(homeMessages.en.nextPeriodExpectedDayPassed).not.toBe(
      homeMessages.en.nextPeriodStale
    );
  });
});

/**
 * The calendar's fertility row carries the same warning the summary's does.
 *
 * ## Why this was missing, and why it is not a judgement call
 *
 * Both screens show a fertility estimate off the same domain value. Only the
 * home screen carried the sentence saying the estimate is not a method of
 * contraception, and nothing anywhere said why. Three places named the
 * difference - `SummaryRow`'s doc ("with one addition"), `selectedDayRowsIn`'s
 * own doc, which did not mention the warning at all, and the two return types
 * themselves - and none of them defended it.
 *
 * The one place it was written down is the commit that created the panel,
 * `801dc56`: "The summary, the legend and the contraception disclaimer are
 * untouched." That is a scope sentence, not a decision - it records what the
 * round did not touch, beside two other things that genuinely did not need
 * touching. The later rewrite of these rows, `7e2c5c9`, reconsidered all three
 * states of the card and never mentioned the warning either.
 *
 * So somebody tapping 14 September in the calendar was shown an estimate and
 * not the caveat, while somebody looking at the same estimate on the home
 * screen was shown both. One estimate, one warning, wherever it is read.
 */
describe('the warning the estimate travels with', () => {
  it('is on the calendar row, not only the summary row', () => {
    const fertility = selectedDayRows(day({ fertilityLevel: 'peak' })).find(
      (row) => row.label === 'Doğurganlık tahmini'
    );

    expect(fertility?.note).toBe(FERTILITY_DISCLAIMER);
  });

  it('is the same sentence both screens use, not a second copy of it', () => {
    const fromCalendar = selectedDayRows(day()).find(
      (row) => row.label === 'Doğurganlık tahmini'
    );
    const fromSummary = summaryRows(dashboard(), 'tr').find(
      (row) => row.label === 'Doğurganlık tahmini'
    );

    expect(fromCalendar?.note).toBe(fromSummary?.note);
  });

  it('sits on the fertility row and no other', () => {
    // The cycle day is arithmetic from a record and the phase is a label for
    // it. Neither is the thing somebody might act on, and a warning repeated
    // under all three would be three sentences nobody reads.
    const noted = selectedDayRows(day()).filter((row) => row.note !== undefined);

    expect(noted.map((row) => row.label)).toEqual(['Doğurganlık tahmini']);
  });

  /**
   * Past the horizon the panel offers no estimate at all, so there is nothing
   * to qualify. A warning about an estimate that is not on screen would be the
   * card answering a question it did not ask.
   */
  it('is absent past the horizon, where there is no estimate to qualify', () => {
    const rows = selectedDayRows(day({ isBeyondHorizon: true }));

    expect(rows.map((row) => row.label)).toEqual(['Döngü günü']);
    expect(rows.some((row) => row.note !== undefined)).toBe(false);
  });
});
