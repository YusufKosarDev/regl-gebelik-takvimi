import type { SQLiteDatabase } from 'expo-sqlite';

import { addPeriodStart } from '../add-period-start';

import type { CycleProfile } from '@/features/cycle/domain/types';
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

function profile(startDates: string[] = ['2026-09-02']): CycleProfile {
  return {
    settings: { averageCycleLengthDays: 30, averagePeriodLengthDays: 6 },
    periodRecords: startDates.map((startDate, index) => ({
      id: `record-${index}`,
      startDate: startDate as ISODate,
      isOngoing: false,
    })),
  };
}

beforeEach(() => {
  loadCycleProfile.mockReset();
  saveCycleProfile.mockReset();
  saveCycleProfile.mockResolvedValue(undefined);
});

describe('addPeriodStart without a saved profile', () => {
  it('refuses to invent one', async () => {
    loadCycleProfile.mockResolvedValue(null);

    await expect(addPeriodStart(db, { startDate: TODAY, today: TODAY })).rejects.toThrow(
      /no saved cycle profile/
    );
  });

  it('writes nothing', async () => {
    loadCycleProfile.mockResolvedValue(null);

    await expect(addPeriodStart(db, { startDate: TODAY, today: TODAY })).rejects.toThrow();

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });
});

describe('addPeriodStart with a valid date', () => {
  beforeEach(() => {
    loadCycleProfile.mockResolvedValue(profile());
  });

  it('adds the record', async () => {
    const updated = await addPeriodStart(db, { startDate: TODAY, today: TODAY });

    expect(updated.periodRecords).toHaveLength(2);
    expect(updated.periodRecords.map((record) => record.startDate)).toContain('2026-09-17');
  });

  it('derives the id from the date', async () => {
    const updated = await addPeriodStart(db, { startDate: TODAY, today: TODAY });
    const added = updated.periodRecords.find((record) => record.startDate === TODAY);

    expect(added?.id).toBe('period-2026-09-17');
  });

  it('leaves the end date unset', async () => {
    const updated = await addPeriodStart(db, { startDate: TODAY, today: TODAY });
    const added = updated.periodRecords.find((record) => record.startDate === TODAY);

    expect(added?.endDate).toBeUndefined();
  });

  it('keeps the settings as they were', async () => {
    const updated = await addPeriodStart(db, { startDate: TODAY, today: TODAY });

    expect(updated.settings).toEqual({ averageCycleLengthDays: 30, averagePeriodLengthDays: 6 });
  });

  it('keeps the records already on file', async () => {
    const updated = await addPeriodStart(db, { startDate: TODAY, today: TODAY });

    expect(updated.periodRecords.map((record) => record.startDate)).toEqual([
      '2026-09-02',
      '2026-09-17',
    ]);
  });

  it('accepts a past date', async () => {
    const updated = await addPeriodStart(db, {
      startDate: '2026-09-10' as ISODate,
      today: TODAY,
    });

    expect(updated.periodRecords.map((record) => record.startDate)).toContain('2026-09-10');
  });

  it('accepts a date in an earlier month', async () => {
    const updated = await addPeriodStart(db, {
      startDate: '2026-08-05' as ISODate,
      today: TODAY,
    });

    expect(updated.periodRecords).toHaveLength(2);
  });

  it('adds to a profile with no records yet', async () => {
    loadCycleProfile.mockResolvedValue(profile([]));

    const updated = await addPeriodStart(db, { startDate: TODAY, today: TODAY });

    expect(updated.periodRecords).toEqual([
      { id: 'period-2026-09-17', startDate: '2026-09-17', isOngoing: true },
    ]);
  });
});

describe('addPeriodStart storage', () => {
  beforeEach(() => {
    loadCycleProfile.mockResolvedValue(profile());
  });

  it('stores exactly what it returns', async () => {
    const updated = await addPeriodStart(db, { startDate: TODAY, today: TODAY });

    expect(saveCycleProfile).toHaveBeenCalledTimes(1);
    expect(saveCycleProfile).toHaveBeenCalledWith(db, updated);
  });

  it('reads before it writes', async () => {
    const order: string[] = [];
    loadCycleProfile.mockImplementation(async () => {
      order.push('load');
      return profile();
    });
    saveCycleProfile.mockImplementation(async () => {
      order.push('save');
    });

    await addPeriodStart(db, { startDate: TODAY, today: TODAY });

    expect(order).toEqual(['load', 'save']);
  });

  it('reads once and writes once', async () => {
    await addPeriodStart(db, { startDate: TODAY, today: TODAY });

    expect(loadCycleProfile).toHaveBeenCalledTimes(1);
    expect(loadCycleProfile).toHaveBeenCalledWith(db);
  });

  it('lets a failed write through', async () => {
    saveCycleProfile.mockRejectedValue(new Error('disk is full'));

    await expect(addPeriodStart(db, { startDate: TODAY, today: TODAY })).rejects.toThrow(
      'disk is full'
    );
  });

  it('lets a failed read through', async () => {
    loadCycleProfile.mockRejectedValue(new Error('corrupt row'));

    await expect(addPeriodStart(db, { startDate: TODAY, today: TODAY })).rejects.toThrow(
      'corrupt row'
    );
  });
});

describe('addPeriodStart rejections', () => {
  beforeEach(() => {
    loadCycleProfile.mockResolvedValue(profile());
  });

  it('refuses a date already on file', async () => {
    await expect(
      addPeriodStart(db, { startDate: '2026-09-02' as ISODate, today: TODAY })
    ).rejects.toThrow(/already recorded on that date/);

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });

  it('refuses tomorrow', async () => {
    await expect(
      addPeriodStart(db, { startDate: '2026-09-18' as ISODate, today: TODAY })
    ).rejects.toThrow(/in the future/);

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });

  it('refuses a date far in the future', async () => {
    await expect(
      addPeriodStart(db, { startDate: '2027-01-01' as ISODate, today: TODAY })
    ).rejects.toThrow(/in the future/);
  });

  it('accepts today itself', async () => {
    await expect(
      addPeriodStart(db, { startDate: TODAY, today: TODAY })
    ).resolves.toBeDefined();
  });

  it('refuses a malformed start date', async () => {
    await expect(
      addPeriodStart(db, { startDate: '17-09-2026' as ISODate, today: TODAY })
    ).rejects.toThrow(/invalid startDate/);
  });

  it('refuses an impossible start date', async () => {
    await expect(
      addPeriodStart(db, { startDate: '2026-02-30' as ISODate, today: TODAY })
    ).rejects.toThrow(/invalid startDate/);
  });

  it('refuses a malformed today', async () => {
    await expect(
      addPeriodStart(db, { startDate: TODAY, today: 'yesterday' as ISODate })
    ).rejects.toThrow(/invalid today/);
  });

  it('checks the date before touching the database', async () => {
    await expect(
      addPeriodStart(db, { startDate: '2026-02-30' as ISODate, today: TODAY })
    ).rejects.toThrow();

    expect(loadCycleProfile).not.toHaveBeenCalled();
  });
});

describe('addPeriodStart purity', () => {
  it('does not mutate the stored profile', async () => {
    const stored = profile();
    const snapshot = JSON.parse(JSON.stringify(stored));
    loadCycleProfile.mockResolvedValue(stored);

    await addPeriodStart(db, { startDate: TODAY, today: TODAY });

    expect(stored).toEqual(snapshot);
    expect(stored.periodRecords).toHaveLength(1);
  });

  it('returns a new records array', async () => {
    const stored = profile();
    loadCycleProfile.mockResolvedValue(stored);

    const updated = await addPeriodStart(db, { startDate: TODAY, today: TODAY });

    expect(updated.periodRecords).not.toBe(stored.periodRecords);
  });
});

describe('addPeriodStart and the ongoing flag', () => {
  it('marks the new record as ongoing', async () => {
    loadCycleProfile.mockResolvedValue(profile());

    const updated = await addPeriodStart(db, { startDate: TODAY, today: TODAY });
    const added = updated.periodRecords.find((record) => record.startDate === TODAY);

    expect(added?.isOngoing).toBe(true);
    expect(added?.endDate).toBeUndefined();
  });

  it('adds a start when the only record is finished with no recorded end', async () => {
    // The state onboarding leaves behind. This has to keep working: it is the
    // very first thing a person does after onboarding.
    loadCycleProfile.mockResolvedValue({
      settings: { averageCycleLengthDays: 30, averagePeriodLengthDays: 6 },
      periodRecords: [
        { id: 'onboarding-initial-period', startDate: '2026-09-02' as ISODate, isOngoing: false },
      ],
    });

    const updated = await addPeriodStart(db, { startDate: TODAY, today: TODAY });

    expect(updated.periodRecords).toHaveLength(2);
    expect(updated.periodRecords[1]).toEqual({
      id: 'period-2026-09-17',
      startDate: '2026-09-17',
      isOngoing: true,
    });
    expect(saveCycleProfile).toHaveBeenCalledTimes(1);
  });

  it('refuses while another period is ongoing', async () => {
    loadCycleProfile.mockResolvedValue({
      settings: { averageCycleLengthDays: 30, averagePeriodLengthDays: 6 },
      periodRecords: [
        { id: 'period-2026-09-10', startDate: '2026-09-10' as ISODate, isOngoing: true },
      ],
    });

    await expect(addPeriodStart(db, { startDate: TODAY, today: TODAY })).rejects.toThrow(
      /already ongoing; end it first/
    );

    expect(saveCycleProfile).not.toHaveBeenCalled();
  });

  it('leaves the existing records alone when it refuses', async () => {
    const stored = {
      settings: { averageCycleLengthDays: 30, averagePeriodLengthDays: 6 },
      periodRecords: [
        { id: 'period-2026-09-10', startDate: '2026-09-10' as ISODate, isOngoing: true },
      ],
    };
    const snapshot = JSON.parse(JSON.stringify(stored));
    loadCycleProfile.mockResolvedValue(stored);

    await expect(addPeriodStart(db, { startDate: TODAY, today: TODAY })).rejects.toThrow();

    expect(stored).toEqual(snapshot);
  });
});
