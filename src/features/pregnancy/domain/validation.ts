import { calculateEstimatedDueDate } from './due-date';
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
