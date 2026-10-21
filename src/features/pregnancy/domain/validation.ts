import { calculateEstimatedDueDate, MAX_ADJUSTED_DUE_DATE_DAYS } from './due-date';
import type { PregnancyDueDateSource, PregnancyProfile } from './types';

import { daysBetween, isISODate } from '@/utils/date';
import { describeValue } from '@/shared/logging';

const DUE_DATE_SOURCES: readonly PregnancyDueDateSource[] = ['lmp', 'adjusted'];

function isDueDateSource(value: unknown): value is PregnancyDueDateSource {
  return DUE_DATE_SOURCES.includes(value as PregnancyDueDateSource);
}

/**
 * Checks a stored pregnancy, throwing on the first rule it breaks.
 *
 * What may be asked of the due date depends on where it came from. A date
 * counted from the LMP has to match `calculateEstimatedDueDate` exactly — it is
 * that formula's output, and anything else means the two have drifted apart. A
 * date someone measured is theirs to set, so it is only required to be a real
 * date that is not before the pregnancy began.
 *
 * The formula is never rewritten here; it is called, so this cannot drift away
 * from the rule it is checking.
 *
 * Pure: nothing is mutated and the profile is read exactly as given.
 */
export function validatePregnancyProfile(profile: PregnancyProfile): void {
  if (!isISODate(profile.lastMenstrualPeriodStartDate)) {
    throw new Error(
      `PregnancyProfile has an invalid lastMenstrualPeriodStartDate: ` +
        `"${profile.lastMenstrualPeriodStartDate}".`
    );
  }

  if (!isISODate(profile.estimatedDueDate)) {
    throw new Error(
      `PregnancyProfile has an invalid estimatedDueDate.`
    );
  }

  // Checked before the date rules rather than trusted from the type, because an
  // unknown source has no rules to apply and guessing one would be worse than
  // refusing.
  if (!isDueDateSource(profile.dueDateSource)) {
    throw new Error(
      `PregnancyProfile has an invalid dueDateSource: ` +
        `${describeValue(profile.dueDateSource)}. Expected "lmp" or "adjusted".`
    );
  }

  if (profile.dueDateSource === 'lmp') {
    const expected = calculateEstimatedDueDate(profile.lastMenstrualPeriodStartDate);

    if (profile.estimatedDueDate !== expected) {
      throw new Error(
        'PregnancyProfile has an estimatedDueDate that is not the one counted ' +
          'from the last menstrual period.'
      );
    }

    return;
  }

  if (daysBetween(profile.lastMenstrualPeriodStartDate, profile.estimatedDueDate) < 0) {
    throw new Error(
      'PregnancyProfile has an adjusted estimatedDueDate before the pregnancy began.'
    );
  }
}

/**
 * Refuses an adjusted due date that is further ahead than any pregnancy runs.
 *
 * ## Why this is not part of `validatePregnancyProfile`
 *
 * Because that one runs on the **read** path. `loadPregnancyProfile` puts every
 * stored row through it, and so does the sync merge. A new rule added there
 * would make an already-stored profile unloadable — it would lock somebody out
 * of their own pregnancy over a date they entered months ago and have been
 * living with since.
 *
 * `assertNoOverlappingPeriodRecords` in the cycle domain documents this exact
 * bargain and resolves it the same way: *"a rule that locked somebody out of
 * the history they already have would cost more than the corruption it
 * prevents, so the read path keeps accepting what the write path now refuses."*
 * This follows that, deliberately, rather than inventing a second answer.
 *
 * So: called from `updatePregnancyDueDate`, and from nowhere else. Reading stays
 * exactly as permissive as it was.
 *
 * One call site rather than two, because `startPregnancyTracking` only ever
 * writes `dueDateSource: 'lmp'` — it has nothing but the formula to go on at
 * that point. Calling this there would be a line that can never fire.
 *
 * `lmp` needs no check either way. Its due date has to *be*
 * `calculateEstimatedDueDate`'s output, which cannot be out of range, and
 * `validatePregnancyProfile` already refuses anything else claiming to be
 * calculated. The early return is for a caller that hands this a whole profile
 * without checking which kind it is.
 */
export function assertAdjustedDueDateInRange(profile: PregnancyProfile): void {
  if (profile.dueDateSource !== 'adjusted') {
    return;
  }

  const offset = daysBetween(
    profile.lastMenstrualPeriodStartDate,
    profile.estimatedDueDate
  );

  if (offset < 0 || offset > MAX_ADJUSTED_DUE_DATE_DAYS) {
    throw new Error(
      'PregnancyProfile has an adjusted estimatedDueDate more than ' +
        `${MAX_ADJUSTED_DUE_DATE_DAYS} days from the last menstrual period.`
    );
  }
}
