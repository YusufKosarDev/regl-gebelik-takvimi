import {
  createInitialCycleProfile,
  validateCycleOnboardingInput,
  type CycleOnboardingInput,
} from '../onboarding';
import { validateCycleProfile } from '../validation';

import type { ISODate } from '@/types/iso-date';
import { toISODate } from '@/utils/date';

function input(
  lastPeriodStartDate: string,
  averageCycleLengthDays: number,
  averagePeriodLengthDays: number
): CycleOnboardingInput {
  return {
    lastPeriodStartDate: toISODate(lastPeriodStartDate),
    averageCycleLengthDays,
    averagePeriodLengthDays,
  };
}

describe('validateCycleOnboardingInput', () => {
  it('accepts a typical input', () => {
    expect(() => validateCycleOnboardingInput(input('2026-09-01', 28, 5))).not.toThrow();
  });

  it('accepts the minimum boundary', () => {
    expect(() => validateCycleOnboardingInput(input('2026-09-01', 15, 1))).not.toThrow();
  });

  it('accepts the maximum boundary', () => {
    expect(() => validateCycleOnboardingInput(input('2026-09-01', 90, 20))).not.toThrow();
  });

  it('rejects a start date that is not a real calendar date', () => {
    const invalid: CycleOnboardingInput = {
      lastPeriodStartDate: '2026-02-30' as ISODate,
      averageCycleLengthDays: 28,
      averagePeriodLengthDays: 5,
    };

    expect(() => validateCycleOnboardingInput(invalid)).toThrow(/Invalid lastPeriodStartDate/);
  });

  it('rejects a malformed start date', () => {
    const invalid: CycleOnboardingInput = {
      lastPeriodStartDate: '2026-13-01' as ISODate,
      averageCycleLengthDays: 28,
      averagePeriodLengthDays: 5,
    };

    expect(() => validateCycleOnboardingInput(invalid)).toThrow(/Invalid lastPeriodStartDate/);
  });

  it('rejects a cycle length below the minimum', () => {
    expect(() => validateCycleOnboardingInput(input('2026-09-01', 14, 5))).toThrow(
      /averageCycleLengthDays must be between 15 and 90/
    );
  });

  it('rejects a cycle length above the maximum', () => {
    expect(() => validateCycleOnboardingInput(input('2026-09-01', 91, 5))).toThrow(
      /averageCycleLengthDays must be between 15 and 90/
    );
  });

  it('rejects a period length below the minimum', () => {
    expect(() => validateCycleOnboardingInput(input('2026-09-01', 28, 0))).toThrow(
      /averagePeriodLengthDays must be between 1 and 20/
    );
  });

  it('rejects a period length above the maximum', () => {
    expect(() => validateCycleOnboardingInput(input('2026-09-01', 28, 21))).toThrow(
      /averagePeriodLengthDays must be between 1 and 20/
    );
  });

  it('rejects a period longer than the cycle', () => {
    expect(() => validateCycleOnboardingInput(input('2026-09-01', 15, 16))).toThrow(
      /cannot exceed averageCycleLengthDays/
    );
  });

  it('rejects non-integer lengths', () => {
    expect(() => validateCycleOnboardingInput(input('2026-09-01', 28.5, 5))).toThrow(
      /averageCycleLengthDays must be an integer/
    );
    expect(() => validateCycleOnboardingInput(input('2026-09-01', 28, 5.5))).toThrow(
      /averagePeriodLengthDays must be an integer/
    );
  });
});

describe('createInitialCycleProfile', () => {
  const onboarding = input('2026-09-01', 28, 5);

  it('copies the settings across', () => {
    const profile = createInitialCycleProfile(onboarding);

    expect(profile.settings).toEqual({
      averageCycleLengthDays: 28,
      averagePeriodLengthDays: 5,
    });
  });

  it('seeds exactly one period record', () => {
    expect(createInitialCycleProfile(onboarding).periodRecords).toHaveLength(1);
  });

  it('uses the reported last period start date', () => {
    expect(createInitialCycleProfile(onboarding).periodRecords[0].startDate).toBe('2026-09-01');
  });

  it('leaves the end date unset', () => {
    expect(createInitialCycleProfile(onboarding).periodRecords[0].endDate).toBeUndefined();
  });

  it('uses a fixed, deterministic record id', () => {
    expect(createInitialCycleProfile(onboarding).periodRecords[0].id).toBe(
      'onboarding-initial-period'
    );
  });

  it('produces a profile that passes validateCycleProfile', () => {
    expect(() => validateCycleProfile(createInitialCycleProfile(onboarding))).not.toThrow();
  });

  it('produces a valid profile at both boundaries', () => {
    for (const settings of [input('2026-09-01', 15, 1), input('2026-09-01', 90, 20)]) {
      expect(() => validateCycleProfile(createInitialCycleProfile(settings))).not.toThrow();
    }
  });

  it('produces an equal profile for the same input', () => {
    expect(createInitialCycleProfile(onboarding)).toEqual(createInitialCycleProfile(onboarding));
  });

  it('propagates validation errors', () => {
    expect(() => createInitialCycleProfile(input('2026-09-01', 14, 5))).toThrow(
      /averageCycleLengthDays must be between 15 and 90/
    );
    expect(() =>
      createInitialCycleProfile({
        lastPeriodStartDate: '2026-02-30' as ISODate,
        averageCycleLengthDays: 28,
        averagePeriodLengthDays: 5,
      })
    ).toThrow(/Invalid lastPeriodStartDate/);
  });

  it('does not mutate the input', () => {
    const original = input('2026-09-01', 28, 5);
    const snapshot = JSON.parse(JSON.stringify(original));

    createInitialCycleProfile(original);

    expect(JSON.parse(JSON.stringify(original))).toEqual(snapshot);
  });

  it('returns a fresh record array on each call', () => {
    const first = createInitialCycleProfile(onboarding);
    const second = createInitialCycleProfile(onboarding);

    expect(first.periodRecords).not.toBe(second.periodRecords);
    expect(first.periodRecords).toEqual(second.periodRecords);
  });
});

describe('createInitialCycleProfile and the ongoing flag', () => {
  it('records the remembered period as finished, not happening now', () => {
    const profile = createInitialCycleProfile({
      averageCycleLengthDays: 30,
      averagePeriodLengthDays: 6,
      lastPeriodStartDate: toISODate('2026-09-02'),
    });

    expect(profile.periodRecords[0].isOngoing).toBe(false);
  });

  it('invents no end date for it', () => {
    const profile = createInitialCycleProfile({
      averageCycleLengthDays: 30,
      averagePeriodLengthDays: 6,
      lastPeriodStartDate: toISODate('2026-09-02'),
    });

    // The average period length is known, but when this one stopped is not.
    expect(profile.periodRecords[0].endDate).toBeUndefined();
  });
});
