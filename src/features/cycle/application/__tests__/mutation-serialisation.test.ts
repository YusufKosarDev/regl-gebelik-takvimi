import type { SQLiteDatabase } from 'expo-sqlite';

import { addPeriodStart } from '../add-period-start';
import { updateCycleSettings } from '../update-cycle-settings';

import type { CycleProfile } from '@/features/cycle/domain/types';
import {
  resetLocalDbWriteLockForTests,
  withLocalDbWriteLock,
} from '@/storage/local-db-write-lock';
import { toISODate } from '@/utils/date';

/**
 * One cycle mutation at a time.
 *
 * Every mutating use case reads the whole profile, edits it in memory and
 * writes it back as a snapshot — the repository's documented shape, kept
 * deliberately. What that shape cannot survive is two of them interleaving:
 * both read the same snapshot, and the second write erases the first's
 * change. A double tap was enough — a just-added period vanished, a
 * just-ended one went back to running.
 *
 * The lock holds them in a line: the second read happens only after the
 * first write has landed, so it reads a snapshot that includes it.
 */

jest.mock('@/features/cycle/data/cycle-repository', () => ({
  loadCycleProfile: jest.fn(),
  saveCycleProfile: jest.fn(),
}));

const repository = jest.requireMock('@/features/cycle/data/cycle-repository');
const loadCycleProfile = repository.loadCycleProfile as jest.Mock;
const saveCycleProfile = repository.saveCycleProfile as jest.Mock;

const db = {} as SQLiteDatabase;
const TODAY = toISODate('2026-09-17');

function emptyProfile(): CycleProfile {
  return {
    settings: { averageCycleLengthDays: 30, averagePeriodLengthDays: 6 },
    periodRecords: [],
  };
}

/** Lets pending microtasks settle without real timers. */
async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  resetLocalDbWriteLockForTests();
  loadCycleProfile.mockReset();
  saveCycleProfile.mockReset();
  saveCycleProfile.mockResolvedValue(undefined);
});

describe('two mutations arriving together', () => {
  it('makes the second read wait for the first write', async () => {
    const order: string[] = [];
    let releaseFirstLoad: () => void = () => undefined;

    loadCycleProfile
      .mockImplementationOnce(() => {
        order.push('load-1');

        return new Promise<CycleProfile>((resolve) => {
          releaseFirstLoad = () => resolve(emptyProfile());
        });
      })
      .mockImplementationOnce(async () => {
        order.push('load-2');

        return emptyProfile();
      });
    saveCycleProfile.mockImplementation(async () => {
      order.push('save');
    });

    const first = addPeriodStart(db, { startDate: toISODate('2026-09-02'), today: TODAY });
    const second = addPeriodStart(db, { startDate: toISODate('2026-09-16'), today: TODAY });

    await settle();

    // The second has not even read yet: it is in the queue, not in the race.
    expect(order).toEqual(['load-1']);

    releaseFirstLoad();
    await first;
    await second;

    expect(order).toEqual(['load-1', 'save', 'load-2', 'save']);
  });

  it('holds different use cases in the same line', async () => {
    const order: string[] = [];
    let releaseFirstLoad: () => void = () => undefined;

    loadCycleProfile
      .mockImplementationOnce(() => {
        order.push('load-start');

        return new Promise<CycleProfile>((resolve) => {
          releaseFirstLoad = () => resolve(emptyProfile());
        });
      })
      .mockImplementationOnce(async () => {
        order.push('load-settings');

        return emptyProfile();
      });
    saveCycleProfile.mockImplementation(async () => {
      order.push('save');
    });

    const first = addPeriodStart(db, { startDate: toISODate('2026-09-02'), today: TODAY });
    const second = updateCycleSettings(db, {
      averageCycleLengthDays: 28,
      averagePeriodLengthDays: 5,
    });

    await settle();
    releaseFirstLoad();
    await first;
    await second;

    expect(order).toEqual(['load-start', 'save', 'load-settings', 'save']);
  });
});

describe('the lock itself', () => {
  it('runs the next caller even when the previous one failed', async () => {
    const failed = withLocalDbWriteLock(async () => {
      throw new Error('validation said no');
    });

    await expect(failed).rejects.toThrow('validation said no');

    await expect(withLocalDbWriteLock(async () => 'ran')).resolves.toBe('ran');
  });

  it('hands each caller its own result', async () => {
    const [a, b] = await Promise.all([
      withLocalDbWriteLock(async () => 'a'),
      withLocalDbWriteLock(async () => 'b'),
    ]);

    expect(a).toBe('a');
    expect(b).toBe('b');
  });
});
