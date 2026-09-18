import type { SQLiteDatabase } from 'expo-sqlite';

import { updatePeriodEndDate } from '../update-period-end-date';

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

beforeEach(() => {
  loadCycleProfile.mockReset();
  saveCycleProfile.mockReset();
  saveCycleProfile.mockResolvedValue(undefined);
});

describe('updatePeriodEndDate input validation', () => {
  it('refuses a blank id without touching the database', async () => {
    await expect(
      updatePeriodEndDate(db, { recordId: '', endDate: TODAY, today: TODAY })
    ).rejects.toThrow(/non-empty record id/);

    expect(loadCycleProfile).not.toHaveBeenCalled();
  });

  it('refuses a whitespace id', async () => {
    await expect(
      updatePeriodEndDate(db, { recordId: '   ', today: TODAY })
    ).rejects.toThrow(/non-empty record id/);

    expect(loadCycleProfile).not.toHaveBeenCalled();
  });

  it('refuses a malformed end date before reading', async () => {
    await expect(
      updatePeriodEndDate(db, { recordId: 'a', endDate: '2026-02-30' as ISODate, today: TODAY })
    ).rejects.toThrow(/invalid endDate/);

    expect(loadCycleProfile).not.toHaveBeenCalled();
  });

  it('refuses a malformed today', async () => {
    await expect(
      updatePeriodEndDate(db, { recordId: 'a', today: 'today' as ISODate })
    ).rejects.toThrow(/invalid today/);
  });

  it('refuses an end date in the future', async () => {
    await expect(
      updatePeriodEndDate(db, {
        recordId: 'period-2026-09-10',
        endDate: '2026-09-26' as ISODate,
        today: TODAY,
      })
    ).rejects.toThrow(/in the future/);

    expect(loadCycleProfile).not.toHaveBeenCalled();
  });
});

describe('updatePeriodEndDate without something to edit', () => {
  it('refuses when nothing is saved', async () => {
    loadCycleProfile.mockResolvedValue(null);

    await expect(
      updatePeriodEndDate(db, { recordId: 'a', today: TODAY })
    ).rejects.toThrow(/no saved cycle profile/);

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });

  it('refuses an id that is not on file', async () => {
    loadCycleProfile.mockResolvedValue(mixedProfile());

    await expect(
      updatePeriodEndDate(db, { recordId: 'period-2026-01-01', today: TODAY })
    ).rejects.toThrow(/no period record with that id/);

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });

  it('refuses a period that is still running', async () => {
    loadCycleProfile.mockResolvedValue(mixedProfile());

    await expect(
      updatePeriodEndDate(db, {
        recordId: 'period-2026-09-20',
        endDate: '2026-09-22' as ISODate,
        today: TODAY,
      })
    ).rejects.toThrow(/while it is ongoing; end it instead/);

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });
});

describe('updatePeriodEndDate setting an end date', () => {
  it('gives a record with no recorded end one', async () => {
    loadCycleProfile.mockResolvedValue(mixedProfile());

    const updated = await updatePeriodEndDate(db, {
      recordId: 'onboarding-initial-period',
      endDate: '2026-09-07' as ISODate,
      today: TODAY,
    });

    expect(updated.periodRecords[0]).toEqual({
      id: 'onboarding-initial-period',
      startDate: '2026-09-02',
      endDate: '2026-09-07',
      isOngoing: false,
    });
  });

  it('moves the end date of a closed record', async () => {
    loadCycleProfile.mockResolvedValue(mixedProfile());

    const updated = await updatePeriodEndDate(db, {
      recordId: 'period-2026-09-10',
      endDate: '2026-09-13' as ISODate,
      today: TODAY,
    });

    expect(updated.periodRecords[1].endDate).toBe('2026-09-13');
    expect(updated.periodRecords[1].isOngoing).toBe(false);
  });

  it('accepts ending on the day it started', async () => {
    loadCycleProfile.mockResolvedValue(mixedProfile());

    const updated = await updatePeriodEndDate(db, {
      recordId: 'period-2026-09-10',
      endDate: '2026-09-10' as ISODate,
      today: TODAY,
    });

    expect(updated.periodRecords[1].endDate).toBe('2026-09-10');
  });

  it('refuses an end before the start', async () => {
    loadCycleProfile.mockResolvedValue(mixedProfile());

    await expect(
      updatePeriodEndDate(db, {
        recordId: 'period-2026-09-10',
        endDate: '2026-09-09' as ISODate,
        today: TODAY,
      })
    ).rejects.toThrow(/cannot end a period before it started/);

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });

  it('accepts the longest span the domain allows', async () => {
    // 2026-09-02 to 2026-09-21 is 20 days.
    loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-02' }])
    );

    const updated = await updatePeriodEndDate(db, {
      recordId: 'a',
      endDate: '2026-09-21' as ISODate,
      today: TODAY,
    });

    expect(updated.periodRecords[0].endDate).toBe('2026-09-21');
  });

  it('leaves the length limit to the domain', async () => {
    // One day longer, so validation refuses it.
    loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-02' }])
    );

    await expect(
      updatePeriodEndDate(db, {
        recordId: 'a',
        endDate: '2026-09-22' as ISODate,
        today: TODAY,
      })
    ).rejects.toThrow(/spans more than the maximum of 20 days/);

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });
});

describe('updatePeriodEndDate clearing an end date', () => {
  it('removes the end date', async () => {
    loadCycleProfile.mockResolvedValue(mixedProfile());

    const updated = await updatePeriodEndDate(db, {
      recordId: 'period-2026-09-10',
      today: TODAY,
    });

    expect(updated.periodRecords[1]).toEqual({
      id: 'period-2026-09-10',
      startDate: '2026-09-10',
      isOngoing: false,
    });
  });

  it('really drops the key rather than leaving it undefined', async () => {
    loadCycleProfile.mockResolvedValue(mixedProfile());

    const updated = await updatePeriodEndDate(db, {
      recordId: 'period-2026-09-10',
      today: TODAY,
    });

    expect(Object.keys(updated.periodRecords[1]).sort()).toEqual([
      'id',
      'isOngoing',
      'startDate',
    ]);
  });

  it('does not make the record ongoing', async () => {
    loadCycleProfile.mockResolvedValue(mixedProfile());

    const updated = await updatePeriodEndDate(db, {
      recordId: 'period-2026-09-10',
      today: TODAY,
    });

    // "End unknown" is not the same as "still bleeding".
    expect(updated.periodRecords[1].isOngoing).toBe(false);
    expect(updated.periodRecords.filter((record) => record.isOngoing).map((r) => r.id)).toEqual([
      'period-2026-09-20',
    ]);
  });
});

describe('updatePeriodEndDate no-op', () => {
  it('writes nothing when the end date already matches', async () => {
    const stored = mixedProfile();
    loadCycleProfile.mockResolvedValue(stored);

    const result = await updatePeriodEndDate(db, {
      recordId: 'period-2026-09-10',
      endDate: '2026-09-15' as ISODate,
      today: TODAY,
    });

    expect(saveCycleProfile).not.toHaveBeenCalled();
    expect(result).toBe(stored);
  });

  it('writes nothing when clearing an end date that is already unknown', async () => {
    const stored = mixedProfile();
    loadCycleProfile.mockResolvedValue(stored);

    const result = await updatePeriodEndDate(db, {
      recordId: 'onboarding-initial-period',
      today: TODAY,
    });

    expect(saveCycleProfile).not.toHaveBeenCalled();
    expect(result).toBe(stored);
  });
});

describe('updatePeriodEndDate changes only the target', () => {
  beforeEach(() => {
    loadCycleProfile.mockResolvedValue(mixedProfile());
  });

  it('leaves the other records exactly as they were', async () => {
    const updated = await updatePeriodEndDate(db, {
      recordId: 'period-2026-09-10',
      endDate: '2026-09-13' as ISODate,
      today: TODAY,
    });

    expect(updated.periodRecords[0]).toEqual({
      id: 'onboarding-initial-period',
      startDate: '2026-09-02',
      isOngoing: false,
    });
    expect(updated.periodRecords[2]).toEqual({
      id: 'period-2026-09-20',
      startDate: '2026-09-20',
      isOngoing: true,
    });
  });

  it('keeps the id and the start date', async () => {
    const updated = await updatePeriodEndDate(db, {
      recordId: 'period-2026-09-10',
      endDate: '2026-09-13' as ISODate,
      today: TODAY,
    });

    expect(updated.periodRecords[1].id).toBe('period-2026-09-10');
    expect(updated.periodRecords[1].startDate).toBe('2026-09-10');
  });

  it('keeps the order and the settings', async () => {
    const updated = await updatePeriodEndDate(db, {
      recordId: 'period-2026-09-10',
      endDate: '2026-09-13' as ISODate,
      today: TODAY,
    });

    expect(updated.periodRecords.map((record) => record.id)).toEqual([
      'onboarding-initial-period',
      'period-2026-09-10',
      'period-2026-09-20',
    ]);
    expect(updated.settings).toEqual({ averageCycleLengthDays: 30, averagePeriodLengthDays: 6 });
  });
});

describe('updatePeriodEndDate storage', () => {
  beforeEach(() => {
    loadCycleProfile.mockResolvedValue(mixedProfile());
  });

  it('stores exactly what it returns', async () => {
    const updated = await updatePeriodEndDate(db, {
      recordId: 'period-2026-09-10',
      endDate: '2026-09-13' as ISODate,
      today: TODAY,
    });

    expect(saveCycleProfile).toHaveBeenCalledTimes(1);
    expect(saveCycleProfile).toHaveBeenCalledWith(db, updated);
  });

  it('lets a failed write through', async () => {
    saveCycleProfile.mockRejectedValue(new Error('disk is full'));

    await expect(
      updatePeriodEndDate(db, {
        recordId: 'period-2026-09-10',
        endDate: '2026-09-13' as ISODate,
        today: TODAY,
      })
    ).rejects.toThrow('disk is full');
  });

  it('lets a failed read through', async () => {
    loadCycleProfile.mockRejectedValue(new Error('corrupt row'));

    await expect(
      updatePeriodEndDate(db, { recordId: 'period-2026-09-10', today: TODAY })
    ).rejects.toThrow('corrupt row');
  });
});

describe('updatePeriodEndDate purity', () => {
  it('does not mutate the stored profile', async () => {
    const stored = mixedProfile();
    const snapshot = JSON.parse(JSON.stringify(stored));
    loadCycleProfile.mockResolvedValue(stored);

    await updatePeriodEndDate(db, {
      recordId: 'period-2026-09-10',
      endDate: '2026-09-13' as ISODate,
      today: TODAY,
    });

    expect(stored).toEqual(snapshot);
    expect(stored.periodRecords[1].endDate).toBe('2026-09-15');
  });

  it('leaves the untouched records as the same objects', async () => {
    const stored = mixedProfile();
    loadCycleProfile.mockResolvedValue(stored);

    const updated = await updatePeriodEndDate(db, {
      recordId: 'period-2026-09-10',
      endDate: '2026-09-13' as ISODate,
      today: TODAY,
    });

    expect(updated.periodRecords[0]).toBe(stored.periodRecords[0]);
    expect(updated.periodRecords[2]).toBe(stored.periodRecords[2]);
  });
});
