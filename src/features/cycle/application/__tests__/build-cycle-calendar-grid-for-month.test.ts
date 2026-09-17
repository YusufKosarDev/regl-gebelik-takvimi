import { buildCycleCalendarGridForMonth } from '../build-cycle-calendar-grid-for-month';
import { buildCycleCalendarMonth } from '../build-cycle-calendar-month';

import { buildCycleCalendarGrid } from '@/features/cycle/presentation/build-cycle-calendar-grid';
import type { CycleProfile } from '@/features/cycle/domain/types';
import type { ISODate } from '@/types/iso-date';

/** Cycle 28, period 5 -> ovulation on day 14, fertile window days 9-15. */
function profile(startDates: string[] = ['2026-09-01']): CycleProfile {
  return {
    settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
    periodRecords: startDates.map((startDate, index) => ({
      id: `record-${index}`,
      startDate: startDate as ISODate,
    })),
  };
}

function dayCount(grid: ReturnType<typeof buildCycleCalendarGridForMonth>): number {
  return grid.cells.filter((cell) => cell.kind === 'day').length;
}

describe('buildCycleCalendarGridForMonth', () => {
  it('builds the month it was asked for', () => {
    const grid = buildCycleCalendarGridForMonth(profile(), 2026, 9);

    expect(grid.year).toBe(2026);
    expect(grid.month).toBe(9);
    expect(dayCount(grid)).toBe(30);
  });

  it('matches composing the two builders by hand', () => {
    const subject = profile();

    expect(buildCycleCalendarGridForMonth(subject, 2026, 9)).toEqual(
      buildCycleCalendarGrid(buildCycleCalendarMonth(subject, 2026, 9))
    );
  });

  it('builds a month the profile has no records in', () => {
    const grid = buildCycleCalendarGridForMonth(profile(), 2026, 8);

    expect(dayCount(grid)).toBe(31);
    // Before the first recorded period, so the domain places nothing.
    for (const cell of grid.cells) {
      if (cell.kind === 'day') {
        expect(cell.day.cycleDay).toBeNull();
        expect(cell.day.phase).toBeNull();
      }
    }
  });

  it('builds a later month with the cycle carried forward', () => {
    const grid = buildCycleCalendarGridForMonth(profile(), 2026, 10);
    const firstDay = grid.cells.find((cell) => cell.kind === 'day');

    expect(dayCount(grid)).toBe(31);
    expect(firstDay?.kind === 'day' && firstDay.day.cycleDay).toBe(31);
  });

  it('carries the predicted period start into the month it falls in', () => {
    // Cycle 30 from 2026-09-02 predicts 2026-10-02.
    const subject: CycleProfile = {
      settings: { averageCycleLengthDays: 30, averagePeriodLengthDays: 6 },
      periodRecords: [{ id: 'a', startDate: '2026-09-02' as ISODate }],
    };

    const september = buildCycleCalendarGridForMonth(subject, 2026, 9);
    const october = buildCycleCalendarGridForMonth(subject, 2026, 10);

    expect(september.cells.some((c) => c.kind === 'day' && c.day.isPredictedPeriodStart)).toBe(
      false
    );

    const predicted = october.cells.filter(
      (cell) => cell.kind === 'day' && cell.day.isPredictedPeriodStart
    );

    expect(predicted).toHaveLength(1);
    expect(predicted[0].kind === 'day' && predicted[0].day.date).toBe('2026-10-02');
  });

  it('handles a leap February', () => {
    expect(dayCount(buildCycleCalendarGridForMonth(profile(['2024-02-03']), 2024, 2))).toBe(29);
  });

  it('handles a year boundary in both directions', () => {
    expect(buildCycleCalendarGridForMonth(profile(), 2025, 12).month).toBe(12);
    expect(buildCycleCalendarGridForMonth(profile(), 2027, 1).month).toBe(1);
  });

  it('rejects an impossible month', () => {
    expect(() => buildCycleCalendarGridForMonth(profile(), 2026, 13)).toThrow(
      /month between 1 and 12/
    );
  });

  it('does not mutate the profile', () => {
    const subject = profile(['2026-09-20', '2026-09-01']);
    const snapshot = JSON.parse(JSON.stringify(subject));

    buildCycleCalendarGridForMonth(subject, 2026, 9);
    buildCycleCalendarGridForMonth(subject, 2026, 10);

    expect(subject).toEqual(snapshot);
  });

  it('gives the same grid for the same month twice', () => {
    const subject = profile();

    expect(buildCycleCalendarGridForMonth(subject, 2026, 9)).toEqual(
      buildCycleCalendarGridForMonth(subject, 2026, 9)
    );
  });
});
