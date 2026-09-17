import { getTodayLocalISODate } from '../today';

describe('getTodayLocalISODate', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns the local calendar date', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 17, 12, 0, 0));

    expect(getTodayLocalISODate()).toBe('2026-09-17');
  });

  it('zero-pads month and day', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 0, 5, 12, 0, 0));

    expect(getTodayLocalISODate()).toBe('2026-01-05');
  });

  it('does not slip a day just before midnight', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 17, 23, 59, 59));

    expect(getTodayLocalISODate()).toBe('2026-09-17');
  });

  it('does not slip a day just after midnight', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 17, 0, 0, 1));

    expect(getTodayLocalISODate()).toBe('2026-09-17');
  });

  it('handles a leap day', () => {
    jest.useFakeTimers().setSystemTime(new Date(2024, 1, 29, 9, 0, 0));

    expect(getTodayLocalISODate()).toBe('2024-02-29');
  });

  it('handles the last day of the year', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 11, 31, 22, 0, 0));

    expect(getTodayLocalISODate()).toBe('2026-12-31');
  });

  it('produces a value the date helpers accept', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 17, 12, 0, 0));
    const today = getTodayLocalISODate();

    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
