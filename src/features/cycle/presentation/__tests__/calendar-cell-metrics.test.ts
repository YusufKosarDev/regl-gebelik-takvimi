import { calendarCellSidePadding } from '../calendar-cell-metrics';

import { Spacing } from '@/constants/theme';

/**
 * The air between squares, which is what buys the word its width.
 *
 * The numbers matter at both ends: the default setting must be exactly what it
 * always was, and the largest must give everything there is to give.
 */
describe('calendarCellSidePadding', () => {
  it('leaves the default setting exactly as it was', () => {
    expect(calendarCellSidePadding(1)).toBe(Spacing.half);
  });

  it('gives all of it up at the top of the range', () => {
    expect(calendarCellSidePadding(2)).toBe(0);
  });

  it('falls away in between rather than switching off at a threshold', () => {
    expect(calendarCellSidePadding(1.5)).toBe(Spacing.half / 2);
    expect(calendarCellSidePadding(1.25)).toBe(Spacing.half * 0.75);
    expect(calendarCellSidePadding(1.75)).toBe(Spacing.half * 0.25);
  });

  it('never goes negative, whatever the device reports', () => {
    expect(calendarCellSidePadding(2.5)).toBe(0);
    expect(calendarCellSidePadding(10)).toBe(0);
  });

  it('never exceeds the default, whatever the device reports', () => {
    expect(calendarCellSidePadding(0.85)).toBe(Spacing.half);
    expect(calendarCellSidePadding(0)).toBe(Spacing.half);
  });
});
