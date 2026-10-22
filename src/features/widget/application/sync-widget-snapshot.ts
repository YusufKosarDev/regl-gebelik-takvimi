import type { SQLiteDatabase } from 'expo-sqlite';

import type { WidgetSnapshotV1 } from '../domain/widget-snapshot-v1';
import {
  clearWidgetSnapshot,
  isWidgetSnapshotBridgeAvailable,
  saveWidgetSnapshot,
} from '../infrastructure/widget-snapshot-bridge';

import { widgetMessages } from '../presentation/widget-messages';

import { buildWidgetSnapshotV1 } from './build-widget-snapshot-v1';

import { isAppLockEnabled } from '@/features/app-lock/application/remove-app-lock';
import { loadAvatarConfig } from '@/features/avatar/data/avatar-repository';
import { getCycleHomeData } from '@/features/cycle/application/get-cycle-home-data';
import { cycleLabels } from '@/features/cycle/presentation/cycle-labels';
import { currentLanguage } from '@/i18n';
import type { Language } from '@/i18n/language';
import { logEvent } from '@/shared/logging';
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
 *
 * ## The app lock takes the widget with it
 *
 * A widget showing "27. gün · Luteal" sits on the home screen where anybody who
 * picks up the phone reads it — which is exactly the person the lock exists to
 * stop. A lock with a live widget beside it is decoration, so while the lock is
 * on the snapshot is cleared rather than written and the widget falls back to
 * its own empty state.
 *
 * Stated at setup as a consequence rather than discovered later
 * (`SETUP_WIDGET_NOTE`), and unconditional: a second switch would be one more
 * thing to explain and one more way to end up with a lock that does not lock.
 *
 * ## The language is resolved here, not threaded in
 *
 * `currentLanguage()` by default, which is what `getCycleHomeData` already does
 * and documents: two of the callers are not screens — the automatic sync
 * scheduler and the background flush — and neither can call a hook. The card's
 * words are whatever the language is at the moment it is written, which is
 * exactly what a stored snapshot means.
 *
 * Overridable so a test can say which language without moving the device. No
 * caller passes it: the settings screen calls this with two arguments after a
 * language change and lets `currentLanguage()` answer.
 *
 * That is correct, and it rests on something outside this file. It is not that
 * the screen threads the new language in — it does not — but that
 * `setLanguagePreference` writes the store synchronously, before the promise
 * the screen awaits resolves, so by the time this runs `currentLanguage()` is
 * already the language that was just chosen. Written down because it is a
 * dependency on another module's ordering rather than on anything visible
 * here: if that write ever moves after the resolve, the widget starts being
 * rewritten in the language the person just left, and nothing in this file
 * would look wrong.
 *
 * Nothing pins that ordering, which is the reason it is written down rather
 * than merely relied on. `app-store.test.ts` awaits the action and then reads
 * the store, so it passes either way — an `await` gives a deferred write all
 * the microtasks it needs. A test that caught a reversal would have to read the
 * store in the action's own `then`, and there is no such test today.
 */
export async function syncWidgetSnapshot(
  db: SQLiteDatabase,
  today: ISODate,
  language: Language = currentLanguage()
): Promise<WidgetSnapshotV1 | null> {
  if (await isAppLockEnabled()) {
    await clearWidgetSnapshot();

    return null;
  }

  const [home, avatar] = await Promise.all([
    getCycleHomeData(db, today, language),
    loadAvatarConfig(db),
  ]);

  const snapshot = buildWidgetSnapshotV1({
    today,
    cycleDashboard: home?.dashboard ?? null,
    dailySupport: home?.dailySupport ?? null,
    avatar,
    messages: widgetMessages[language],
    labels: cycleLabels[language],
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
  today: ISODate,
  language: Language = currentLanguage()
): Promise<WidgetSnapshotV1 | null> {
  if (!isWidgetSnapshotBridgeAvailable()) {
    return null;
  }

  try {
    return await syncWidgetSnapshot(db, today, language);
  } catch (error) {
    logEvent('widget sync failed', error);

    return null;
  }
}
