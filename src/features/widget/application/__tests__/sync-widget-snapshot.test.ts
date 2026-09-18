import type { SQLiteDatabase } from 'expo-sqlite';

import type { AvatarConfig } from '@/features/avatar/domain/avatar-config';
import type { CycleProfile } from '@/features/cycle/domain/types';
import type { ISODate } from '@/types/iso-date';
import {
  syncWidgetSnapshot,
  syncWidgetSnapshotQuietly,
} from '@/features/widget/application/sync-widget-snapshot';

// Only the database reads and the native bridge are faked. The dashboard, the
// daily support lookup, the snapshot builder and every validation rule stay
// real, so what this pins is the wiring rather than a restatement of it.
jest.mock('@/features/cycle/data/cycle-repository', () => ({
  loadCycleProfile: jest.fn(),
  saveCycleProfile: jest.fn(),
}));

jest.mock('@/features/avatar/data/avatar-repository', () => ({
  loadAvatarConfig: jest.fn(),
  saveAvatarConfig: jest.fn(),
}));

jest.mock('@/features/widget/infrastructure/widget-snapshot-bridge', () => ({
  isWidgetSnapshotBridgeAvailable: jest.fn(),
  saveWidgetSnapshot: jest.fn(),
  loadWidgetSnapshot: jest.fn(),
  clearWidgetSnapshot: jest.fn(),
}));

const cycleRepository = jest.requireMock('@/features/cycle/data/cycle-repository');
const avatarRepository = jest.requireMock('@/features/avatar/data/avatar-repository');
const bridge = jest.requireMock('@/features/widget/infrastructure/widget-snapshot-bridge');

const db = {} as SQLiteDatabase;
const date = (value: string) => value as ISODate;

/** Cycle 28 from 2026-09-01: day 1-5 menstrual, 14 ovulatory, 15 on luteal. */
function profile(startDates: string[] = ['2026-09-01']): CycleProfile {
  return {
    settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
    periodRecords: startDates.map((startDate, index) => ({
      id: `record-${index}`,
      startDate: date(startDate),
      isOngoing: false,
    })),
  };
}

function avatar(overrides: Partial<AvatarConfig> = {}): AvatarConfig {
  return {
    skinToneId: 'skin-tone-4',
    hairStyleId: 'bun',
    hairColorId: 'red',
    outfitId: 'dress',
    ...overrides,
  };
}

beforeEach(() => {
  cycleRepository.loadCycleProfile.mockReset();
  cycleRepository.loadCycleProfile.mockResolvedValue(profile());
  cycleRepository.saveCycleProfile.mockReset();
  avatarRepository.loadAvatarConfig.mockReset();
  avatarRepository.loadAvatarConfig.mockResolvedValue(avatar());
  avatarRepository.saveAvatarConfig.mockReset();
  bridge.saveWidgetSnapshot.mockReset();
  bridge.saveWidgetSnapshot.mockResolvedValue(undefined);
  bridge.isWidgetSnapshotBridgeAvailable.mockReset();
  bridge.isWidgetSnapshotBridgeAvailable.mockReturnValue(true);
});

/** The snapshot handed to the bridge on the first write. */
function written() {
  return bridge.saveWidgetSnapshot.mock.calls[0][0];
}

describe('syncWidgetSnapshot writing the snapshot', () => {
  it('writes exactly once', async () => {
    await syncWidgetSnapshot(db, date('2026-09-18'));

    expect(bridge.saveWidgetSnapshot).toHaveBeenCalledTimes(1);
  });

  it('records the day it was asked about', async () => {
    await syncWidgetSnapshot(db, date('2026-09-18'));

    expect(written().date).toBe('2026-09-18');
    expect(written().version).toBe(1);
  });

  it('returns what it wrote', async () => {
    const snapshot = await syncWidgetSnapshot(db, date('2026-09-18'));

    expect(snapshot).toEqual(written());
  });

  it('brings the cycle, the words and the avatar together', async () => {
    await syncWidgetSnapshot(db, date('2026-09-18'));

    expect(written()).toEqual({
      version: 1,
      date: '2026-09-18',
      cycleDay: 18,
      phase: 'luteal',
      moodLabels: expect.arrayContaining(['Ruh hali dalgalanmaları olabilir']),
      supportMessage: expect.stringContaining('Regl öncesi günlerde'),
      avatar: avatar(),
    });
  });

  it.each([
    ['2026-09-03', 3, 'menstrual'],
    ['2026-09-10', 10, 'follicular'],
    ['2026-09-14', 14, 'ovulatory'],
    ['2026-09-20', 20, 'luteal'],
  ] as const)('copies the day and phase for %s', async (today, cycleDay, phase) => {
    await syncWidgetSnapshot(db, date(today));

    expect(written().cycleDay).toBe(cycleDay);
    expect(written().phase).toBe(phase);
  });

  it('leaves the mood key off for a phase that says nothing about it', async () => {
    await syncWidgetSnapshot(db, date('2026-09-14'));

    expect('moodLabels' in written()).toBe(false);
    expect(written().supportMessage).toContain('Yumurtlama günlerinde');
  });

  it('reads each source once', async () => {
    await syncWidgetSnapshot(db, date('2026-09-18'));

    expect(cycleRepository.loadCycleProfile).toHaveBeenCalledTimes(1);
    expect(avatarRepository.loadAvatarConfig).toHaveBeenCalledTimes(1);
  });

  it('writes nothing to the database', async () => {
    await syncWidgetSnapshot(db, date('2026-09-18'));

    expect(cycleRepository.saveCycleProfile).not.toHaveBeenCalled();
    expect(avatarRepository.saveAvatarConfig).not.toHaveBeenCalled();
  });
});

describe('syncWidgetSnapshot with some of it missing', () => {
  it('writes a null avatar when none is saved', async () => {
    avatarRepository.loadAvatarConfig.mockResolvedValue(null);

    await syncWidgetSnapshot(db, date('2026-09-18'));

    expect(written().avatar).toBeNull();
    expect(written().phase).toBe('luteal');
  });

  it('writes a null phase and day on a date with no cycle day', async () => {
    await syncWidgetSnapshot(db, date('2026-08-25'));

    expect(written().cycleDay).toBeNull();
    expect(written().phase).toBeNull();
    expect(written().supportMessage).toBeNull();
    expect('moodLabels' in written()).toBe(false);
  });

  it('keeps the avatar on a date with no cycle day', async () => {
    await syncWidgetSnapshot(db, date('2026-08-25'));

    expect(written().avatar).toEqual(avatar());
  });

  it('writes an almost empty snapshot when nothing is recorded at all', async () => {
    cycleRepository.loadCycleProfile.mockResolvedValue(null);
    avatarRepository.loadAvatarConfig.mockResolvedValue(null);

    await syncWidgetSnapshot(db, date('2026-09-18'));

    expect(written()).toEqual({
      version: 1,
      date: '2026-09-18',
      cycleDay: null,
      phase: null,
      supportMessage: null,
      avatar: null,
    });
  });
});

describe('syncWidgetSnapshot when something fails', () => {
  it('passes a bridge failure on', async () => {
    bridge.saveWidgetSnapshot.mockRejectedValue(new Error('preferences are unwritable'));

    await expect(syncWidgetSnapshot(db, date('2026-09-18'))).rejects.toThrow(
      'preferences are unwritable'
    );
  });

  it('passes a database failure on', async () => {
    cycleRepository.loadCycleProfile.mockRejectedValue(new Error('disk is gone'));

    await expect(syncWidgetSnapshot(db, date('2026-09-18'))).rejects.toThrow('disk is gone');
  });

  it('writes nothing when the database read fails', async () => {
    avatarRepository.loadAvatarConfig.mockRejectedValue(new Error('disk is gone'));

    await expect(syncWidgetSnapshot(db, date('2026-09-18'))).rejects.toThrow();

    expect(bridge.saveWidgetSnapshot).not.toHaveBeenCalled();
  });

  it('refuses a date that is not one', async () => {
    // The cycle domain refuses it first, which is the right place for it to be
    // caught; what matters here is that nothing reaches the bridge.
    await expect(syncWidgetSnapshot(db, date('2026-02-30'))).rejects.toThrow(
      /invalid targetDate|invalid date/
    );
    expect(bridge.saveWidgetSnapshot).not.toHaveBeenCalled();
  });
});

describe('syncWidgetSnapshotQuietly', () => {
  it('writes the same snapshot', async () => {
    const snapshot = await syncWidgetSnapshotQuietly(db, date('2026-09-18'));

    expect(bridge.saveWidgetSnapshot).toHaveBeenCalledTimes(1);
    expect(snapshot).toEqual(written());
  });

  it('swallows a bridge failure and says so with null', async () => {
    bridge.saveWidgetSnapshot.mockRejectedValue(new Error('preferences are unwritable'));

    await expect(syncWidgetSnapshotQuietly(db, date('2026-09-18'))).resolves.toBeNull();
  });

  it('swallows a database failure too', async () => {
    cycleRepository.loadCycleProfile.mockRejectedValue(new Error('disk is gone'));

    await expect(syncWidgetSnapshotQuietly(db, date('2026-09-18'))).resolves.toBeNull();
  });

  it('does nothing at all where the bridge is not built in', async () => {
    bridge.isWidgetSnapshotBridgeAvailable.mockReturnValue(false);

    await expect(syncWidgetSnapshotQuietly(db, date('2026-09-18'))).resolves.toBeNull();

    // Not even a read: there is nowhere to put the answer.
    expect(cycleRepository.loadCycleProfile).not.toHaveBeenCalled();
    expect(avatarRepository.loadAvatarConfig).not.toHaveBeenCalled();
    expect(bridge.saveWidgetSnapshot).not.toHaveBeenCalled();
  });

  it('pretends nothing was written when nothing was', async () => {
    bridge.isWidgetSnapshotBridgeAvailable.mockReturnValue(false);

    const snapshot = await syncWidgetSnapshotQuietly(db, date('2026-09-18'));

    expect(snapshot).toBeNull();
  });

  it('leaves the database untouched when it fails', async () => {
    bridge.saveWidgetSnapshot.mockRejectedValue(new Error('preferences are unwritable'));

    await syncWidgetSnapshotQuietly(db, date('2026-09-18'));

    expect(cycleRepository.saveCycleProfile).not.toHaveBeenCalled();
    expect(avatarRepository.saveAvatarConfig).not.toHaveBeenCalled();
  });
});
