import type { SQLiteDatabase } from 'expo-sqlite';

import { isAccountDeletionPending } from '@/features/deletion/infrastructure/pending-account-deletion';
import { isFirebaseConfigured } from '@/features/auth/infrastructure/firebase';
import { syncPeriodReminderQuietly } from '@/features/notifications/application/sync-period-reminder';
import { syncPregnancyWeeklyReminderQuietly } from '@/features/notifications/application/sync-pregnancy-weekly-reminder';
import { syncWidgetSnapshotQuietly } from '@/features/widget/application/sync-widget-snapshot';
import { onLocalDataChanged } from '@/shared/data-change/local-data-change';
import { getTodayLocalISODate } from '@/utils/today';
import { logEvent } from '@/shared/logging';

import type { AutomaticSyncSkipReason, AutomaticSyncTrigger } from '../domain/automatic-sync-policy';
import { LOCAL_CHANGE_DEBOUNCE_MS, decideAutomaticSync } from '../domain/automatic-sync-policy';
import { isConflictUnresolved } from '../infrastructure/unresolved-conflict';
import { loadSyncPreferences } from '../infrastructure/sync-preferences';

import { isAutomaticSyncSuspended, resetAutomaticSyncSuspensionForTests } from './automatic-sync-suspension';
import type { CloudSyncOutcome } from './run-cloud-sync';
import { runCloudSync } from './run-cloud-sync';

/**
 * When an automatic sync happens, and — far more often — when it does not.
 *
 * The rules live in `decideAutomaticSync`, which reads nothing and can be
 * proved by reading it. What is here is the part that cannot be pure: a timer,
 * a promise that two callers can share, and the small amount of state that
 * makes "one at a time" true.
 *
 * Nothing here runs while the app is closed. There is no background task and no
 * interval: every sync is the tail of something the person did — opened the
 * app, signed in, edited a record, or closed the app with an edit still
 * pending.
 *
 * It never resolves a conflict. A conflict comes back as an outcome, gets
 * written down, and stops every later automatic run for that account until a
 * person settles it.
 */

/** What a caller needs to hand over, since this module owns no database. */
export type AutomaticSyncContext = {
  readonly db: SQLiteDatabase;
  readonly uid: string;
};

/** How the app tells the scheduler what it is allowed to talk to. */
type SchedulerState = {
  context: AutomaticSyncContext | null;
  inFlight: Promise<CloudSyncOutcome | null> | null;
  lastAttemptAtMs: number | null;
  debounceTimer: ReturnType<typeof setTimeout> | null;
  /** An edit is waiting out its debounce. Used by the flush on the way out. */
  changePending: boolean;
  unsubscribe: (() => void) | null;
  listeners: Set<(outcome: CloudSyncOutcome) => void>;
};

const state: SchedulerState = {
  context: null,
  inFlight: null,
  lastAttemptAtMs: null,
  debounceTimer: null,
  changePending: false,
  unsubscribe: null,
  listeners: new Set(),
};

/** Injected so tests need no real clock. */
let now: () => number = () => Date.now();

/**
 * Names the account this phone may sync, and starts listening for edits.
 *
 * Called when a session appears and again whenever it changes. A different uid
 * throws away everything the old one was waiting on: a debounce started for one
 * account must never fire against another, and a result that arrives late for a
 * session that has gone must not be applied to the one that replaced it.
 */
export function setAutomaticSyncContext(context: AutomaticSyncContext | null): void {
  const previousUid = state.context?.uid ?? null;
  const nextUid = context?.uid ?? null;

  if (previousUid !== nextUid) {
    cancelPendingChange();
    state.lastAttemptAtMs = null;
  }

  state.context = context;

  if (context === null) {
    state.unsubscribe?.();
    state.unsubscribe = null;

    return;
  }

  if (state.unsubscribe === null) {
    state.unsubscribe = onLocalDataChanged(handleLocalDataChanged);
  }
}

/** Drops a waiting debounce without running it. */
function cancelPendingChange(): void {
  if (state.debounceTimer !== null) {
    clearTimeout(state.debounceTimer);
    state.debounceTimer = null;
  }

  state.changePending = false;
}

/** Watches what finished syncs came to. Returns the way to stop watching. */
export function onAutomaticSyncOutcome(listener: (outcome: CloudSyncOutcome) => void): () => void {
  state.listeners.add(listener);

  return () => {
    state.listeners.delete(listener);
  };
}

function announce(outcome: CloudSyncOutcome): void {
  for (const listener of [...state.listeners]) {
    try {
      listener(outcome);
    } catch {
      // A screen that has gone away is not this module's problem.
    }
  }
}

/** An edit landed. Start, or restart, the wait before sending it. */
function handleLocalDataChanged(): void {
  if (state.context === null) {
    return;
  }

  state.changePending = true;

  if (state.debounceTimer !== null) {
    clearTimeout(state.debounceTimer);
  }

  state.debounceTimer = setTimeout(() => {
    state.debounceTimer = null;

    void requestAutomaticSync('local-change');
  }, LOCAL_CHANGE_DEBOUNCE_MS);
}

/**
 * Asks whether a sync may run now, and runs it if so.
 *
 * Returns the outcome, or `null` when a rule said no. Two callers arriving
 * together get the same promise rather than two syncs: a second
 * `pushRemoteSyncState` with the same expected revision would lose the compare
 * and report a conflict that never existed.
 */
export async function requestAutomaticSync(
  trigger: AutomaticSyncTrigger
): Promise<CloudSyncOutcome | null> {
  const context = state.context;

  if (context === null) {
    return null;
  }

  if (state.inFlight !== null) {
    // Joining rather than refusing: the caller wanted a sync, and one is
    // happening. Its result is theirs too.
    return state.inFlight;
  }

  const skip = await shouldSkip(trigger, context.uid);

  if (skip !== null) {
    return null;
  }

  state.lastAttemptAtMs = now();

  if (trigger === 'local-change' || trigger === 'background-flush') {
    state.changePending = false;
  }

  const attempt = runAttempt(context);

  state.inFlight = attempt;

  try {
    return await attempt;
  } finally {
    state.inFlight = null;
  }
}

/** Every reason not to, asked in the order the policy defines. */
async function shouldSkip(
  trigger: AutomaticSyncTrigger,
  uid: string
): Promise<AutomaticSyncSkipReason | null> {
  let automaticSyncEnabled = false;
  let deletionPending = false;
  let conflictUnresolved = false;

  try {
    automaticSyncEnabled = (await loadSyncPreferences()).automaticSyncEnabled;
    deletionPending = await isAccountDeletionPending(uid);
    conflictUnresolved = await isConflictUnresolved(uid);
  } catch (error: unknown) {
    // A preference that cannot be read is not permission to sync.
    logEvent('automatic sync failed', error);

    return 'disabled';
  }

  const decision = decideAutomaticSync({
    trigger,
    automaticSyncEnabled,
    uid,
    firebaseConfigured: isFirebaseConfigured(),
    deletionPending,
    conflictUnresolved,
    suspended: isAutomaticSyncSuspended(),
    inFlight: state.inFlight !== null,
    nowMs: now(),
    lastAttemptAtMs: state.lastAttemptAtMs,
  });

  return decision.kind === 'run' ? null : decision.reason;
}

/**
 * One sync, and what is done with what it came to.
 *
 * The uid is captured before the run and checked after it: a session can end
 * while a sync is in the air, and writing "last synced" or a conflict note for
 * an account that is no longer signed in would be recording something about
 * somebody else's state.
 */
async function runAttempt(context: AutomaticSyncContext): Promise<CloudSyncOutcome | null> {
  const { db, uid } = context;

  let outcome: CloudSyncOutcome;

  try {
    outcome = await runCloudSync({ db, uid });
  } catch (error: unknown) {
    logEvent('automatic sync failed', error);

    return null;
  }

  if (state.context?.uid !== uid) {
    // The account changed underneath this run. Nothing it learned applies.
    return null;
  }

  // Writing the conflict down and recording a settled sync both happen inside
  // runCloudSync, so a sync started by the button and one started here leave
  // exactly the same trail. Nothing to repeat.

  // A pull or a merge rewrote this phone underneath whoever is holding it.
  // The widget and the reminders are copies of what just changed, and every one
  // of these is quiet by contract: a copy that would not refresh is not a
  // reason to undo a sync that already landed.
  if (outcome.kind === 'pulled' || outcome.kind === 'merged') {
    const today = getTodayLocalISODate();

    await syncWidgetSnapshotQuietly(db, today).catch(() => undefined);
    await syncPeriodReminderQuietly(db, today).catch(() => undefined);
    await syncPregnancyWeeklyReminderQuietly(db).catch(() => undefined);
  }

  // Last, so a screen that refetches on hearing this reads a database that has
  // already settled.
  announce(outcome);

  return outcome;
}

/**
 * The app is going away with an edit still waiting.
 *
 * Without this, something written a second before the app was closed would sit
 * on the phone until the next launch — which for somebody who records a period
 * and puts the phone down is the ordinary case, not the edge one.
 *
 * Best effort by definition: the process may not be given long enough. It goes
 * through the same gate and the same rules as every other trigger.
 */
export async function flushPendingAutomaticSync(): Promise<CloudSyncOutcome | null> {
  if (!state.changePending) {
    return null;
  }

  if (state.debounceTimer !== null) {
    clearTimeout(state.debounceTimer);
    state.debounceTimer = null;
  }

  return requestAutomaticSync('background-flush');
}

/** Whether an edit is still waiting out its debounce. */
export function hasPendingLocalChange(): boolean {
  return state.changePending;
}

/** Puts everything back. For tests, and for a wipe that ends the session. */
export function resetAutomaticSyncForTests(overrides?: { now?: () => number }): void {
  cancelPendingChange();
  state.unsubscribe?.();
  state.unsubscribe = null;
  state.context = null;
  state.inFlight = null;
  state.lastAttemptAtMs = null;
  resetAutomaticSyncSuspensionForTests();
  state.listeners.clear();
  now = overrides?.now ?? (() => Date.now());
}
