import type { SQLiteDatabase } from 'expo-sqlite';

import { calculateEstimatedDueDate } from '../../domain/due-date';
import type { PregnancyDueDateSource, PregnancyProfile } from '../../domain/types';
import { updatePregnancyDueDate } from '../update-pregnancy-due-date';

import type { ISODate } from '@/types/iso-date';

// Only the database is faked. The domain rules and the due-date formula stay
// real, so what is saved is what the app would really store.
jest.mock('@/features/pregnancy/data/pregnancy-repository', () => ({
  savePregnancyProfile: jest.fn(),
  loadPregnancyProfile: jest.fn(),
}));

const repository = jest.requireMock('@/features/pregnancy/data/pregnancy-repository');
const loadPregnancyProfile = repository.loadPregnancyProfile as jest.Mock;
const savePregnancyProfile = repository.savePregnancyProfile as jest.Mock;

const db = {} as SQLiteDatabase;
const date = (value: string) => value as ISODate;

const LMP = '2026-09-02';
const CALCULATED = calculateEstimatedDueDate(date(LMP));
const TODAY = date('2026-09-18');

function profile(overrides: Partial<PregnancyProfile> = {}): PregnancyProfile {
  return {
    lastMenstrualPeriodStartDate: date(LMP),
    estimatedDueDate: CALCULATED,
    dueDateSource: 'lmp',
    ...overrides,
  };
}

function savedProfile(): PregnancyProfile {
  return savePregnancyProfile.mock.calls[0][1] as PregnancyProfile;
}

beforeEach(() => {
  loadPregnancyProfile.mockReset();
  loadPregnancyProfile.mockResolvedValue(profile());
  savePregnancyProfile.mockReset();
  savePregnancyProfile.mockResolvedValue(undefined);
});

describe('updatePregnancyDueDate when there is nothing to update', () => {
  it('refuses when no pregnancy is tracked', async () => {
    loadPregnancyProfile.mockResolvedValue(null);

    await expect(
      updatePregnancyDueDate(db, {
        estimatedDueDate: date('2027-06-04'),
        source: 'adjusted',
        today: TODAY,
      })
    ).rejects.toThrow(/no tracked pregnancy/);

    expect(savePregnancyProfile).not.toHaveBeenCalled();
  });
});

describe('updatePregnancyDueDate adjusting the date', () => {
  it('stores the date and marks it measured', async () => {
    const result = await updatePregnancyDueDate(db, {
      estimatedDueDate: date('2027-06-04'),
      source: 'adjusted',
      today: TODAY,
    });

    expect(result.estimatedDueDate).toBe('2027-06-04');
    expect(result.dueDateSource).toBe('adjusted');
  });

  it('saves the profile it returns', async () => {
    const result = await updatePregnancyDueDate(db, {
      estimatedDueDate: date('2027-06-04'),
      source: 'adjusted',
      today: TODAY,
    });

    expect(savePregnancyProfile).toHaveBeenCalledTimes(1);
    expect(savePregnancyProfile).toHaveBeenCalledWith(db, result);
  });

  it('leaves the last menstrual period alone', async () => {
    const result = await updatePregnancyDueDate(db, {
      estimatedDueDate: date('2027-06-04'),
      source: 'adjusted',
      today: TODAY,
    });

    expect(result.lastMenstrualPeriodStartDate).toBe(LMP);
  });

  it('accepts a date later than the calculated one', async () => {
    const result = await updatePregnancyDueDate(db, {
      estimatedDueDate: date('2027-07-01'),
      source: 'adjusted',
      today: TODAY,
    });

    expect(result.estimatedDueDate).toBe('2027-07-01');
  });

  it('accepts a date that happens to match the formula', async () => {
    // A scan can land on the calculated day; it is still a measured date.
    loadPregnancyProfile.mockResolvedValue(
      profile({ estimatedDueDate: date('2027-06-04'), dueDateSource: 'adjusted' })
    );

    const result = await updatePregnancyDueDate(db, {
      estimatedDueDate: CALCULATED,
      source: 'adjusted',
      today: TODAY,
    });

    expect(result.estimatedDueDate).toBe(CALCULATED);
    expect(result.dueDateSource).toBe('adjusted');
  });

  it('accepts the day the pregnancy began', async () => {
    const result = await updatePregnancyDueDate(db, {
      estimatedDueDate: date(LMP),
      source: 'adjusted',
      today: TODAY,
    });

    expect(result.estimatedDueDate).toBe(LMP);
  });

  it('refuses a date before the pregnancy began', async () => {
    await expect(
      updatePregnancyDueDate(db, {
        estimatedDueDate: date('2026-09-01'),
        source: 'adjusted',
        today: TODAY,
      })
    ).rejects.toThrow(/before the pregnancy began on 2026-09-02/);

    expect(savePregnancyProfile).not.toHaveBeenCalled();
  });

  it('sets no upper bound on how far ahead the date may sit', async () => {
    const result = await updatePregnancyDueDate(db, {
      estimatedDueDate: date('2030-01-01'),
      source: 'adjusted',
      today: TODAY,
    });

    expect(result.estimatedDueDate).toBe('2030-01-01');
  });
});

describe('updatePregnancyDueDate going back to the calculated date', () => {
  beforeEach(() => {
    loadPregnancyProfile.mockResolvedValue(
      profile({ estimatedDueDate: date('2027-06-04'), dueDateSource: 'adjusted' })
    );
  });

  it('stores the calculated date and marks it calculated', async () => {
    const result = await updatePregnancyDueDate(db, {
      estimatedDueDate: CALCULATED,
      source: 'lmp',
      today: TODAY,
    });

    expect(result.estimatedDueDate).toBe(CALCULATED);
    expect(result.dueDateSource).toBe('lmp');
  });

  it('saves it', async () => {
    await updatePregnancyDueDate(db, {
      estimatedDueDate: CALCULATED,
      source: 'lmp',
      today: TODAY,
    });

    expect(savedProfile()).toEqual({
      lastMenstrualPeriodStartDate: LMP,
      estimatedDueDate: CALCULATED,
      dueDateSource: 'lmp',
    });
  });

  it('refuses a date that is not what the formula gives', async () => {
    await expect(
      updatePregnancyDueDate(db, {
        estimatedDueDate: date('2027-06-10'),
        source: 'lmp',
        today: TODAY,
      })
    ).rejects.toThrow(/2026-09-02 gives 2027-06-09/);

    expect(savePregnancyProfile).not.toHaveBeenCalled();
  });

  it('refuses a date a day off the formula', async () => {
    await expect(
      updatePregnancyDueDate(db, {
        estimatedDueDate: date('2027-06-08'),
        source: 'lmp',
        today: TODAY,
      })
    ).rejects.toThrow(/counted from the last menstrual period/);
  });
});

describe('updatePregnancyDueDate with input it refuses', () => {
  it('refuses an unknown source before reading', async () => {
    await expect(
      updatePregnancyDueDate(db, {
        estimatedDueDate: CALCULATED,
        source: 'scan' as PregnancyDueDateSource,
        today: TODAY,
      })
    ).rejects.toThrow(/invalid source/);

    expect(loadPregnancyProfile).not.toHaveBeenCalled();
  });

  it('refuses a date that does not exist', async () => {
    await expect(
      updatePregnancyDueDate(db, {
        estimatedDueDate: date('2027-02-30'),
        source: 'adjusted',
        today: TODAY,
      })
    ).rejects.toThrow(/invalid estimatedDueDate/);

    expect(loadPregnancyProfile).not.toHaveBeenCalled();
  });

  it('refuses something that is not a date at all', async () => {
    await expect(
      updatePregnancyDueDate(db, {
        estimatedDueDate: date('yarın'),
        source: 'adjusted',
        today: TODAY,
      })
    ).rejects.toThrow(/invalid estimatedDueDate/);
  });

  it('refuses a malformed today', async () => {
    await expect(
      updatePregnancyDueDate(db, {
        estimatedDueDate: CALCULATED,
        source: 'adjusted',
        today: date('bugün'),
      })
    ).rejects.toThrow(/invalid today/);
  });
});

describe('updatePregnancyDueDate when nothing changes', () => {
  it('returns the stored profile without saving', async () => {
    const stored = profile();
    loadPregnancyProfile.mockResolvedValue(stored);

    const result = await updatePregnancyDueDate(db, {
      estimatedDueDate: CALCULATED,
      source: 'lmp',
      today: TODAY,
    });

    expect(result).toBe(stored);
    expect(savePregnancyProfile).not.toHaveBeenCalled();
  });

  it('returns without saving for an unchanged adjusted date too', async () => {
    const stored = profile({ estimatedDueDate: date('2027-06-04'), dueDateSource: 'adjusted' });
    loadPregnancyProfile.mockResolvedValue(stored);

    const result = await updatePregnancyDueDate(db, {
      estimatedDueDate: date('2027-06-04'),
      source: 'adjusted',
      today: TODAY,
    });

    expect(result).toBe(stored);
    expect(savePregnancyProfile).not.toHaveBeenCalled();
  });

  it('still saves when only the source changes', async () => {
    // The date is the calculated one but stored as measured; marking it
    // calculated is a real change.
    loadPregnancyProfile.mockResolvedValue(
      profile({ estimatedDueDate: CALCULATED, dueDateSource: 'adjusted' })
    );

    await updatePregnancyDueDate(db, {
      estimatedDueDate: CALCULATED,
      source: 'lmp',
      today: TODAY,
    });

    expect(savePregnancyProfile).toHaveBeenCalledTimes(1);
    expect(savedProfile().dueDateSource).toBe('lmp');
  });

  it('still saves when only the date changes', async () => {
    loadPregnancyProfile.mockResolvedValue(
      profile({ estimatedDueDate: date('2027-06-04'), dueDateSource: 'adjusted' })
    );

    await updatePregnancyDueDate(db, {
      estimatedDueDate: date('2027-06-05'),
      source: 'adjusted',
      today: TODAY,
    });

    expect(savePregnancyProfile).toHaveBeenCalledTimes(1);
  });
});

describe('updatePregnancyDueDate purity and failure', () => {
  it('leaves the stored profile as it found it', async () => {
    const stored = profile();
    const before = JSON.stringify(stored);
    loadPregnancyProfile.mockResolvedValue(stored);

    await updatePregnancyDueDate(db, {
      estimatedDueDate: date('2027-06-04'),
      source: 'adjusted',
      today: TODAY,
    });

    expect(JSON.stringify(stored)).toBe(before);
  });

  it('passes a write failure on without retrying', async () => {
    savePregnancyProfile.mockRejectedValue(new Error('disk is full'));

    await expect(
      updatePregnancyDueDate(db, {
        estimatedDueDate: date('2027-06-04'),
        source: 'adjusted',
        today: TODAY,
      })
    ).rejects.toThrow('disk is full');

    expect(savePregnancyProfile).toHaveBeenCalledTimes(1);
  });

  it('passes a read failure on without writing', async () => {
    loadPregnancyProfile.mockRejectedValue(new Error('database is locked'));

    await expect(
      updatePregnancyDueDate(db, {
        estimatedDueDate: date('2027-06-04'),
        source: 'adjusted',
        today: TODAY,
      })
    ).rejects.toThrow(/database is locked/);

    expect(savePregnancyProfile).not.toHaveBeenCalled();
  });
});
