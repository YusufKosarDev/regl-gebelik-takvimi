import { calculateEstimatedDueDate } from '../due-date';

import type { ISODate } from '@/types/iso-date';
import { daysBetween } from '@/utils/date';

const lmp = (value: string) => value as ISODate;

describe('calculateEstimatedDueDate', () => {
  it('lands 280 days after the last menstrual period', () => {
    expect(daysBetween(lmp('2026-09-02'), calculateEstimatedDueDate(lmp('2026-09-02')))).toBe(280);
  });

  it('is 280 days out wherever it starts', () => {
    for (const start of ['2026-01-01', '2026-02-28', '2026-06-15', '2026-12-31']) {
      expect(daysBetween(lmp(start), calculateEstimatedDueDate(lmp(start)))).toBe(280);
    }
  });

  it('gives the expected date for an ordinary start', () => {
    // 280 days is over nine months, so the due date is in the following year.
    expect(calculateEstimatedDueDate(lmp('2026-09-02'))).toBe('2027-06-09');
  });
});

describe('calculateEstimatedDueDate across a leap year', () => {
  it('counts 29 February as a day', () => {
    expect(calculateEstimatedDueDate(lmp('2028-01-01'))).toBe('2028-10-07');
  });

  it('lands a day later from the same start in a common year', () => {
    // The only difference between the two is the leap day inside the span.
    expect(calculateEstimatedDueDate(lmp('2027-01-01'))).toBe('2027-10-08');
  });

  it('handles a start just before the leap day', () => {
    expect(calculateEstimatedDueDate(lmp('2028-02-20'))).toBe('2028-11-26');
  });

  it('handles a start on the leap day itself', () => {
    expect(calculateEstimatedDueDate(lmp('2028-02-29'))).toBe('2028-12-05');
  });
});

describe('calculateEstimatedDueDate across a year end', () => {
  it('rolls into the next year', () => {
    expect(calculateEstimatedDueDate(lmp('2026-06-01'))).toBe('2027-03-08');
  });

  it('rolls over from the last week of December', () => {
    expect(calculateEstimatedDueDate(lmp('2026-12-25'))).toBe('2027-10-01');
  });

  it('rolls over from New Year’s Eve', () => {
    expect(calculateEstimatedDueDate(lmp('2026-12-31'))).toBe('2027-10-07');
  });
});

describe('calculateEstimatedDueDate with an unusable date', () => {
  it('refuses a date that does not exist', () => {
    expect(() => calculateEstimatedDueDate(lmp('2026-02-30'))).toThrow(
      /invalid lastMenstrualPeriodStartDate/
    );
  });

  it('refuses a month out of range', () => {
    expect(() => calculateEstimatedDueDate(lmp('2026-13-01'))).toThrow(
      /invalid lastMenstrualPeriodStartDate/
    );
  });

  it('refuses something that is not a date at all', () => {
    expect(() => calculateEstimatedDueDate(lmp('dün'))).toThrow(
      /invalid lastMenstrualPeriodStartDate/
    );
  });

  it('refuses an empty string', () => {
    expect(() => calculateEstimatedDueDate(lmp(''))).toThrow(
      /invalid lastMenstrualPeriodStartDate/
    );
  });
});

describe('calculateEstimatedDueDate purity', () => {
  it('reads the same answer every time', () => {
    expect(calculateEstimatedDueDate(lmp('2026-09-02'))).toBe(
      calculateEstimatedDueDate(lmp('2026-09-02'))
    );
  });

  it('leaves what it was given alone', () => {
    const input = { lastMenstrualPeriodStartDate: lmp('2026-09-02') };
    const before = JSON.stringify(input);

    calculateEstimatedDueDate(input.lastMenstrualPeriodStartDate);

    expect(JSON.stringify(input)).toBe(before);
  });
});
