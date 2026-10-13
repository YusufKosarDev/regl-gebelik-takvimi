import { buildCycleCalendarMonth } from '../build-cycle-calendar-month';
import { buildCycleCalendarGridForMonth } from '../build-cycle-calendar-grid-for-month';
import { withoutPrediction } from '../without-prediction';

import { getCycleDay } from '@/features/cycle/domain/cycle-day';
import { resolveCyclePhase } from '@/features/cycle/domain/cycle-phase';
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
    // November rather than October. The predicted period runs 29 September to
    // 3 October, so October holds its last three days and is no longer a month
    // with nothing predicted in it - which is the point of marking the whole
    // period rather than only its first day.
    const november = buildCycleCalendarGridForMonth(PROFILE, 2026, 11);

    expect(
      november.cells.filter(
        (cell) => cell.kind === 'day' && (cell.day.isPredictedPeriodStart || cell.day.isPredictedPeriodDay)
      )
    ).toEqual([]);

    expect(withoutPrediction(november)).toEqual(november);
  });

  it('takes the whole predicted period off, not only its first day', () => {
    const october = buildCycleCalendarGridForMonth(PROFILE, 2026, 10);

    const predictedIn = (grid: ReturnType<typeof buildCycleCalendarGridForMonth>) =>
      grid.cells.filter((cell) => cell.kind === 'day' && cell.day.isPredictedPeriodDay);

    // A stale prediction that lost its start and kept the days after it would
    // draw a period with no beginning.
    expect(predictedIn(october).length).toBeGreaterThan(0);
    expect(predictedIn(withoutPrediction(october))).toEqual([]);
    expect(predictedIn(withoutPrediction(grid))).toEqual([]);
  });
});

/**
 * Marking the rest of the predicted period changes nothing outside the calendar.
 *
 * ## Why this is asserted rather than reasoned about
 *
 * It looked inert. `buildCycleCalendarMonth` is read by four things and the
 * calendar is only one of them: `buildCyclePhaseIndex` takes `phase` off these
 * days for the daily-log history and the export, and the export takes
 * `cycleDay` for its CSV. Both are bounded by today, and a predicted period is
 * usually in the future - but not always. Somebody three days late has a
 * predicted start three days in the past, which is not stale, and its days
 * land inside the range those two ask about.
 *
 * So the safety does not come from the dates. It comes from the prediction
 * living in a field of its own: `phase` and `cycleDay` are untouched, and a
 * guess never reaches a correlation summary or a CSV column. This holds that.
 */
describe('what the predicted period does not touch', () => {
  /** A profile whose predicted period has already started and is not stale. */
  const LATE: CycleProfile = {
    settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
    periodRecords: [
      { id: 'period-2026-09-01', startDate: '2026-09-01' as ISODate, isOngoing: false },
    ],
  };

  it('has predicted days in the past to be dangerous with', () => {
    // Without this the rest of the block would pass by describing nothing.
    const october = buildCycleCalendarMonth(LATE, 2026, 10);

    expect(october.days.filter((day) => day.isPredictedPeriodDay).length).toBeGreaterThan(0);
  });

  it('leaves the phase of every predicted day exactly as it was', () => {
    // `buildCyclePhaseIndex` reads this and hands it to the history's
    // correlations and the export. A predicted day written in as 'menstrual'
    // would be a guess in a sentence about what happened.
    for (const month of [9, 10] as const) {
      for (const day of buildCycleCalendarMonth(LATE, 2026, month).days) {
        if (!day.isPredictedPeriodDay) continue;

        expect([day.date, day.phase]).toEqual([
          day.date,
          day.cycleDay === null
            ? null
            : resolveCyclePhase(LATE.settings, day.cycleDay),
        ]);
      }
    }
  });

  it('leaves the cycle day of every predicted day exactly as it was', () => {
    // The export's CSV counts from the latest recorded start. A predicted day
    // rolled back to 1 would put two day-1s in one cycle.
    for (const day of buildCycleCalendarMonth(LATE, 2026, 10).days) {
      if (!day.isPredictedPeriodDay) continue;

      expect([day.date, day.cycleDay]).toEqual([day.date, getCycleDay(LATE, day.date)]);
    }
  });

  it('changes the two predicted flags and nothing else a caller reads', () => {
    // Read from the other end: everything a day carries apart from the two
    // predicted flags is what the domain says about it, so nothing that reads
    // those fields can see the stripping at all.
    //
    // `isBeyondHorizon` is in the comparison rather than blanked out of it:
    // stripping the prediction must not move the horizon either, or the card
    // for a day in the far future would start disagreeing with itself.
    for (const day of buildCycleCalendarMonth(LATE, 2026, 10).days) {
      expect({ ...day, isPredictedPeriodDay: undefined }).toEqual({
        date: day.date,
        cycleDay: day.isBeyondHorizon ? null : getCycleDay(LATE, day.date),
        phase: day.cycleDay === null ? null : resolveCyclePhase(LATE.settings, day.cycleDay),
        fertilityLevel: day.fertilityLevel,
        isBeyondHorizon: day.isBeyondHorizon,
        isPredictedPeriodStart: day.isPredictedPeriodStart,
        isPredictedPeriodDay: undefined,
      });
    }
  });
});
