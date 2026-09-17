import { calculateEstimatedDueDate } from '../due-date';
import type { PregnancyProfile } from '../types';
import { validatePregnancyProfile } from '../validation';

import type { ISODate } from '@/types/iso-date';

const date = (value: string) => value as ISODate;

function profile(lmp: string, dueDate?: string): PregnancyProfile {
  return {
    lastMenstrualPeriodStartDate: date(lmp),
    estimatedDueDate:
      dueDate === undefined ? calculateEstimatedDueDate(date(lmp)) : date(dueDate),
  };
}

describe('validatePregnancyProfile', () => {
  it('accepts a due date that matches the formula', () => {
    expect(() => validatePregnancyProfile(profile('2026-09-02'))).not.toThrow();
  });

  it('accepts one that crosses a leap day', () => {
    expect(() => validatePregnancyProfile(profile('2028-02-20'))).not.toThrow();
  });

  it('refuses an invalid last menstrual period date', () => {
    expect(() =>
      validatePregnancyProfile({
        lastMenstrualPeriodStartDate: date('2026-02-30'),
        estimatedDueDate: date('2027-06-09'),
      })
    ).toThrow(/invalid lastMenstrualPeriodStartDate/);
  });

  it('refuses an invalid due date', () => {
    expect(() => validatePregnancyProfile(profile('2026-09-02', '2027-13-09'))).toThrow(
      /invalid estimatedDueDate/
    );
  });

  it('refuses a due date a day off the formula', () => {
    expect(() => validatePregnancyProfile(profile('2026-09-02', '2027-06-10'))).toThrow(
      /but 2026-09-02 gives 2027-06-09/
    );
  });

  it('refuses a due date before the last menstrual period', () => {
    expect(() => validatePregnancyProfile(profile('2026-09-02', '2026-08-01'))).toThrow(
      /estimatedDueDate/
    );
  });
});

describe('validatePregnancyProfile purity', () => {
  it('leaves the profile as it found it', () => {
    const stored = profile('2026-09-02');
    const before = JSON.stringify(stored);

    validatePregnancyProfile(stored);

    expect(JSON.stringify(stored)).toBe(before);
  });

  it('leaves the profile alone even when it rejects it', () => {
    const stored = profile('2026-09-02', '2027-06-10');
    const before = JSON.stringify(stored);

    expect(() => validatePregnancyProfile(stored)).toThrow();

    expect(JSON.stringify(stored)).toBe(before);
  });
});
