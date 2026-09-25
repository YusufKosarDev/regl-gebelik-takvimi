import { FERTILITY_DISCLAIMER, selectedDayRows, summaryRows } from '../home-messages';

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
    ...overrides,
  };
}

describe('summaryRows', () => {
  it('names the four facts in order', () => {
    expect(summaryRows(dashboard()).map((row) => row.label)).toEqual([
      'Döngü günü',
      'Döngü evresi',
      'Doğurganlık tahmini',
      'Sonraki regl tahmini',
    ]);
  });

  it('reads the values off the dashboard', () => {
    const rows = summaryRows(dashboard());

    expect(rows[0]?.value).toBe('5. gün');
    expect(rows[1]?.value).toBe('Regl');
    expect(rows[2]?.value).toBe('Düşük');
    expect(rows[3]?.value).toBe('2 Nisan 2026');
  });

  it('says a cycle has not started rather than showing a day', () => {
    expect(summaryRows(dashboard({ cycleDay: null }))[0]?.value).toBe('Henüz başlamadı');
  });

  it('says the next period cannot be worked out yet rather than guessing', () => {
    expect(summaryRows(dashboard({ nextPeriodStart: null }))[3]?.value).toBe(
      'Henüz hesaplanamıyor'
    );
  });

  // The warning is the reason the row has a note at all. Attached to the row, it
  // cannot be laid out away from the estimate it qualifies.
  it('carries the contraception warning on the fertility row and nowhere else', () => {
    const rows = summaryRows(dashboard());

    expect(rows[2]?.note).toBe(FERTILITY_DISCLAIMER);
    expect(rows.filter((row) => row.note !== undefined)).toHaveLength(1);
  });

  it('keeps the warning when the estimate is unknown', () => {
    expect(summaryRows(dashboard({ fertilityLevel: null }))[2]).toEqual({
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
      { label: 'Doğurganlık tahmini', value: 'En yüksek' },
    ]);
  });

  it('says a cycle has not started rather than showing a day', () => {
    expect(selectedDayRows(day({ cycleDay: null }))[0]?.value).toBe('Henüz başlamadı');
  });

  // A day in the calendar and today in the summary are the same four facts minus
  // the prediction, so the wording has to match or the same day reads two ways.
  it('words the facts it shares with the summary identically', () => {
    const summary = summaryRows(dashboard());
    const selected = selectedDayRows(day());

    expect(selected).toEqual(summary.slice(0, 3).map(({ label, value }) => ({ label, value })));
  });
});
