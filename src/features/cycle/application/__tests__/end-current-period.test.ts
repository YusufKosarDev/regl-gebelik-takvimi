import type { SQLiteDatabase } from 'expo-sqlite';

import { endCurrentPeriod } from '../end-current-period';

import type { CycleProfile, PeriodRecord } from '@/features/cycle/domain/types';
import type { ISODate } from '@/types/iso-date';

// Only the database is faked. Domain validation stays real, so a profile this
// use case would refuse to store is refused here too.
jest.mock('@/features/cycle/data/cycle-repository', () => ({
  loadCycleProfile: jest.fn(),
  saveCycleProfile: jest.fn(),
}));

const repository = jest.requireMock('@/features/cycle/data/cycle-repository');
const loadCycleProfile = repository.loadCycleProfile as jest.Mock;
const saveCycleProfile = repository.saveCycleProfile as jest.Mock;

const db = {} as SQLiteDatabase;
const TODAY = '2026-09-17' as ISODate;

type Spec = {
  id: string;
  startDate: string;
  endDate?: string;
  isOngoing?: boolean;
};

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

/** One closed record and one ongoing one starting today. */
function typicalProfile(): CycleProfile {
  return profile([
    { id: 'period-2026-08-02', startDate: '2026-08-02', endDate: '2026-08-07' },
    { id: 'period-2026-09-17', startDate: '2026-09-17', isOngoing: true },
  ]);
}

beforeEach(() => {
  loadCycleProfile.mockReset();
  saveCycleProfile.mockReset();
  saveCycleProfile.mockResolvedValue(undefined);
});

describe('endCurrentPeriod input validation', () => {
  it('refuses a malformed end date without touching the database', async () => {
    await expect(
      endCurrentPeriod(db, { endDate: '17-09-2026' as ISODate, today: TODAY })
    ).rejects.toThrow(/invalid endDate/);

    expect(loadCycleProfile).not.toHaveBeenCalled();
  });

  it('refuses an impossible end date', async () => {
    await expect(
      endCurrentPeriod(db, { endDate: '2026-02-30' as ISODate, today: TODAY })
    ).rejects.toThrow(/invalid endDate/);

    expect(loadCycleProfile).not.toHaveBeenCalled();
  });

  it('refuses a malformed today', async () => {
    await expect(
      endCurrentPeriod(db, { endDate: TODAY, today: 'today' as ISODate })
    ).rejects.toThrow(/invalid today/);
  });

  it('refuses a date in the future', async () => {
    await expect(
      endCurrentPeriod(db, { endDate: '2026-09-18' as ISODate, today: TODAY })
    ).rejects.toThrow(/in the future/);

    expect(loadCycleProfile).not.toHaveBeenCalled();
  });
});

describe('endCurrentPeriod without something to end', () => {
  it('refuses when nothing is saved', async () => {
    loadCycleProfile.mockResolvedValue(null);

    await expect(endCurrentPeriod(db, { endDate: TODAY, today: TODAY })).rejects.toThrow(
      /no saved cycle profile/
    );

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });

  it('refuses when no period is open', async () => {
    loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-08-02', endDate: '2026-08-07' }])
    );

    await expect(endCurrentPeriod(db, { endDate: TODAY, today: TODAY })).rejects.toThrow(
      /no open period to end/
    );

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });

  it('refuses when several periods are open', async () => {
    loadCycleProfile.mockResolvedValue(
      profile([
        { id: 'a', startDate: '2026-09-02', isOngoing: true },
        { id: 'b', startDate: '2026-09-17', isOngoing: true },
      ])
    );

    await expect(endCurrentPeriod(db, { endDate: TODAY, today: TODAY })).rejects.toThrow(
      /found 2 ongoing periods/
    );

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });
});

describe('endCurrentPeriod date order', () => {
  it('refuses an end before the start', async () => {
    loadCycleProfile.mockResolvedValue(typicalProfile());

    await expect(
      endCurrentPeriod(db, { endDate: '2026-09-16' as ISODate, today: TODAY })
    ).rejects.toThrow(/before it started on 2026-09-17/);

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });

  it('accepts ending on the day it started', async () => {
    loadCycleProfile.mockResolvedValue(typicalProfile());

    const updated = await endCurrentPeriod(db, { endDate: TODAY, today: TODAY });
    const closed = updated.periodRecords.find((record) => record.id === 'period-2026-09-17');

    expect(closed?.endDate).toBe('2026-09-17');
  });

  it('accepts a later end date', async () => {
    loadCycleProfile.mockResolvedValue(
      profile([{ id: 'period-2026-09-17', startDate: '2026-09-17', isOngoing: true }])
    );

    const updated = await endCurrentPeriod(db, {
      endDate: '2026-09-22' as ISODate,
      today: '2026-09-22' as ISODate,
    });

    expect(updated.periodRecords[0].endDate).toBe('2026-09-22');
  });
});

describe('endCurrentPeriod duration rule', () => {
  it('leaves the length limit to the domain', async () => {
    // 2026-09-01 to 2026-09-21 is 21 days, past the domain's maximum of 20.
    loadCycleProfile.mockResolvedValue(
      profile([{ id: 'period-2026-09-01', startDate: '2026-09-01', isOngoing: true }])
    );

    await expect(
      endCurrentPeriod(db, { endDate: '2026-09-21' as ISODate, today: '2026-09-21' as ISODate })
    ).rejects.toThrow(/spans 21 days, which exceeds the maximum of 20/);

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });

  it('accepts the longest allowed span', async () => {
    loadCycleProfile.mockResolvedValue(
      profile([{ id: 'period-2026-09-01', startDate: '2026-09-01', isOngoing: true }])
    );

    const updated = await endCurrentPeriod(db, {
      endDate: '2026-09-20' as ISODate,
      today: '2026-09-20' as ISODate,
    });

    expect(updated.periodRecords[0].endDate).toBe('2026-09-20');
  });
});

describe('endCurrentPeriod changes only the open record', () => {
  beforeEach(() => {
    loadCycleProfile.mockResolvedValue(
      profile([
        { id: 'period-2026-07-04', startDate: '2026-07-04', endDate: '2026-07-09' },
        { id: 'period-2026-09-17', startDate: '2026-09-17', isOngoing: true },
        { id: 'period-2026-08-02', startDate: '2026-08-02', endDate: '2026-08-07' },
      ])
    );
  });

  it('leaves the other records untouched', async () => {
    const updated = await endCurrentPeriod(db, { endDate: TODAY, today: TODAY });

    expect(updated.periodRecords[0]).toEqual({
      id: 'period-2026-07-04',
      startDate: '2026-07-04',
      endDate: '2026-07-09',
      isOngoing: false,
    });
    expect(updated.periodRecords[2]).toEqual({
      id: 'period-2026-08-02',
      startDate: '2026-08-02',
      endDate: '2026-08-07',
      isOngoing: false,
    });
  });

  it('keeps the order', async () => {
    const updated = await endCurrentPeriod(db, { endDate: TODAY, today: TODAY });

    expect(updated.periodRecords.map((record) => record.id)).toEqual([
      'period-2026-07-04',
      'period-2026-09-17',
      'period-2026-08-02',
    ]);
  });

  it('keeps the start date and id of the record it closes', async () => {
    const updated = await endCurrentPeriod(db, { endDate: TODAY, today: TODAY });

    expect(updated.periodRecords[1]).toEqual({
      id: 'period-2026-09-17',
      startDate: '2026-09-17',
      endDate: '2026-09-17',
      isOngoing: false,
    });
  });

  it('keeps the settings', async () => {
    const updated = await endCurrentPeriod(db, { endDate: TODAY, today: TODAY });

    expect(updated.settings).toEqual({ averageCycleLengthDays: 30, averagePeriodLengthDays: 6 });
  });

  it('leaves nothing open', async () => {
    const updated = await endCurrentPeriod(db, { endDate: TODAY, today: TODAY });

    expect(updated.periodRecords.filter((record) => record.endDate === undefined)).toHaveLength(0);
  });
});

describe('endCurrentPeriod storage', () => {
  beforeEach(() => {
    loadCycleProfile.mockResolvedValue(typicalProfile());
  });

  it('stores exactly what it returns', async () => {
    const updated = await endCurrentPeriod(db, { endDate: TODAY, today: TODAY });

    expect(saveCycleProfile).toHaveBeenCalledTimes(1);
    expect(saveCycleProfile).toHaveBeenCalledWith(db, updated);
  });

  it('reads before it writes', async () => {
    const order: string[] = [];
    loadCycleProfile.mockImplementation(async () => {
      order.push('load');
      return typicalProfile();
    });
    saveCycleProfile.mockImplementation(async () => {
      order.push('save');
    });

    await endCurrentPeriod(db, { endDate: TODAY, today: TODAY });

    expect(order).toEqual(['load', 'save']);
  });

  it('reads once', async () => {
    await endCurrentPeriod(db, { endDate: TODAY, today: TODAY });

    expect(loadCycleProfile).toHaveBeenCalledTimes(1);
    expect(loadCycleProfile).toHaveBeenCalledWith(db);
  });

  it('lets a failed write through', async () => {
    saveCycleProfile.mockRejectedValue(new Error('disk is full'));

    await expect(endCurrentPeriod(db, { endDate: TODAY, today: TODAY })).rejects.toThrow(
      'disk is full'
    );
  });

  it('lets a failed read through', async () => {
    loadCycleProfile.mockRejectedValue(new Error('corrupt row'));

    await expect(endCurrentPeriod(db, { endDate: TODAY, today: TODAY })).rejects.toThrow(
      'corrupt row'
    );
  });
});

describe('endCurrentPeriod purity', () => {
  it('does not mutate the stored profile', async () => {
    const stored = typicalProfile();
    const snapshot = JSON.parse(JSON.stringify(stored));
    loadCycleProfile.mockResolvedValue(stored);

    await endCurrentPeriod(db, { endDate: TODAY, today: TODAY });

    expect(stored).toEqual(snapshot);
    expect(stored.periodRecords[1].endDate).toBeUndefined();
  });

  it('returns a new records array', async () => {
    const stored = typicalProfile();
    loadCycleProfile.mockResolvedValue(stored);

    const updated = await endCurrentPeriod(db, { endDate: TODAY, today: TODAY });

    expect(updated.periodRecords).not.toBe(stored.periodRecords);
  });

  it('leaves the untouched records as the same objects', async () => {
    const stored = typicalProfile();
    loadCycleProfile.mockResolvedValue(stored);

    const updated = await endCurrentPeriod(db, { endDate: TODAY, today: TODAY });

    expect(updated.periodRecords[0]).toBe(stored.periodRecords[0]);
  });
});

describe('endCurrentPeriod and the ongoing flag', () => {
  it('clears the flag on the record it closes', async () => {
    loadCycleProfile.mockResolvedValue(typicalProfile());

    const updated = await endCurrentPeriod(db, { endDate: TODAY, today: TODAY });
    const closed = updated.periodRecords.find((record) => record.id === 'period-2026-09-17');

    expect(closed?.isOngoing).toBe(false);
    expect(closed?.endDate).toBe('2026-09-17');
  });

  it('never picks a finished record whose end was never written down', async () => {
    // The onboarding record. Offering to "finish" it would close a period from
    // weeks ago on today's date.
    loadCycleProfile.mockResolvedValue(
      profile([{ id: 'onboarding-initial-period', startDate: '2026-09-02' }])
    );

    await expect(endCurrentPeriod(db, { endDate: TODAY, today: TODAY })).rejects.toThrow(
      /no open period to end/
    );

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });

  it('picks the ongoing record over one with no recorded end', async () => {
    loadCycleProfile.mockResolvedValue(
      profile([
        { id: 'onboarding-initial-period', startDate: '2026-09-02' },
        { id: 'period-2026-09-17', startDate: '2026-09-17', isOngoing: true },
      ])
    );

    const updated = await endCurrentPeriod(db, { endDate: TODAY, today: TODAY });

    expect(updated.periodRecords[0]).toEqual({
      id: 'onboarding-initial-period',
      startDate: '2026-09-02',
      isOngoing: false,
    });
    expect(updated.periodRecords[1]).toEqual({
      id: 'period-2026-09-17',
      startDate: '2026-09-17',
      endDate: '2026-09-17',
      isOngoing: false,
    });
  });

  it('leaves nothing ongoing afterwards', async () => {
    loadCycleProfile.mockResolvedValue(typicalProfile());

    const updated = await endCurrentPeriod(db, { endDate: TODAY, today: TODAY });

    expect(updated.periodRecords.filter((record) => record.isOngoing)).toHaveLength(0);
  });
});
