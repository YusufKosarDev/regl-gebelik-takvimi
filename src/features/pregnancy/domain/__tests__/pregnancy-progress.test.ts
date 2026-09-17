import { getPregnancyDay, getPregnancyWeek } from '../pregnancy-progress';

import type { ISODate } from '@/types/iso-date';
import { addDays } from '@/utils/date';

const date = (value: string) => value as ISODate;

const LMP = date('2026-09-02');

describe('getPregnancyDay', () => {
  it('counts the LMP itself as day 1', () => {
    expect(getPregnancyDay(LMP, LMP)).toBe(1);
  });

  it('counts the day after as day 2', () => {
    expect(getPregnancyDay(LMP, date('2026-09-03'))).toBe(2);
  });

  it('counts a week on as day 8', () => {
    expect(getPregnancyDay(LMP, date('2026-09-09'))).toBe(8);
  });

  it('counts across a month end', () => {
    // 2 September plus 28 days is 30 September, which is day 29.
    expect(getPregnancyDay(LMP, date('2026-09-30'))).toBe(29);
  });

  it('counts across a year end', () => {
    expect(getPregnancyDay(date('2026-12-30'), date('2027-01-02'))).toBe(4);
  });

  it('counts across a leap day', () => {
    expect(getPregnancyDay(date('2028-02-27'), date('2028-03-01'))).toBe(4);
  });

  it('counts every day of a full gestation', () => {
    expect(getPregnancyDay(LMP, addDays(LMP, 279))).toBe(280);
  });
});

describe('getPregnancyDay before the pregnancy started', () => {
  it('returns null for the day before the LMP', () => {
    expect(getPregnancyDay(LMP, date('2026-09-01'))).toBeNull();
  });

  it('returns null for a date well before it', () => {
    expect(getPregnancyDay(LMP, date('2025-01-01'))).toBeNull();
  });

  it('returns null rather than counting backwards', () => {
    expect(getPregnancyDay(LMP, date('2026-08-26'))).toBeNull();
  });
});

describe('getPregnancyDay with an unusable date', () => {
  it('refuses an LMP that does not exist', () => {
    expect(() => getPregnancyDay(date('2026-02-30'), LMP)).toThrow(
      /invalid lastMenstrualPeriodStartDate/
    );
  });

  it('refuses a target date that does not exist', () => {
    expect(() => getPregnancyDay(LMP, date('2026-13-01'))).toThrow(/invalid targetDate/);
  });

  it('refuses something that is not a date at all', () => {
    expect(() => getPregnancyDay(LMP, date('bugün'))).toThrow(/invalid targetDate/);
  });
});

describe('getPregnancyWeek', () => {
  it('reads the LMP as week 1 day 1', () => {
    expect(getPregnancyWeek(LMP, LMP)).toEqual({ week: 1, day: 1 });
  });

  it('reads day 7 as week 1 day 7', () => {
    expect(getPregnancyWeek(LMP, addDays(LMP, 6))).toEqual({ week: 1, day: 7 });
  });

  it('reads day 8 as week 2 day 1', () => {
    expect(getPregnancyWeek(LMP, addDays(LMP, 7))).toEqual({ week: 2, day: 1 });
  });

  it('reads day 14 as week 2 day 7', () => {
    expect(getPregnancyWeek(LMP, addDays(LMP, 13))).toEqual({ week: 2, day: 7 });
  });

  it('reads day 15 as week 3 day 1', () => {
    expect(getPregnancyWeek(LMP, addDays(LMP, 14))).toEqual({ week: 3, day: 1 });
  });

  it('reads a date well into the pregnancy', () => {
    // Day 200: 199 whole days after the LMP.
    expect(getPregnancyWeek(LMP, addDays(LMP, 199))).toEqual({ week: 29, day: 4 });
  });

  it('reads the last day of a 280-day gestation as week 40 day 7', () => {
    expect(getPregnancyWeek(LMP, addDays(LMP, 279))).toEqual({ week: 40, day: 7 });
  });

  it('keeps every week seven days long', () => {
    const days: number[] = [];

    for (let offset = 0; offset < 70; offset += 1) {
      const progress = getPregnancyWeek(LMP, addDays(LMP, offset));

      expect(progress).not.toBeNull();
      days.push((progress as { week: number; day: number }).day);
    }

    expect(days.slice(0, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(days.slice(7, 14)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('never disagrees with the day count it is built on', () => {
    for (let offset = 0; offset < 300; offset += 1) {
      const target = addDays(LMP, offset);
      const progress = getPregnancyWeek(LMP, target);
      const day = getPregnancyDay(LMP, target);

      expect(progress).not.toBeNull();

      const { week, day: dayOfWeek } = progress as { week: number; day: number };

      expect((week - 1) * 7 + dayOfWeek).toBe(day);
    }
  });
});

describe('getPregnancyWeek before the pregnancy started', () => {
  it('returns null for the day before the LMP', () => {
    expect(getPregnancyWeek(LMP, date('2026-09-01'))).toBeNull();
  });

  it('returns null rather than a week 0', () => {
    expect(getPregnancyWeek(LMP, date('2026-08-01'))).toBeNull();
  });
});

describe('getPregnancyWeek with an unusable date', () => {
  it('refuses an LMP that does not exist', () => {
    expect(() => getPregnancyWeek(date('2026-02-30'), LMP)).toThrow(
      /invalid lastMenstrualPeriodStartDate/
    );
  });

  it('refuses a target date that does not exist', () => {
    expect(() => getPregnancyWeek(LMP, date('2026-04-31'))).toThrow(/invalid targetDate/);
  });
});

describe('pregnancy progress purity', () => {
  it('leaves the dates it was given alone', () => {
    const input = { lmp: LMP, target: date('2026-10-01') };
    const before = JSON.stringify(input);

    getPregnancyDay(input.lmp, input.target);
    getPregnancyWeek(input.lmp, input.target);

    expect(JSON.stringify(input)).toBe(before);
  });

  it('returns a fresh object each time rather than a shared one', () => {
    const first = getPregnancyWeek(LMP, LMP);
    const second = getPregnancyWeek(LMP, LMP);

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });

  it('reads the same answer every time', () => {
    expect(getPregnancyDay(LMP, date('2026-10-01'))).toBe(
      getPregnancyDay(LMP, date('2026-10-01'))
    );
  });
});
