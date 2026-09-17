import type {
  CycleCalendarDay,
  CycleCalendarMonth,
} from '../application/build-cycle-calendar-month';

import { getISOWeekday } from '@/utils/date';

const DAYS_PER_WEEK = 7;

/**
 * Column headers, Monday first.
 *
 * A fixed tuple rather than anything locale-driven: `Intl` is unreliable on
 * Hermes, and the app is Turkish-only for now. When a second language arrives it
 * gets a real translation layer, not a lookup bolted on here.
 */
export const WEEKDAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const;

export type CalendarGridCell =
  | {
      readonly kind: 'empty';
    }
  | {
      readonly kind: 'day';
      readonly day: CycleCalendarDay;
    };

export type CycleCalendarGrid = {
  readonly year: number;
  /** 1-12. */
  readonly month: number;
  readonly weekdayLabels: typeof WEEKDAY_LABELS;
  /** Row-major, always a whole number of 7-cell rows. */
  readonly cells: readonly CalendarGridCell[];
  readonly rowCount: number;
};

/**
 * Lays a month out as whole weeks, Monday first.
 *
 * Purely positional. Nothing about a day is recomputed or reinterpreted — the
 * `CycleCalendarDay` objects are placed as they arrive, in their original order.
 *
 * Padding cells carry no date. Filling them with the neighbouring months' days
 * would mean this grid claims days it was not built from, and the caller can
 * already ask for those months directly.
 *
 * Row count follows from where the month starts and how long it is, so a month
 * occupies four, five or six rows rather than a fixed six.
 */
export function buildCycleCalendarGrid(month: CycleCalendarMonth): CycleCalendarGrid {
  // `buildCycleCalendarMonth` guarantees the rest of the shape; this is the one
  // invariant whose absence would make the grid meaningless rather than wrong.
  if (month.days.length === 0) {
    throw new Error('buildCycleCalendarGrid received a month with no days.');
  }

  if (!Number.isInteger(month.month) || month.month < 1 || month.month > 12) {
    throw new Error(
      `buildCycleCalendarGrid expects a month between 1 and 12, received ${month.month}.`
    );
  }

  const cells: CalendarGridCell[] = [];

  // Monday is 1, so a month starting on Tuesday leaves one column empty.
  const leadingEmptyCount = getISOWeekday(month.days[0].date) - 1;

  for (let index = 0; index < leadingEmptyCount; index += 1) {
    cells.push({ kind: 'empty' });
  }

  for (const day of month.days) {
    cells.push({ kind: 'day', day });
  }

  const trailingEmptyCount = (DAYS_PER_WEEK - (cells.length % DAYS_PER_WEEK)) % DAYS_PER_WEEK;

  for (let index = 0; index < trailingEmptyCount; index += 1) {
    cells.push({ kind: 'empty' });
  }

  return {
    year: month.year,
    month: month.month,
    weekdayLabels: WEEKDAY_LABELS,
    cells,
    rowCount: cells.length / DAYS_PER_WEEK,
  };
}
