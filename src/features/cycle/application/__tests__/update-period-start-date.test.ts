import type { SQLiteDatabase } from 'expo-sqlite';

import { updatePeriodStartDate } from '../update-period-start-date';

import type { CycleProfile, PeriodRecord } from '@/features/cycle/domain/types';
import type { ISODate } from '@/types/iso-date';

// Only the database is faked. Domain validation stays real, so the duration rule
// is enforced by the domain rather than restated here.
jest.mock('@/features/cycle/data/cycle-repository', () => ({
  loadCycleProfile: jest.fn(),
  saveCycleProfile: jest.fn(),
}));

const repository = jest.requireMock('@/features/cycle/data/cycle-repository');
const loadCycleProfile = repository.loadCycleProfile as jest.Mock;
const saveCycleProfile = repository.saveCycleProfile as jest.Mock;

const db = {} as SQLiteDatabase;
const TODAY = '2026-09-25' as ISODate;

type Spec = { id: string; startDate: string; endDate?: string; isOngoing?: boolean };

function profile(records: Spec[]): CycleProfile {
  return {
    settings: { averageCycleLengthDays: 30, averagePeriodLengthDays: 6 },
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

/** One record with no recorded end, one closed, one still running. */
function mixedProfile(): CycleProfile {
  return profile([
    { id: 'onboarding-initial-period', startDate: '2026-09-02' },
    { id: 'period-2026-09-10', startDate: '2026-09-10', endDate: '2026-09-15' },
    { id: 'period-2026-09-20', startDate: '2026-09-20', isOngoing: true },
  ]);
}

function savedProfile(): CycleProfile {
  return saveCycleProfile.mock.calls[0][1] as CycleProfile;
}

function recordById(source: CycleProfile, id: string): PeriodRecord | undefined {
  return source.periodRecords.find((record) => record.id === id);
}

beforeEach(() => {
  loadCycleProfile.mockReset();
  saveCycleProfile.mockReset();
  saveCycleProfile.mockResolvedValue(undefined);
});

describe('updatePeriodStartDate input validation', () => {
  it('refuses a blank id without touching the database', async () => {
    await expect(
      updatePeriodStartDate(db, { recordId: '', startDate: TODAY, today: TODAY })
    ).rejects.toThrow(/non-empty record id/);

    expect(loadCycleProfile).not.toHaveBeenCalled();
  });

  it('refuses a whitespace id without touching the database', async () => {
    await expect(
      updatePeriodStartDate(db, { recordId: '   ', startDate: TODAY, today: TODAY })
    ).rejects.toThrow(/non-empty record id/);

    expect(loadCycleProfile).not.toHaveBeenCalled();
  });

  it('refuses a malformed start date before reading', async () => {
    await expect(
      updatePeriodStartDate(db, {
        recordId: 'a',
        startDate: '2026-02-30' as ISODate,
        today: TODAY,
      })
    ).rejects.toThrow(/invalid startDate/);

    expect(loadCycleProfile).not.toHaveBeenCalled();
  });

  it('refuses a start date that is not a date at all', async () => {
    await expect(
      updatePeriodStartDate(db, { recordId: 'a', startDate: 'dün' as ISODate, today: TODAY })
    ).rejects.toThrow(/invalid startDate/);

    expect(loadCycleProfile).not.toHaveBeenCalled();
  });

  it('refuses a malformed today', async () => {
    await expect(
      updatePeriodStartDate(db, { recordId: 'a', startDate: TODAY, today: 'today' as ISODate })
    ).rejects.toThrow(/invalid today/);

    expect(loadCycleProfile).not.toHaveBeenCalled();
  });

  it('refuses a start date in the future', async () => {
    await expect(
      updatePeriodStartDate(db, {
        recordId: 'period-2026-09-10',
        startDate: '2026-09-26' as ISODate,
        today: TODAY,
      })
    ).rejects.toThrow(/in the future/);

    expect(loadCycleProfile).not.toHaveBeenCalled();
  });

  it('accepts today itself', async () => {
    loadCycleProfile.mockResolvedValue(
      profile([{ id: 'period-2026-09-10', startDate: '2026-09-10', endDate: '2026-09-25' }])
    );

    await expect(
      updatePeriodStartDate(db, { recordId: 'period-2026-09-10', startDate: TODAY, today: TODAY })
    ).resolves.toBeDefined();
  });
});

describe('updatePeriodStartDate when the record cannot be edited', () => {
  it('refuses when nothing has been saved yet', async () => {
    loadCycleProfile.mockResolvedValue(null);

    await expect(
      updatePeriodStartDate(db, {
        recordId: 'period-2026-09-10',
        startDate: '2026-09-11' as ISODate,
        today: TODAY,
      })
    ).rejects.toThrow(/no saved cycle profile/);

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });

  it('refuses when no record has that id', async () => {
    loadCycleProfile.mockResolvedValue(mixedProfile());

    await expect(
      updatePeriodStartDate(db, {
        recordId: 'period-2026-01-01',
        startDate: '2026-09-11' as ISODate,
        today: TODAY,
      })
    ).rejects.toThrow(/no period record with id "period-2026-01-01"/);

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });

  it('refuses a period that is still running', async () => {
    loadCycleProfile.mockResolvedValue(mixedProfile());

    await expect(
      updatePeriodStartDate(db, {
        recordId: 'period-2026-09-20',
        startDate: '2026-09-19' as ISODate,
        today: TODAY,
      })
    ).rejects.toThrow(/while it is ongoing/);

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });

  it('refuses a running period even when the date has not changed', async () => {
    loadCycleProfile.mockResolvedValue(mixedProfile());

    await expect(
      updatePeriodStartDate(db, {
        recordId: 'period-2026-09-20',
        startDate: '2026-09-20' as ISODate,
        today: TODAY,
      })
    ).rejects.toThrow(/while it is ongoing/);

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });
});

describe('updatePeriodStartDate when nothing changes', () => {
  it('returns the stored profile without saving', async () => {
    const stored = mixedProfile();
    loadCycleProfile.mockResolvedValue(stored);

    const result = await updatePeriodStartDate(db, {
      recordId: 'period-2026-09-10',
      startDate: '2026-09-10' as ISODate,
      today: TODAY,
    });

    expect(result).toBe(stored);
    expect(saveCycleProfile).not.toHaveBeenCalled();
  });

  it('leaves the id alone', async () => {
    loadCycleProfile.mockResolvedValue(mixedProfile());

    const result = await updatePeriodStartDate(db, {
      recordId: 'period-2026-09-10',
      startDate: '2026-09-10' as ISODate,
      today: TODAY,
    });

    expect(recordById(result, 'period-2026-09-10')).toBeDefined();
  });
});

describe('updatePeriodStartDate against the record end date', () => {
  it('refuses a start date after the recorded end', async () => {
    loadCycleProfile.mockResolvedValue(mixedProfile());

    await expect(
      updatePeriodStartDate(db, {
        recordId: 'period-2026-09-10',
        startDate: '2026-09-16' as ISODate,
        today: TODAY,
      })
    ).rejects.toThrow(/after it ended on 2026-09-15/);

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });

  it('accepts a start date on the same day as the end', async () => {
    loadCycleProfile.mockResolvedValue(mixedProfile());

    const result = await updatePeriodStartDate(db, {
      recordId: 'period-2026-09-10',
      startDate: '2026-09-15' as ISODate,
      today: TODAY,
    });

    expect(recordById(result, 'period-2026-09-15')).toEqual({
      id: 'period-2026-09-15',
      startDate: '2026-09-15',
      endDate: '2026-09-15',
      isOngoing: false,
    });
  });

  it('accepts the longest span the domain allows', async () => {
    // 2026-09-01 to 2026-09-20 inclusive is exactly 20 days.
    loadCycleProfile.mockResolvedValue(
      profile([{ id: 'period-2026-09-10', startDate: '2026-09-10', endDate: '2026-09-20' }])
    );

    const result = await updatePeriodStartDate(db, {
      recordId: 'period-2026-09-10',
      startDate: '2026-09-01' as ISODate,
      today: TODAY,
    });

    expect(recordById(result, 'period-2026-09-01')?.startDate).toBe('2026-09-01');
    expect(saveCycleProfile).toHaveBeenCalledTimes(1);
  });

  it('refuses one day beyond that span, by the domain rule', async () => {
    // 2026-08-31 to 2026-09-20 inclusive is 21 days.
    loadCycleProfile.mockResolvedValue(
      profile([{ id: 'period-2026-09-10', startDate: '2026-09-10', endDate: '2026-09-20' }])
    );

    await expect(
      updatePeriodStartDate(db, {
        recordId: 'period-2026-09-10',
        startDate: '2026-08-31' as ISODate,
        today: TODAY,
      })
    ).rejects.toThrow(/spans 21 days/);

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });

  it('lets a record with no recorded end move freely into the past', async () => {
    loadCycleProfile.mockResolvedValue(mixedProfile());

    const result = await updatePeriodStartDate(db, {
      recordId: 'onboarding-initial-period',
      startDate: '2025-01-01' as ISODate,
      today: TODAY,
    });

    expect(recordById(result, 'onboarding-initial-period')).toEqual({
      id: 'onboarding-initial-period',
      startDate: '2025-01-01',
      isOngoing: false,
    });
  });
});

describe('updatePeriodStartDate duplicate start dates', () => {
  it('refuses a day another record already covers', async () => {
    loadCycleProfile.mockResolvedValue(mixedProfile());

    await expect(
      updatePeriodStartDate(db, {
        recordId: 'period-2026-09-10',
        startDate: '2026-09-02' as ISODate,
        today: TODAY,
      })
    ).rejects.toThrow(/already recorded on 2026-09-02/);

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });

  it('names the record it clashes with', async () => {
    loadCycleProfile.mockResolvedValue(mixedProfile());

    await expect(
      updatePeriodStartDate(db, {
        recordId: 'period-2026-09-10',
        startDate: '2026-09-02' as ISODate,
        today: TODAY,
      })
    ).rejects.toThrow(/onboarding-initial-period/);
  });

  it('refuses a day a running record already covers', async () => {
    loadCycleProfile.mockResolvedValue(mixedProfile());

    await expect(
      updatePeriodStartDate(db, {
        recordId: 'onboarding-initial-period',
        startDate: '2026-09-20' as ISODate,
        today: TODAY,
      })
    ).rejects.toThrow(/already recorded on 2026-09-20/);
  });

  it('does not count the record being edited as a clash', async () => {
    loadCycleProfile.mockResolvedValue(mixedProfile());

    await expect(
      updatePeriodStartDate(db, {
        recordId: 'period-2026-09-10',
        startDate: '2026-09-11' as ISODate,
        today: TODAY,
      })
    ).resolves.toBeDefined();
  });
});

describe('updatePeriodStartDate record ids', () => {
  it('renames a record the app named after its own start day', async () => {
    loadCycleProfile.mockResolvedValue(
      profile([{ id: 'period-2026-09-17', startDate: '2026-09-17', endDate: '2026-09-17' }])
    );

    const result = await updatePeriodStartDate(db, {
      recordId: 'period-2026-09-17',
      startDate: '2026-09-16' as ISODate,
      today: TODAY,
    });

    expect(result.periodRecords.map((record) => record.id)).toEqual(['period-2026-09-16']);
    expect(recordById(result, 'period-2026-09-17')).toBeUndefined();
  });

  it('keeps the onboarding record its own id', async () => {
    loadCycleProfile.mockResolvedValue(mixedProfile());

    const result = await updatePeriodStartDate(db, {
      recordId: 'onboarding-initial-period',
      startDate: '2026-09-01' as ISODate,
      today: TODAY,
    });

    expect(recordById(result, 'onboarding-initial-period')?.startDate).toBe('2026-09-01');
    expect(recordById(result, 'period-2026-09-01')).toBeUndefined();
  });

  it('keeps an imported id', async () => {
    loadCycleProfile.mockResolvedValue(
      profile([{ id: 'custom-import-123', startDate: '2026-09-02' }])
    );

    const result = await updatePeriodStartDate(db, {
      recordId: 'custom-import-123',
      startDate: '2026-09-01' as ISODate,
      today: TODAY,
    });

    expect(recordById(result, 'custom-import-123')?.startDate).toBe('2026-09-01');
  });

  it('keeps an id that only looks canonical', async () => {
    loadCycleProfile.mockResolvedValue(
      profile([{ id: 'period-2026-01-01', startDate: '2026-02-01' }])
    );

    const result = await updatePeriodStartDate(db, {
      recordId: 'period-2026-01-01',
      startDate: '2026-02-02' as ISODate,
      today: TODAY,
    });

    expect(recordById(result, 'period-2026-01-01')?.startDate).toBe('2026-02-02');
    expect(recordById(result, 'period-2026-02-02')).toBeUndefined();
  });

  it('refuses when the new id is already taken', async () => {
    // The clash is on the id, not the start date: the other record was imported
    // under a canonical-looking name for a day it does not start on.
    loadCycleProfile.mockResolvedValue(
      profile([
        { id: 'period-2026-09-10', startDate: '2026-09-10' },
        { id: 'period-2026-09-11', startDate: '2026-09-14' },
      ])
    );

    await expect(
      updatePeriodStartDate(db, {
        recordId: 'period-2026-09-10',
        startDate: '2026-09-11' as ISODate,
        today: TODAY,
      })
    ).rejects.toThrow(/another period record already has that id/);

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });

  it('does not silently overwrite the record holding that id', async () => {
    loadCycleProfile.mockResolvedValue(
      profile([
        { id: 'period-2026-09-10', startDate: '2026-09-10' },
        { id: 'period-2026-09-11', startDate: '2026-09-14' },
      ])
    );

    await expect(
      updatePeriodStartDate(db, {
        recordId: 'period-2026-09-10',
        startDate: '2026-09-11' as ISODate,
        today: TODAY,
      })
    ).rejects.toThrow();

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });
});

describe('updatePeriodStartDate when it saves', () => {
  it('saves the profile it returns', async () => {
    loadCycleProfile.mockResolvedValue(mixedProfile());

    const result = await updatePeriodStartDate(db, {
      recordId: 'period-2026-09-10',
      startDate: '2026-09-11' as ISODate,
      today: TODAY,
    });

    expect(saveCycleProfile).toHaveBeenCalledTimes(1);
    expect(saveCycleProfile).toHaveBeenCalledWith(db, result);
  });

  it('carries the settings through untouched', async () => {
    const stored = mixedProfile();
    loadCycleProfile.mockResolvedValue(stored);

    const result = await updatePeriodStartDate(db, {
      recordId: 'period-2026-09-10',
      startDate: '2026-09-11' as ISODate,
      today: TODAY,
    });

    expect(result.settings).toBe(stored.settings);
  });

  it('keeps the end date exactly as it was', async () => {
    loadCycleProfile.mockResolvedValue(mixedProfile());

    const result = await updatePeriodStartDate(db, {
      recordId: 'period-2026-09-10',
      startDate: '2026-09-11' as ISODate,
      today: TODAY,
    });

    expect(recordById(result, 'period-2026-09-11')?.endDate).toBe('2026-09-15');
  });

  it('leaves a record with no end date without one', async () => {
    loadCycleProfile.mockResolvedValue(mixedProfile());

    const result = await updatePeriodStartDate(db, {
      recordId: 'onboarding-initial-period',
      startDate: '2026-09-01' as ISODate,
      today: TODAY,
    });

    expect(
      Object.prototype.hasOwnProperty.call(
        recordById(result, 'onboarding-initial-period'),
        'endDate'
      )
    ).toBe(false);
  });

  it('never marks the edited record as ongoing', async () => {
    loadCycleProfile.mockResolvedValue(mixedProfile());

    const result = await updatePeriodStartDate(db, {
      recordId: 'onboarding-initial-period',
      startDate: '2026-09-01' as ISODate,
      today: TODAY,
    });

    expect(recordById(result, 'onboarding-initial-period')?.isOngoing).toBe(false);
  });

  it('changes only the record it was asked about', async () => {
    const stored = mixedProfile();
    loadCycleProfile.mockResolvedValue(stored);

    const result = await updatePeriodStartDate(db, {
      recordId: 'period-2026-09-10',
      startDate: '2026-09-11' as ISODate,
      today: TODAY,
    });

    expect(recordById(result, 'onboarding-initial-period')).toBe(stored.periodRecords[0]);
    expect(recordById(result, 'period-2026-09-20')).toBe(stored.periodRecords[2]);
  });

  it('keeps every record, just with one of them renamed', async () => {
    loadCycleProfile.mockResolvedValue(mixedProfile());

    const result = await updatePeriodStartDate(db, {
      recordId: 'period-2026-09-10',
      startDate: '2026-09-11' as ISODate,
      today: TODAY,
    });

    expect(result.periodRecords.map((record) => record.id)).toEqual([
      'onboarding-initial-period',
      'period-2026-09-11',
      'period-2026-09-20',
    ]);
  });

  it('leaves the stored profile as it found it', async () => {
    const stored = mixedProfile();
    const before = JSON.stringify(stored);
    loadCycleProfile.mockResolvedValue(stored);

    await updatePeriodStartDate(db, {
      recordId: 'period-2026-09-10',
      startDate: '2026-09-11' as ISODate,
      today: TODAY,
    });

    expect(JSON.stringify(stored)).toBe(before);
  });

  it('hands the repository the corrected record, not the old one', async () => {
    loadCycleProfile.mockResolvedValue(mixedProfile());

    await updatePeriodStartDate(db, {
      recordId: 'period-2026-09-10',
      startDate: '2026-09-11' as ISODate,
      today: TODAY,
    });

    expect(recordById(savedProfile(), 'period-2026-09-11')).toEqual({
      id: 'period-2026-09-11',
      startDate: '2026-09-11',
      endDate: '2026-09-15',
      isOngoing: false,
    });
  });

  it('validates before writing, so a rejected profile never reaches the database', async () => {
    loadCycleProfile.mockResolvedValue(
      profile([{ id: 'period-2026-09-10', startDate: '2026-09-10', endDate: '2026-09-20' }])
    );

    await expect(
      updatePeriodStartDate(db, {
        recordId: 'period-2026-09-10',
        startDate: '2026-08-01' as ISODate,
        today: TODAY,
      })
    ).rejects.toThrow();

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });
});

describe('updatePeriodStartDate when saving fails', () => {
  it('passes the failure on', async () => {
    const failure = new Error('disk full');
    loadCycleProfile.mockResolvedValue(mixedProfile());
    saveCycleProfile.mockRejectedValue(failure);

    await expect(
      updatePeriodStartDate(db, {
        recordId: 'period-2026-09-10',
        startDate: '2026-09-11' as ISODate,
        today: TODAY,
      })
    ).rejects.toThrow(failure);
  });

  it('does not retry the write', async () => {
    loadCycleProfile.mockResolvedValue(mixedProfile());
    saveCycleProfile.mockRejectedValue(new Error('disk full'));

    await expect(
      updatePeriodStartDate(db, {
        recordId: 'period-2026-09-10',
        startDate: '2026-09-11' as ISODate,
        today: TODAY,
      })
    ).rejects.toThrow();

    expect(saveCycleProfile).toHaveBeenCalledTimes(1);
  });

  it('leaves the caller’s profile untouched', async () => {
    const stored = mixedProfile();
    const before = JSON.stringify(stored);
    loadCycleProfile.mockResolvedValue(stored);
    saveCycleProfile.mockRejectedValue(new Error('disk full'));

    await expect(
      updatePeriodStartDate(db, {
        recordId: 'period-2026-09-10',
        startDate: '2026-09-11' as ISODate,
        today: TODAY,
      })
    ).rejects.toThrow();

    expect(JSON.stringify(stored)).toBe(before);
  });
});
