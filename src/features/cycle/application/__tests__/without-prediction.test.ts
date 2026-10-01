import { buildCycleCalendarGridForMonth } from '../build-cycle-calendar-grid-for-month';
import { withoutPrediction } from '../without-prediction';

import type { CycleProfile } from '@/features/cycle/domain/types';
import type { ISODate } from '@/types/iso-date';

/**
 * Taking the prediction off a month the app no longer stands behind.
 *
 * The thing worth asserting is that nothing else moves. This runs on the grid
 * the calendar actually renders, so a change to the marker, the label or the
 * detail panel cannot diverge from it.
 */

const PROFILE: CycleProfile = {
  settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
  periodRecords: [
    { id: 'period-2026-09-01', startDate: '2026-09-01' as ISODate, isOngoing: false },
  ],
};

/** The predicted start is 2026-09-29, so September is the month that holds it. */
const grid = buildCycleCalendarGridForMonth(PROFILE, 2026, 9);

describe('removing the prediction', () => {
  it('starts from a month that actually has one, or the test proves nothing', () => {
    const predicted = grid.cells.filter(
      (cell) => cell.kind === 'day' && cell.day.isPredictedPeriodStart
    );

    expect(predicted).toHaveLength(1);
  });

  it('leaves no day marked as a predicted start', () => {
    const stripped = withoutPrediction(grid);

    for (const cell of stripped.cells) {
      if (cell.kind === 'day') {
        expect(cell.day.isPredictedPeriodStart).toBe(false);
      }
    }
  });

  it('changes nothing else about any day', () => {
    const stripped = withoutPrediction(grid);

    expect(stripped.year).toBe(grid.year);
    expect(stripped.month).toBe(grid.month);
    expect(stripped.rowCount).toBe(grid.rowCount);
    expect(stripped.cells).toHaveLength(grid.cells.length);

    for (let index = 0; index < grid.cells.length; index += 1) {
      const before = grid.cells[index];
      const after = stripped.cells[index];

      expect(after.kind).toBe(before.kind);

      if (before.kind === 'day' && after.kind === 'day') {
        expect(after.day.date).toBe(before.day.date);
        expect(after.day.cycleDay).toBe(before.day.cycleDay);
        expect(after.day.phase).toBe(before.day.phase);
        expect(after.day.fertilityLevel).toBe(before.day.fertilityLevel);
      }
    }
  });

  it('leaves the grid it was given alone', () => {
    // The caller renders one of the two. Mutating the input would mean the
    // month it kept and the month it drew were the same object.
    const predictedBefore = grid.cells.filter(
      (cell) => cell.kind === 'day' && cell.day.isPredictedPeriodStart
    ).length;

    withoutPrediction(grid);

    const predictedAfter = grid.cells.filter(
      (cell) => cell.kind === 'day' && cell.day.isPredictedPeriodStart
    ).length;

    expect(predictedAfter).toBe(predictedBefore);
  });

  it('is harmless on a month that has no prediction in it', () => {
    const october = buildCycleCalendarGridForMonth(PROFILE, 2026, 10);

    expect(withoutPrediction(october)).toEqual(october);
  });
});
