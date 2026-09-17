import { calculateEstimatedDueDate } from '../due-date';
import type { PregnancyDueDateSource, PregnancyProfile } from '../types';
import { validatePregnancyProfile } from '../validation';

import type { ISODate } from '@/types/iso-date';

const date = (value: string) => value as ISODate;

/** A due date counted from the LMP, which is what the formula gives. */
function fromLmp(lmp: string, dueDate?: string): PregnancyProfile {
  return {
    lastMenstrualPeriodStartDate: date(lmp),
    estimatedDueDate:
      dueDate === undefined ? calculateEstimatedDueDate(date(lmp)) : date(dueDate),
    dueDateSource: 'lmp',
  };
}

/** A due date someone measured and replaced the calculated one with. */
function adjusted(lmp: string, dueDate: string): PregnancyProfile {
  return {
    lastMenstrualPeriodStartDate: date(lmp),
    estimatedDueDate: date(dueDate),
    dueDateSource: 'adjusted',
  };
}

describe('validatePregnancyProfile with a due date counted from the LMP', () => {
  it('accepts the date the formula gives', () => {
    expect(() => validatePregnancyProfile(fromLmp('2026-09-02'))).not.toThrow();
  });

  it('accepts one that crosses a leap day', () => {
    expect(() => validatePregnancyProfile(fromLmp('2028-02-20'))).not.toThrow();
  });

  it('refuses a date a day off the formula', () => {
    expect(() => validatePregnancyProfile(fromLmp('2026-09-02', '2027-06-10'))).toThrow(
      /but 2026-09-02 gives 2027-06-09/
    );
  });

  it('refuses a date a day short of it', () => {
    expect(() => validatePregnancyProfile(fromLmp('2026-09-02', '2027-06-08'))).toThrow(
      /but 2026-09-02 gives 2027-06-09/
    );
  });

  it('refuses a date that is nowhere near it', () => {
    expect(() => validatePregnancyProfile(fromLmp('2026-09-02', '2027-01-01'))).toThrow(
      /counted from the last menstrual period/
    );
  });

  it('refuses a date before the last menstrual period', () => {
    expect(() => validatePregnancyProfile(fromLmp('2026-09-02', '2026-08-01'))).toThrow(
      /counted from the last menstrual period/
    );
  });
});

describe('validatePregnancyProfile with an adjusted due date', () => {
  it('accepts a date the formula would not have given', () => {
    // A dating scan put this pregnancy five days ahead of the LMP estimate.
    expect(() => validatePregnancyProfile(adjusted('2026-09-02', '2027-06-04'))).not.toThrow();
  });

  it('accepts one behind the calculated date too', () => {
    expect(() => validatePregnancyProfile(adjusted('2026-09-02', '2027-06-16'))).not.toThrow();
  });

  it('accepts one that happens to match the formula', () => {
    // A scan can land on exactly the calculated day; it is still a measured
    // date, and the source is what says so.
    expect(() => validatePregnancyProfile(adjusted('2026-09-02', '2027-06-09'))).not.toThrow();
  });

  it('accepts one far from the calculated date', () => {
    expect(() => validatePregnancyProfile(adjusted('2026-09-02', '2027-12-01'))).not.toThrow();
  });

  it('refuses a date before the last menstrual period', () => {
    expect(() => validatePregnancyProfile(adjusted('2026-09-02', '2026-09-01'))).toThrow(
      /before the pregnancy began on 2026-09-02/
    );
  });

  it('refuses a date well before it', () => {
    expect(() => validatePregnancyProfile(adjusted('2026-09-02', '2025-06-09'))).toThrow(
      /before the pregnancy began/
    );
  });

  it('refuses an invalid date', () => {
    expect(() => validatePregnancyProfile(adjusted('2026-09-02', '2027-13-09'))).toThrow(
      /invalid estimatedDueDate/
    );
  });
});

describe('validatePregnancyProfile with an unusable date', () => {
  it('refuses an invalid last menstrual period date', () => {
    expect(() =>
      validatePregnancyProfile({
        lastMenstrualPeriodStartDate: date('2026-02-30'),
        estimatedDueDate: date('2027-06-09'),
        dueDateSource: 'lmp',
      })
    ).toThrow(/invalid lastMenstrualPeriodStartDate/);
  });

  it('refuses an invalid due date', () => {
    expect(() => validatePregnancyProfile(fromLmp('2026-09-02', '2027-13-09'))).toThrow(
      /invalid estimatedDueDate/
    );
  });
});

describe('validatePregnancyProfile with an unusable source', () => {
  function withSource(source: unknown): PregnancyProfile {
    return {
      lastMenstrualPeriodStartDate: date('2026-09-02'),
      estimatedDueDate: date('2027-06-09'),
      dueDateSource: source as PregnancyDueDateSource,
    };
  }

  it('refuses a source it does not know', () => {
    expect(() => validatePregnancyProfile(withSource('scan'))).toThrow(
      /invalid dueDateSource: "scan". Expected "lmp" or "adjusted"/
    );
  });

  it('refuses a missing source', () => {
    expect(() => validatePregnancyProfile(withSource(undefined))).toThrow(
      /invalid dueDateSource/
    );
  });

  it('refuses null', () => {
    expect(() => validatePregnancyProfile(withSource(null))).toThrow(/invalid dueDateSource/);
  });

  it('refuses a value of the wrong type', () => {
    for (const source of [1, true, {}, ['lmp']]) {
      expect(() => validatePregnancyProfile(withSource(source))).toThrow(
        /invalid dueDateSource/
      );
    }
  });

  it('refuses a source with the wrong casing', () => {
    expect(() => validatePregnancyProfile(withSource('LMP'))).toThrow(/invalid dueDateSource/);
  });

  it('refuses an unknown source even when the date matches the formula', () => {
    // The date being right is not a reason to guess what the source meant.
    expect(() => validatePregnancyProfile(withSource('calculated'))).toThrow(
      /invalid dueDateSource/
    );
  });
});

describe('validatePregnancyProfile purity', () => {
  it('leaves a calculated profile as it found it', () => {
    const stored = fromLmp('2026-09-02');
    const before = JSON.stringify(stored);

    validatePregnancyProfile(stored);

    expect(JSON.stringify(stored)).toBe(before);
  });

  it('leaves an adjusted profile as it found it', () => {
    const stored = adjusted('2026-09-02', '2027-06-04');
    const before = JSON.stringify(stored);

    validatePregnancyProfile(stored);

    expect(JSON.stringify(stored)).toBe(before);
  });

  it('leaves the profile alone even when it rejects the date', () => {
    const stored = fromLmp('2026-09-02', '2027-06-10');
    const before = JSON.stringify(stored);

    expect(() => validatePregnancyProfile(stored)).toThrow();

    expect(JSON.stringify(stored)).toBe(before);
  });

  it('leaves the profile alone even when it rejects the source', () => {
    const stored = {
      lastMenstrualPeriodStartDate: date('2026-09-02'),
      estimatedDueDate: date('2027-06-09'),
      dueDateSource: 'scan' as PregnancyDueDateSource,
    };
    const before = JSON.stringify(stored);

    expect(() => validatePregnancyProfile(stored)).toThrow();

    expect(JSON.stringify(stored)).toBe(before);
  });
});
