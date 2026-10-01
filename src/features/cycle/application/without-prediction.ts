import type { CycleCalendarGrid } from '../presentation/build-cycle-calendar-grid';

/**
 * The same month with nothing marked as a predicted period start.
 *
 * ## Why the grid is changed rather than the calendar being told not to draw
 *
 * A predicted day shows up in three places: the marker in the calendar square,
 * the accessibility label the square announces, and the detail panel under the
 * calendar when that day is selected. A `showsPrediction` flag would have to
 * reach all three and be honoured identically by each, and the one that got it
 * wrong would be the accessibility label - the half nobody looks at.
 *
 * Taking the flag off the data instead means there is nothing to honour. The
 * marker, the label and the panel all read `isPredictedPeriodStart`, and all
 * three see the same answer because there is only one answer.
 *
 * ## Why it is not in `buildCycleCalendarMonth`
 *
 * That function is clock-free on purpose - it lays out any month from a profile
 * and nothing else, which is what makes it cheap to call for a year of months
 * at a time. Whether a prediction is too old to show is a question about today,
 * so it belongs to whoever knows what today is.
 */
export function withoutPrediction(grid: CycleCalendarGrid): CycleCalendarGrid {
  return {
    ...grid,
    cells: grid.cells.map((cell) =>
      cell.kind === 'day' && cell.day.isPredictedPeriodStart
        ? { kind: 'day', day: { ...cell.day, isPredictedPeriodStart: false } }
        : cell
    ),
  };
}
