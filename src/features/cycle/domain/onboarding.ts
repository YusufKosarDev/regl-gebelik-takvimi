import type { CycleProfile } from './types';
import { validateCycleSettings } from './validation';

import type { ISODate } from '@/types/iso-date';
import { isISODate } from '@/utils/date';

/**
 * The minimum the user has to supply before the cycle engine can produce
 * anything.
 *
 * Deliberately just three fields: everything else an onboarding flow might ask
 * for — name, age, symptoms, contraception, pregnancy intent, notifications,
 * avatar, account, consent — belongs to later steps and is not needed to
 * calculate a cycle.
 */
export type CycleOnboardingInput = {
  readonly lastPeriodStartDate: ISODate;
  readonly averageCycleLengthDays: number;
  readonly averagePeriodLengthDays: number;
};

/**
 * Id of the single period record seeded from onboarding.
 *
 * A fixed string rather than a generated one, so the factory stays pure and the
 * same input always produces the same profile.
 */
const INITIAL_PERIOD_RECORD_ID = 'onboarding-initial-period';

/**
 * Checks onboarding input, throwing on the first rule it breaks.
 *
 * The cycle and period length rules are not restated here: they are delegated to
 * `validateCycleSettings`, so the limits cannot drift apart from the rest of the
 * domain.
 *
 * Pure: nothing is mutated, no clock is read and no `Date` is constructed.
 */
export function validateCycleOnboardingInput(input: CycleOnboardingInput): void {
  if (!isISODate(input.lastPeriodStartDate)) {
    throw new Error(
      `Invalid lastPeriodStartDate: "${input.lastPeriodStartDate}". ` +
        'Expected a real calendar date in YYYY-MM-DD format.'
    );
  }

  validateCycleSettings({
    averageCycleLengthDays: input.averageCycleLengthDays,
    averagePeriodLengthDays: input.averagePeriodLengthDays,
  });
}

/**
 * Builds the first `CycleProfile` from onboarding input.
 *
 * The result holds exactly one period record, seeded from the reported last
 * period start with no end date, and always satisfies `validateCycleProfile`.
 *
 * Pure and deterministic: the same input yields an equal profile every time, and
 * the input object is never mutated.
 */
export function createInitialCycleProfile(input: CycleOnboardingInput): CycleProfile {
  validateCycleOnboardingInput(input);

  return {
    settings: {
      averageCycleLengthDays: input.averageCycleLengthDays,
      averagePeriodLengthDays: input.averagePeriodLengthDays,
    },
    periodRecords: [
      {
        id: INITIAL_PERIOD_RECORD_ID,
        startDate: input.lastPeriodStartDate,
      },
    ],
  };
}
