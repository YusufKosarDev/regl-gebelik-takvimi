import type { SQLiteDatabase } from 'expo-sqlite';

import { getPeriodHistory } from '../get-period-history';

import type { CycleProfile, PeriodRecord } from '@/features/cycle/domain/types';
import type { ISODate } from '@/types/iso-date';

jest.mock('@/features/cycle/data/cycle-repository', () => ({
  loadCycleProfile: jest.fn(),
  saveCycleProfile: jest.fn(),
}));

const repository = jest.requireMock('@/features/cycle/data/cycle-repository');
const loadCycleProfile = repository.loadCycleProfile as jest.Mock;

const db = {} as SQLiteDatabase;

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

beforeEach(() => {
  loadCycleProfile.mockReset();
  repository.saveCycleProfile.mockReset();
});

describe('getPeriodHistory without a saved profile', () => {
  it('returns null', async () => {
    loadCycleProfile.mockResolvedValue(null);

    await expect(getPeriodHistory(db)).resolves.toBeNull();
  });

  it('reads through the repository', async () => {
    loadCycleProfile.mockResolvedValue(null);

    await getPeriodHistory(db);

    expect(loadCycleProfile).toHaveBeenCalledTimes(1);
    expect(loadCycleProfile).toHaveBeenCalledWith(db);
  });
});

describe('getPeriodHistory with a saved profile', () => {
  it('returns an empty list when nothing is recorded', async () => {
    loadCycleProfile.mockResolvedValue(profile([]));

    await expect(getPeriodHistory(db)).resolves.toEqual([]);
  });

  it('returns the records', async () => {
    loadCycleProfile.mockResolvedValue(
      profile([{ id: 'a', startDate: '2026-09-02', endDate: '2026-09-07' }])
    );

    const history = await getPeriodHistory(db);

    expect(history).toEqual([
      { id: 'a', startDate: '2026-09-02', endDate: '2026-09-07', isOngoing: false },
    ]);
  });

  it('orders them newest first', async () => {
    loadCycleProfile.mockResolvedValue(
      profile([
        { id: 'a', startDate: '2026-08-01' },
        { id: 'b', startDate: '2026-09-17' },
        { id: 'c', startDate: '2026-09-02' },
      ])
    );

    const history = await getPeriodHistory(db);

    expect(history?.map((record) => record.startDate)).toEqual([
      '2026-09-17',
      '2026-09-02',
      '2026-08-01',
    ]);
  });

  it('orders across month and year boundaries', async () => {
    loadCycleProfile.mockResolvedValue(
      profile([
        { id: 'a', startDate: '2025-12-31' },
        { id: 'b', startDate: '2026-01-01' },
        { id: 'c', startDate: '2025-02-28' },
      ])
    );

    const history = await getPeriodHistory(db);

    expect(history?.map((record) => record.startDate)).toEqual([
      '2026-01-01',
      '2025-12-31',
      '2025-02-28',
    ]);
  });

  it('keeps an already ordered list in order', async () => {
    loadCycleProfile.mockResolvedValue(
      profile([
        { id: 'a', startDate: '2026-09-17' },
        { id: 'b', startDate: '2026-09-02' },
      ])
    );

    const history = await getPeriodHistory(db);

    expect(history?.map((record) => record.id)).toEqual(['a', 'b']);
  });

  it('keeps the ongoing flag and end dates intact', async () => {
    loadCycleProfile.mockResolvedValue(
      profile([
        { id: 'a', startDate: '2026-09-02' },
        { id: 'b', startDate: '2026-09-17', isOngoing: true },
      ])
    );

    const history = await getPeriodHistory(db);

    expect(history?.[0]).toEqual({ id: 'b', startDate: '2026-09-17', isOngoing: true });
    expect(history?.[1]).toEqual({ id: 'a', startDate: '2026-09-02', isOngoing: false });
  });
});

describe('getPeriodHistory purity', () => {
  it('does not reorder the stored profile', async () => {
    const stored = profile([
      { id: 'a', startDate: '2026-08-01' },
      { id: 'b', startDate: '2026-09-17' },
      { id: 'c', startDate: '2026-09-02' },
    ]);
    loadCycleProfile.mockResolvedValue(stored);

    await getPeriodHistory(db);

    expect(stored.periodRecords.map((record) => record.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the profile at all', async () => {
    const stored = profile([
      { id: 'a', startDate: '2026-08-01' },
      { id: 'b', startDate: '2026-09-17' },
    ]);
    const snapshot = JSON.parse(JSON.stringify(stored));
    loadCycleProfile.mockResolvedValue(stored);

    await getPeriodHistory(db);

    expect(stored).toEqual(snapshot);
  });

  it('returns a new array', async () => {
    const stored = profile([{ id: 'a', startDate: '2026-09-02' }]);
    loadCycleProfile.mockResolvedValue(stored);

    const history = await getPeriodHistory(db);

    expect(history).not.toBe(stored.periodRecords);
  });

  it('writes nothing', async () => {
    loadCycleProfile.mockResolvedValue(profile([{ id: 'a', startDate: '2026-09-02' }]));

    await getPeriodHistory(db);

    expect(repository.saveCycleProfile).not.toHaveBeenCalled();
  });
});

describe('getPeriodHistory failures', () => {
  it('lets a repository error through', async () => {
    loadCycleProfile.mockRejectedValue(new Error('corrupt row'));

    await expect(getPeriodHistory(db)).rejects.toThrow('corrupt row');
  });
});
