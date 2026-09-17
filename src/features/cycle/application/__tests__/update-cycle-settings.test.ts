import type { SQLiteDatabase } from 'expo-sqlite';

import { updateCycleSettings } from '../update-cycle-settings';

import {
  MAX_CYCLE_LENGTH_DAYS,
  MAX_PERIOD_LENGTH_DAYS,
  MIN_CYCLE_LENGTH_DAYS,
  MIN_PERIOD_LENGTH_DAYS,
} from '@/features/cycle/domain/limits';
import type { CycleProfile, PeriodRecord } from '@/features/cycle/domain/types';
import type { ISODate } from '@/types/iso-date';

// Only the database is faked. Domain validation stays real, so the bounds and
// the period-shorter-than-cycle rule are enforced by the domain rather than
// restated here.
jest.mock('@/features/cycle/data/cycle-repository', () => ({
  loadCycleProfile: jest.fn(),
  saveCycleProfile: jest.fn(),
}));

const repository = jest.requireMock('@/features/cycle/data/cycle-repository');
const loadCycleProfile = repository.loadCycleProfile as jest.Mock;
const saveCycleProfile = repository.saveCycleProfile as jest.Mock;

const db = {} as SQLiteDatabase;

type Spec = { id: string; startDate: string; endDate?: string; isOngoing?: boolean };

function profile(
  settings: { cycle: number; period: number },
  records: Spec[] = [
    { id: 'onboarding-initial-period', startDate: '2026-09-02', endDate: '2026-09-07' },
    { id: 'period-2026-09-20', startDate: '2026-09-20', isOngoing: true },
  ]
): CycleProfile {
  return {
    settings: {
      averageCycleLengthDays: settings.cycle,
      averagePeriodLengthDays: settings.period,
    },
    periodRecords: records.map((record) => {
      const built: PeriodRecord = {
        id: record.id,
        startDate: record.startDate as ISODate,
        isOngoing: record.isOngoing === true,
      };

      return record.endDate === undefined
        ? built
        : { ...built, endDate: record.endDate as ISODate };
    }),
  };
}

function stored(): CycleProfile {
  return profile({ cycle: 30, period: 6 });
}

function savedProfile(): CycleProfile {
  return saveCycleProfile.mock.calls[0][1] as CycleProfile;
}

beforeEach(() => {
  loadCycleProfile.mockReset();
  saveCycleProfile.mockReset();
  saveCycleProfile.mockResolvedValue(undefined);
});

describe('updateCycleSettings when there is nothing to update', () => {
  it('refuses when nothing has been saved yet', async () => {
    loadCycleProfile.mockResolvedValue(null);

    await expect(
      updateCycleSettings(db, { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 })
    ).rejects.toThrow(/no saved cycle profile/);

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });
});

describe('updateCycleSettings with usable values', () => {
  it('stores the new averages', async () => {
    loadCycleProfile.mockResolvedValue(stored());

    const result = await updateCycleSettings(db, {
      averageCycleLengthDays: 28,
      averagePeriodLengthDays: 5,
    });

    expect(result.settings).toEqual({
      averageCycleLengthDays: 28,
      averagePeriodLengthDays: 5,
    });
  });

  it('saves the profile it returns', async () => {
    loadCycleProfile.mockResolvedValue(stored());

    const result = await updateCycleSettings(db, {
      averageCycleLengthDays: 28,
      averagePeriodLengthDays: 5,
    });

    expect(saveCycleProfile).toHaveBeenCalledTimes(1);
    expect(saveCycleProfile).toHaveBeenCalledWith(db, result);
  });

  it('accepts the shortest cycle and period the domain allows', async () => {
    loadCycleProfile.mockResolvedValue(stored());

    const result = await updateCycleSettings(db, {
      averageCycleLengthDays: MIN_CYCLE_LENGTH_DAYS,
      averagePeriodLengthDays: MIN_PERIOD_LENGTH_DAYS,
    });

    expect(result.settings).toEqual({
      averageCycleLengthDays: MIN_CYCLE_LENGTH_DAYS,
      averagePeriodLengthDays: MIN_PERIOD_LENGTH_DAYS,
    });
  });

  it('accepts the longest cycle and period the domain allows', async () => {
    loadCycleProfile.mockResolvedValue(stored());

    const result = await updateCycleSettings(db, {
      averageCycleLengthDays: MAX_CYCLE_LENGTH_DAYS,
      averagePeriodLengthDays: MAX_PERIOD_LENGTH_DAYS,
    });

    expect(result.settings).toEqual({
      averageCycleLengthDays: MAX_CYCLE_LENGTH_DAYS,
      averagePeriodLengthDays: MAX_PERIOD_LENGTH_DAYS,
    });
  });

  it('accepts a period exactly as long as the cycle', async () => {
    // Only reachable where the two ranges overlap: a 20-day cycle with a 20-day
    // period is the longest period the domain allows.
    loadCycleProfile.mockResolvedValue(stored());

    const result = await updateCycleSettings(db, {
      averageCycleLengthDays: MAX_PERIOD_LENGTH_DAYS,
      averagePeriodLengthDays: MAX_PERIOD_LENGTH_DAYS,
    });

    expect(result.settings.averagePeriodLengthDays).toBe(
      result.settings.averageCycleLengthDays
    );
  });
});

describe('updateCycleSettings with values the domain refuses', () => {
  beforeEach(() => {
    loadCycleProfile.mockResolvedValue(stored());
  });

  it('refuses a cycle below the minimum', async () => {
    await expect(
      updateCycleSettings(db, {
        averageCycleLengthDays: MIN_CYCLE_LENGTH_DAYS - 1,
        averagePeriodLengthDays: 5,
      })
    ).rejects.toThrow(/averageCycleLengthDays must be between/);

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });

  it('refuses a cycle above the maximum', async () => {
    await expect(
      updateCycleSettings(db, {
        averageCycleLengthDays: MAX_CYCLE_LENGTH_DAYS + 1,
        averagePeriodLengthDays: 5,
      })
    ).rejects.toThrow(/averageCycleLengthDays must be between/);

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });

  it('refuses a period below the minimum', async () => {
    await expect(
      updateCycleSettings(db, {
        averageCycleLengthDays: 28,
        averagePeriodLengthDays: MIN_PERIOD_LENGTH_DAYS - 1,
      })
    ).rejects.toThrow(/averagePeriodLengthDays must be between/);

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });

  it('refuses a period above the maximum', async () => {
    await expect(
      updateCycleSettings(db, {
        averageCycleLengthDays: 28,
        averagePeriodLengthDays: MAX_PERIOD_LENGTH_DAYS + 1,
      })
    ).rejects.toThrow(/averagePeriodLengthDays must be between/);

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });

  it('refuses a period longer than the cycle it sits in', async () => {
    await expect(
      updateCycleSettings(db, { averageCycleLengthDays: 16, averagePeriodLengthDays: 17 })
    ).rejects.toThrow(/cannot exceed/);

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });

  it('refuses a fractional cycle length', async () => {
    await expect(
      updateCycleSettings(db, { averageCycleLengthDays: 28.5, averagePeriodLengthDays: 5 })
    ).rejects.toThrow(/must be an integer/);

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });

  it('refuses a fractional period length', async () => {
    await expect(
      updateCycleSettings(db, { averageCycleLengthDays: 28, averagePeriodLengthDays: 5.5 })
    ).rejects.toThrow(/must be an integer/);

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });

  it('refuses NaN', async () => {
    await expect(
      updateCycleSettings(db, { averageCycleLengthDays: Number.NaN, averagePeriodLengthDays: 5 })
    ).rejects.toThrow(/must be an integer/);

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });

  it('refuses Infinity', async () => {
    await expect(
      updateCycleSettings(db, {
        averageCycleLengthDays: Number.POSITIVE_INFINITY,
        averagePeriodLengthDays: 5,
      })
    ).rejects.toThrow(/must be an integer/);

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });

  it('refuses negative Infinity', async () => {
    await expect(
      updateCycleSettings(db, {
        averageCycleLengthDays: 28,
        averagePeriodLengthDays: Number.NEGATIVE_INFINITY,
      })
    ).rejects.toThrow(/must be an integer/);

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });
});

describe('updateCycleSettings and the recorded periods', () => {
  it('leaves the records exactly as they were', async () => {
    const current = stored();
    loadCycleProfile.mockResolvedValue(current);

    const result = await updateCycleSettings(db, {
      averageCycleLengthDays: 28,
      averagePeriodLengthDays: 5,
    });

    expect(result.periodRecords).toBe(current.periodRecords);
  });

  it('changes no id, date or ongoing flag', async () => {
    loadCycleProfile.mockResolvedValue(stored());

    await updateCycleSettings(db, {
      averageCycleLengthDays: 28,
      averagePeriodLengthDays: 5,
    });

    expect(savedProfile().periodRecords).toEqual([
      {
        id: 'onboarding-initial-period',
        startDate: '2026-09-02',
        endDate: '2026-09-07',
        isOngoing: false,
      },
      { id: 'period-2026-09-20', startDate: '2026-09-20', isOngoing: true },
    ]);
  });

  it('keeps a record that has no end date without one', async () => {
    loadCycleProfile.mockResolvedValue(
      profile({ cycle: 30, period: 6 }, [{ id: 'a', startDate: '2026-09-02' }])
    );

    await updateCycleSettings(db, {
      averageCycleLengthDays: 28,
      averagePeriodLengthDays: 5,
    });

    expect(
      Object.prototype.hasOwnProperty.call(savedProfile().periodRecords[0], 'endDate')
    ).toBe(false);
  });

  it('leaves the stored profile as it found it', async () => {
    const current = stored();
    const before = JSON.stringify(current);
    loadCycleProfile.mockResolvedValue(current);

    await updateCycleSettings(db, {
      averageCycleLengthDays: 28,
      averagePeriodLengthDays: 5,
    });

    expect(JSON.stringify(current)).toBe(before);
    expect(current.settings).toEqual({
      averageCycleLengthDays: 30,
      averagePeriodLengthDays: 6,
    });
  });

  it('builds a new settings object rather than editing the old one', async () => {
    const current = stored();
    loadCycleProfile.mockResolvedValue(current);

    const result = await updateCycleSettings(db, {
      averageCycleLengthDays: 28,
      averagePeriodLengthDays: 5,
    });

    expect(result.settings).not.toBe(current.settings);
  });
});

describe('updateCycleSettings when nothing changes', () => {
  it('returns the stored profile without saving', async () => {
    const current = stored();
    loadCycleProfile.mockResolvedValue(current);

    const result = await updateCycleSettings(db, {
      averageCycleLengthDays: 30,
      averagePeriodLengthDays: 6,
    });

    expect(result).toBe(current);
    expect(saveCycleProfile).not.toHaveBeenCalled();
  });

  it('still saves when only the cycle length moves', async () => {
    loadCycleProfile.mockResolvedValue(stored());

    await updateCycleSettings(db, {
      averageCycleLengthDays: 29,
      averagePeriodLengthDays: 6,
    });

    expect(saveCycleProfile).toHaveBeenCalledTimes(1);
  });

  it('still saves when only the period length moves', async () => {
    loadCycleProfile.mockResolvedValue(stored());

    await updateCycleSettings(db, {
      averageCycleLengthDays: 30,
      averagePeriodLengthDays: 5,
    });

    expect(saveCycleProfile).toHaveBeenCalledTimes(1);
  });
});

describe('updateCycleSettings when saving fails', () => {
  it('passes the failure on', async () => {
    const failure = new Error('disk full');
    loadCycleProfile.mockResolvedValue(stored());
    saveCycleProfile.mockRejectedValue(failure);

    await expect(
      updateCycleSettings(db, { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 })
    ).rejects.toThrow(failure);
  });

  it('does not retry the write', async () => {
    loadCycleProfile.mockResolvedValue(stored());
    saveCycleProfile.mockRejectedValue(new Error('disk full'));

    await expect(
      updateCycleSettings(db, { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 })
    ).rejects.toThrow();

    expect(saveCycleProfile).toHaveBeenCalledTimes(1);
  });

  it('passes a read failure on without writing', async () => {
    loadCycleProfile.mockRejectedValue(new Error('database is locked'));

    await expect(
      updateCycleSettings(db, { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 })
    ).rejects.toThrow(/database is locked/);

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });
});
