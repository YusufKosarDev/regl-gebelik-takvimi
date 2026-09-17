import { buildCycleCalendarGrid, WEEKDAY_LABELS } from '../build-cycle-calendar-grid';

import { buildCycleCalendarMonth } from '@/features/cycle/application/build-cycle-calendar-month';
import type {
  CycleCalendarDay,
  CycleCalendarMonth,
} from '@/features/cycle/application/build-cycle-calendar-month';
import type { CycleProfile } from '@/features/cycle/domain/types';
import type { ISODate } from '@/types/iso-date';
import { getDaysInMonth, getISOWeekday, toISODate } from '@/utils/date';

/** Cycle 28, period 5 -> ovulation on day 14, fertile window days 9-15. */
const profile: CycleProfile = {
  settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
  periodRecords: [{ id: 'record-0', startDate: '2026-09-01' as ISODate }],
};

function gridFor(year: number, month: number) {
  return buildCycleCalendarGrid(buildCycleCalendarMonth(profile, year, month));
}

function leadingEmptyCount(cells: readonly { kind: string }[]): number {
  return cells.findIndex((cell) => cell.kind === 'day');
}

function trailingEmptyCount(cells: readonly { kind: string }[]): number {
  let count = 0;

  for (let index = cells.length - 1; index >= 0 && cells[index].kind === 'empty'; index -= 1) {
    count += 1;
  }

  return count;
}

function dayCells(cells: readonly { kind: string }[]): CycleCalendarDay[] {
  return cells
    .filter((cell): cell is { kind: 'day'; day: CycleCalendarDay } => cell.kind === 'day')
    .map((cell) => cell.day);
}

describe('weekday labels', () => {
  it('runs Monday to Sunday in Turkish', () => {
    expect(WEEKDAY_LABELS).toEqual(['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']);
  });

  it('exposes the same tuple on every grid', () => {
    expect(gridFor(2026, 9).weekdayLabels).toEqual([
      'Pzt',
      'Sal',
      'Çar',
      'Per',
      'Cum',
      'Cmt',
      'Paz',
    ]);
  });

  it('has exactly seven columns', () => {
    expect(WEEKDAY_LABELS).toHaveLength(7);
  });
});

describe('buildCycleCalendarGrid identity', () => {
  it('carries the year and month through', () => {
    const grid = gridFor(2026, 9);

    expect(grid.year).toBe(2026);
    expect(grid.month).toBe(9);
  });
});

describe('buildCycleCalendarGrid leading empty cells', () => {
  it('leaves one column empty for a Tuesday start', () => {
    // 2026-09-01 is a Tuesday.
    expect(getISOWeekday(toISODate('2026-09-01'))).toBe(2);
    expect(leadingEmptyCount(gridFor(2026, 9).cells)).toBe(1);
  });

  it('leaves nothing empty for a Monday start', () => {
    // 2026-06-01 is a Monday.
    expect(getISOWeekday(toISODate('2026-06-01'))).toBe(1);
    expect(leadingEmptyCount(gridFor(2026, 6).cells)).toBe(0);
    expect(gridFor(2026, 6).cells[0]).toEqual({ kind: 'day', day: expect.anything() });
  });

  it('leaves six columns empty for a Sunday start', () => {
    // 2026-02-01 is a Sunday.
    expect(getISOWeekday(toISODate('2026-02-01'))).toBe(7);
    expect(leadingEmptyCount(gridFor(2026, 2).cells)).toBe(6);
  });

  it('always matches the first day weekday', () => {
    for (let month = 1; month <= 12; month += 1) {
      const grid = gridFor(2026, month);
      const firstDate = dayCells(grid.cells)[0].date;

      expect(leadingEmptyCount(grid.cells)).toBe(getISOWeekday(firstDate) - 1);
    }
  });

  it('places the first day in the column its weekday names', () => {
    for (let month = 1; month <= 12; month += 1) {
      const grid = gridFor(2026, month);
      const firstDayIndex = grid.cells.findIndex((cell) => cell.kind === 'day');
      const firstDate = dayCells(grid.cells)[0].date;

      expect(firstDayIndex % 7).toBe(getISOWeekday(firstDate) - 1);
    }
  });
});

describe('buildCycleCalendarGrid trailing empty cells', () => {
  it.each<[number, number, number]>([
    [2026, 2, 28],
    [2026, 6, 30],
    [2026, 1, 31],
  ])('completes the last row for %i-%i (%i days)', (year, month) => {
    const grid = gridFor(year, month);

    expect(grid.cells.length % 7).toBe(0);
  });

  it('completes the last row for every month of 2026', () => {
    for (let month = 1; month <= 12; month += 1) {
      expect(gridFor(2026, month).cells.length % 7).toBe(0);
    }
  });

  it('adds no trailing cells when the month already fills its last row', () => {
    // 2026-02-01 is a Sunday: 6 leading + 28 days = 34, so one trailing cell.
    const grid = gridFor(2026, 2);

    expect(trailingEmptyCount(grid.cells)).toBe(1);
  });

  it('pads at most six cells', () => {
    for (let month = 1; month <= 12; month += 1) {
      expect(trailingEmptyCount(gridFor(2026, month).cells)).toBeLessThanOrEqual(6);
    }
  });
});

describe('buildCycleCalendarGrid row count', () => {
  it('gives February 2026 five rows', () => {
    const grid = gridFor(2026, 2);

    expect(leadingEmptyCount(grid.cells)).toBe(6);
    expect(grid.cells).toHaveLength(35);
    expect(grid.rowCount).toBe(5);
  });

  it('gives June 2026 five rows', () => {
    const grid = gridFor(2026, 6);

    expect(leadingEmptyCount(grid.cells)).toBe(0);
    expect(grid.cells).toHaveLength(35);
    expect(grid.rowCount).toBe(5);
  });

  it('gives August 2026 six rows', () => {
    // 2026-08-01 is a Saturday: 5 leading + 31 days = 36, padded to 42.
    const grid = gridFor(2026, 8);

    expect(getISOWeekday(toISODate('2026-08-01'))).toBe(6);
    expect(leadingEmptyCount(grid.cells)).toBe(5);
    expect(grid.cells).toHaveLength(42);
    expect(grid.rowCount).toBe(6);
  });

  it('gives February 2027 four rows', () => {
    // 2027-02-01 is a Monday and February 2027 has 28 days: exactly four weeks.
    const grid = gridFor(2027, 2);

    expect(getISOWeekday(toISODate('2027-02-01'))).toBe(1);
    expect(grid.cells).toHaveLength(28);
    expect(grid.rowCount).toBe(4);
    expect(trailingEmptyCount(grid.cells)).toBe(0);
  });

  it('never fixes the height at six rows', () => {
    const rowCounts = new Set<number>();

    for (let month = 1; month <= 12; month += 1) {
      rowCounts.add(gridFor(2026, month).rowCount);
    }

    expect(rowCounts.size).toBeGreaterThan(1);
  });

  it('stays between four and six rows across several years', () => {
    for (let year = 2024; year <= 2030; year += 1) {
      for (let month = 1; month <= 12; month += 1) {
        const grid = gridFor(year, month);

        expect(grid.rowCount).toBeGreaterThanOrEqual(4);
        expect(grid.rowCount).toBeLessThanOrEqual(6);
        expect(Number.isInteger(grid.rowCount)).toBe(true);
      }
    }
  });

  it('derives the row count from the cells rather than a constant', () => {
    for (let month = 1; month <= 12; month += 1) {
      const grid = gridFor(2026, month);

      expect(grid.rowCount).toBe(grid.cells.length / 7);
    }
  });
});

describe('buildCycleCalendarGrid day preservation', () => {
  it('holds every day of the month and no more', () => {
    const month = buildCycleCalendarMonth(profile, 2026, 9);
    const grid = buildCycleCalendarGrid(month);

    expect(dayCells(grid.cells)).toHaveLength(getDaysInMonth(2026, 9));
  });

  it('keeps the original order', () => {
    const month = buildCycleCalendarMonth(profile, 2026, 9);
    const grid = buildCycleCalendarGrid(month);

    expect(dayCells(grid.cells).map((day) => day.date)).toEqual(
      month.days.map((day) => day.date)
    );
  });

  it('keeps every field untouched', () => {
    const month = buildCycleCalendarMonth(profile, 2026, 9);
    const grid = buildCycleCalendarGrid(month);
    const placed = dayCells(grid.cells);

    month.days.forEach((day, index) => {
      expect(placed[index].date).toBe(day.date);
      expect(placed[index].cycleDay).toBe(day.cycleDay);
      expect(placed[index].phase).toBe(day.phase);
      expect(placed[index].fertilityLevel).toBe(day.fertilityLevel);
      expect(placed[index].isPredictedPeriodStart).toBe(day.isPredictedPeriodStart);
    });
  });

  it('passes the same day objects through', () => {
    const month = buildCycleCalendarMonth(profile, 2026, 9);
    const grid = buildCycleCalendarGrid(month);

    dayCells(grid.cells).forEach((day, index) => {
      expect(day).toBe(month.days[index]);
    });
  });
});

describe('buildCycleCalendarGrid empty cells', () => {
  it('carries no data at all', () => {
    const grid = gridFor(2026, 2);

    for (const cell of grid.cells) {
      if (cell.kind === 'empty') {
        expect(cell).toEqual({ kind: 'empty' });
        expect(Object.keys(cell)).toEqual(['kind']);
      }
    }
  });

  it('never holds a neighbouring month date', () => {
    const grid = gridFor(2026, 9);

    for (const cell of grid.cells) {
      if (cell.kind === 'day') {
        expect(cell.day.date.startsWith('2026-09-')).toBe(true);
      }
    }
  });

  it('puts empty cells only at the two ends', () => {
    for (let month = 1; month <= 12; month += 1) {
      const kinds = gridFor(2026, month).cells.map((cell) => cell.kind);
      const firstDay = kinds.indexOf('day');
      const lastDay = kinds.lastIndexOf('day');

      expect(kinds.slice(firstDay, lastDay + 1).every((kind) => kind === 'day')).toBe(true);
    }
  });
});

describe('buildCycleCalendarGrid purity', () => {
  it('does not mutate the month', () => {
    const month = buildCycleCalendarMonth(profile, 2026, 9);
    const snapshot = JSON.parse(JSON.stringify(month));

    buildCycleCalendarGrid(month);

    expect(month).toEqual(snapshot);
  });

  it('does not reorder the month days', () => {
    const month = buildCycleCalendarMonth(profile, 2026, 9);
    const before = month.days.map((day) => day.date);

    buildCycleCalendarGrid(month);

    expect(month.days.map((day) => day.date)).toEqual(before);
  });

  it('returns the same grid when called twice', () => {
    const month = buildCycleCalendarMonth(profile, 2026, 9);

    expect(buildCycleCalendarGrid(month)).toEqual(buildCycleCalendarGrid(month));
  });
});

describe('buildCycleCalendarGrid invariants', () => {
  it('rejects a month with no days', () => {
    const empty: CycleCalendarMonth = { year: 2026, month: 9, days: [] };

    expect(() => buildCycleCalendarGrid(empty)).toThrow(/no days/);
  });

  it('rejects a month number outside 1-12', () => {
    const month = buildCycleCalendarMonth(profile, 2026, 9);

    expect(() => buildCycleCalendarGrid({ ...month, month: 13 })).toThrow(
      /month between 1 and 12/
    );
    expect(() => buildCycleCalendarGrid({ ...month, month: 0 })).toThrow(/month between 1 and 12/);
  });
});
