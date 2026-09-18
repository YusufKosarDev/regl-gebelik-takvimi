import type { SQLiteDatabase } from 'expo-sqlite';

import type { WidgetSnapshotV1 } from '../domain/widget-snapshot-v1';
import {
  isWidgetSnapshotBridgeAvailable,
  saveWidgetSnapshot,
} from '../infrastructure/widget-snapshot-bridge';

import { buildWidgetSnapshotV1 } from './build-widget-snapshot-v1';

import { loadAvatarConfig } from '@/features/avatar/data/avatar-repository';
import { getCycleHomeData } from '@/features/cycle/application/get-cycle-home-data';
import type { ISODate } from '@/types/iso-date';

/**
 * Brings the stored widget snapshot up to date with the database.
 *
 * Reads the same things the home screen reads and writes the result where a
 * widget can find it. No rule is recalculated: the cycle day, the phase and the
 * words all come back from `getCycleHomeData`, which is the one place that
 * decides them, so a widget and the screen cannot end up describing different
 * days.
 *
 * The database stays the source of truth. This only ever copies out of it, so a
 * snapshot that fails to write leaves nothing inconsistent — it leaves the
 * widget stale, which is a different and much smaller problem.
 *
 * It throws, and deliberately: a build without the native bridge says so, and a
 * failed write says so. Callers that must not fail because of it use
 * `syncWidgetSnapshotQuietly` and say in one line why.
 */
export async function syncWidgetSnapshot(
  db: SQLiteDatabase,
  today: ISODate
): Promise<WidgetSnapshotV1> {
  const [home, avatar] = await Promise.all([getCycleHomeData(db, today), loadAvatarConfig(db)]);

  const snapshot = buildWidgetSnapshotV1({
    today,
    cycleDashboard: home?.dashboard ?? null,
    dailySupport: home?.dailySupport ?? null,
    avatar,
  });

  await saveWidgetSnapshot(snapshot);

  return snapshot;
}

/**
 * The same sync, for callers whose own work must not fail because of it.
 *
 * Every screen that changes cycle or avatar data calls this after its write has
 * already succeeded. The write is what the person asked for and it is already
 * durable; refusing it afterwards because a home screen widget could not be
 * updated would throw away real data over a copy of it.
 *
 * Skipped entirely where the native bridge is not built in — Expo Go, and the
 * web build. That is not a stand-in for the bridge: nothing is written and
 * nothing pretends to have been, so a missing widget update stays visibly
 * missing rather than being reported as done.
 *
 * Returns the snapshot when it was written and `null` when it was not, so a
 * caller that wants to know can ask, and the ones that do not can ignore it.
 */
export async function syncWidgetSnapshotQuietly(
  db: SQLiteDatabase,
  today: ISODate
): Promise<WidgetSnapshotV1 | null> {
  if (!isWidgetSnapshotBridgeAvailable()) {
    return null;
  }

  try {
    return await syncWidgetSnapshot(db, today);
  } catch (error) {
    if (__DEV__) {
      console.error('[widget] could not sync the snapshot', error);
    }

    return null;
  }
}
