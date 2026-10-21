import { calculateEstimatedDueDate, MAX_ADJUSTED_DUE_DATE_DAYS } from '../due-date';
import type { PregnancyDueDateSource, PregnancyProfile } from '../types';
import { assertAdjustedDueDateInRange, validatePregnancyProfile } from '../validation';

import type { ISODate } from '@/types/iso-date';
import { addDays } from '@/utils/date';

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
      /not the one counted from the last menstrual period/
    );
  });

  it('refuses a date a day short of it', () => {
    expect(() => validatePregnancyProfile(fromLmp('2026-09-02', '2027-06-08'))).toThrow(
      /not the one counted from the last menstrual period/
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
      /before the pregnancy began/
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
      /invalid dueDateSource: text. Expected "lmp" or "adjusted"/
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

/**
 * How far ahead an entered due date may sit.
 *
 * ## Why this is a separate assertion and not part of the validator
 *
 * `validatePregnancyProfile` runs on the **read** path —
 * `loadPregnancyProfile` puts every stored row through it, and so does the sync
 * merge. A new rule there would make an already-stored profile unloadable, and
 * lock somebody out of a pregnancy over a date they entered months ago.
 *
 * `assertNoOverlappingPeriodRecords` in the cycle domain documents the same
 * bargain and settles it the same way. The last two cases here are the ones
 * that would fail if somebody ever moved this rule into the validator, which is
 * the mistake worth a test of its own.
 */
describe('an adjusted due date, on the way in', () => {
  const LMP = '2026-09-02';
  const atOffset = (days: number) =>
    adjusted(LMP, addDays(date(LMP), days) as unknown as string);

  it('accepts the day the pregnancy began', () => {
    expect(() => assertAdjustedDueDateInRange(atOffset(0))).not.toThrow();
  });

  it('accepts the counted due date, which is what a scan usually agrees with', () => {
    expect(() => assertAdjustedDueDateInRange(adjusted(LMP, calculateEstimatedDueDate(date(LMP))))).not.toThrow();
  });

  it('accepts the last day inside the bound', () => {
    expect(() => assertAdjustedDueDateInRange(atOffset(MAX_ADJUSTED_DUE_DATE_DAYS))).not.toThrow();
  });

  it('refuses a date before the pregnancy began', () => {
    expect(() => assertAdjustedDueDateInRange(atOffset(-1))).toThrow();
  });

  it('refuses the first day past the bound', () => {
    expect(() => assertAdjustedDueDateInRange(atOffset(MAX_ADJUSTED_DUE_DATE_DAYS + 1))).toThrow();
  });

  it('refuses a year that was plainly mistyped', () => {
    // The class of thing this exists for: nobody means a due date in 2031.
    expect(() => assertAdjustedDueDateInRange(adjusted(LMP, '2031-06-09'))).toThrow();
  });

  it('says nothing about a calculated date, which has no room to be wrong', () => {
    // Its due date has to *be* the formula's output, which the validator
    // already enforces, so there is nothing left for this to check.
    expect(() => assertAdjustedDueDateInRange(fromLmp(LMP))).not.toThrow();
  });
});

describe('a stored profile outside the bound', () => {
  it('still loads, because the read path refuses nothing new', () => {
    // Somebody entered this before the rule existed. Refusing it now would
    // lock them out of their own pregnancy, which costs more than the bad date.
    const stored = adjusted('2026-09-02', '2031-06-09');

    expect(() => validatePregnancyProfile(stored)).not.toThrow();
  });

  it('is only refused when it is being written again', () => {
    const stored = adjusted('2026-09-02', '2031-06-09');

    expect(() => validatePregnancyProfile(stored)).not.toThrow();
    expect(() => assertAdjustedDueDateInRange(stored)).toThrow();
  });
});
