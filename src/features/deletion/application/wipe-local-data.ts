import type { SQLiteDatabase } from 'expo-sqlite';

import { getCurrentAuthUser, signOut } from '@/features/auth/data/auth-repository';
import { PERIOD_REMINDER_TYPE } from '@/features/notifications/domain/period-reminder';
import { PREGNANCY_WEEKLY_REMINDER_TYPE } from '@/features/notifications/domain/pregnancy-weekly-reminder';
import { cancelScheduledRemindersOfType } from '@/features/notifications/infrastructure/scheduled-reminders';
import { withAutomaticSyncSuspended } from '@/features/sync/application/automatic-sync-suspension';
import { clearDeviceId } from '@/features/sync/infrastructure/device-id';
import { clearLastSyncAt } from '@/features/sync/infrastructure/last-sync-at';
import { clearUnresolvedConflict } from '@/features/sync/infrastructure/unresolved-conflict';
import { clearSyncPreferences } from '@/features/sync/infrastructure/sync-preferences';
import {
  clearWidgetSnapshot,
  isWidgetSnapshotBridgeAvailable,
} from '@/features/widget/infrastructure/widget-snapshot-bridge';
import { logEvent } from '@/shared/logging';

import { clearAllLocalTables } from '../data/local-data-repository';
import type { LocalWipeOutcome } from '../domain/deletion-outcome';
import { clearPendingAccountDeletion } from '../infrastructure/pending-account-deletion';

/**
 * Everything this phone holds, gone.
 *
 * The order is the whole design, and it has one rule: nothing that hides the
 * data may happen before the data is actually gone.
 *
 *   1. the tables, in one transaction — all or nothing
 *   2. the reminders that would otherwise fire about records that no longer exist
 *   3. the widget, which is a copy of those records sitting on the home screen
 *   4. the small keys: sync preferences, device id, a half-finished deletion
 *   5. the session, if there is one
 *   6. the onboarding flag, last
 *
 * Step 6 is last because it is the switch. `RootLayout` mounts `(onboarding)`
 * the moment it flips, so flipping it earlier would show somebody a fresh
 * welcome screen sitting on top of a database still full of their records.
 *
 * Only step 1 can fail the whole thing. Once the tables are empty the records
 * are gone for good, and refusing to finish because a widget would not redraw
 * would leave the app in a worse state than carrying on — so the rest is best
 * effort and reported as `partial`.
 *
 * The cloud is not touched. This is the device, and saying so is the point of
 * having two separate actions.
 */

export type WipeLocalDataInput = {
  readonly db: SQLiteDatabase;
  /**
   * Resets the store and the onboarding flag.
   *
   * Passed in rather than imported so this stays a use case rather than a thing
   * that reaches into the global store, and so a test can assert it ran last.
   */
  readonly resetAppState: () => Promise<void>;
};

/** Runs a step whose failure must not stop the wipe, and says whether it worked. */
async function bestEffort(step: () => Promise<unknown>, event: 'reminder cancel failed' | 'local data wipe failed'): Promise<boolean> {
  try {
    await step();

    return true;
  } catch (error: unknown) {
    logEvent(event, error);

    return false;
  }
}

/**
 * Signs out when there is a session, and says whether anything went wrong.
 *
 * Asking first rather than signing out unconditionally: with no Firebase
 * project `getCurrentAuthUser` raises, and a build with no accounts has no
 * session to end.
 */
async function endSessionIfAny(): Promise<boolean> {
  try {
    if (getCurrentAuthUser() === null) {
      return true;
    }
  } catch {
    // No project, or no auth to ask. Either way there is nothing to sign out of.
    return true;
  }

  try {
    await signOut();

    return true;
  } catch (error: unknown) {
    logEvent('local data wipe failed', error);

    return false;
  }
}

/**
 * Everything this phone holds, gone.
 *
 * Suspended for the whole run rather than for the table clear alone. A sync
 * landing anywhere inside this would read a half-emptied database and push it,
 * and pushing an empty database is the wipe deleting the account's data too —
 * the one thing "yalnızca bu telefondan sil" promises it will not do.
 */
export async function wipeLocalData(input: WipeLocalDataInput): Promise<LocalWipeOutcome> {
  return withAutomaticSyncSuspended(() => runWipe(input));
}

async function runWipe(input: WipeLocalDataInput): Promise<LocalWipeOutcome> {
  const { db, resetAppState } = input;

  // The one step that decides whether this is a wipe at all.
  try {
    await clearAllLocalTables(db);
  } catch (error: unknown) {
    logEvent('local data wipe failed', error);

    return { kind: 'failed', reason: 'local-failed' };
  }

  let complete = true;

  complete =
    (await bestEffort(
      () => cancelScheduledRemindersOfType(PERIOD_REMINDER_TYPE),
      'reminder cancel failed'
    )) && complete;

  complete =
    (await bestEffort(
      () => cancelScheduledRemindersOfType(PREGNANCY_WEEKLY_REMINDER_TYPE),
      'reminder cancel failed'
    )) && complete;

  // Skipped where the bridge is not built in — Expo Go and the web build. That
  // is not a failure: there is no widget there to be holding anything.
  if (isWidgetSnapshotBridgeAvailable()) {
    complete = (await bestEffort(clearWidgetSnapshot, 'local data wipe failed')) && complete;
  }

  complete = (await bestEffort(clearSyncPreferences, 'local data wipe failed')) && complete;
  complete = (await bestEffort(clearLastSyncAt, 'local data wipe failed')) && complete;
  complete =
    (await bestEffort(clearUnresolvedConflict, 'local data wipe failed')) && complete;
  complete = (await bestEffort(clearDeviceId, 'local data wipe failed')) && complete;
  complete =
    (await bestEffort(clearPendingAccountDeletion, 'local data wipe failed')) && complete;

  complete = (await endSessionIfAny()) && complete;

  // Last, always: this is what sends the app back to onboarding.
  complete = (await bestEffort(resetAppState, 'local data wipe failed')) && complete;

  return complete ? { kind: 'wiped' } : { kind: 'partial' };
}
