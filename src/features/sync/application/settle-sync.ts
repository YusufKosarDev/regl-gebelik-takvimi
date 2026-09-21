import { logEvent } from '@/shared/logging';

import { clearUnresolvedConflict } from '../infrastructure/unresolved-conflict';
import { saveLastSyncAt } from '../infrastructure/last-sync-at';

/**
 * What is true once a sync has finished without a disagreement.
 *
 * Two facts, and both used to be recorded by only some of the paths that earn
 * them, which is how the app ended up claiming things that were not so:
 *
 *   - "last synchronised" was written only by the scheduler, so pressing
 *     "Şimdi senkronize et" left the line under the switch showing a time from
 *     before the sync it had just run.
 *
 *   - the unresolved-conflict note was cleared only by the conflict screen, so
 *     a conflict that had since resolved itself — the other phone's change
 *     pulled in, or the same edit made on both sides — left the notice up and
 *     automatic sync stopped, with the only way out being a screen that would
 *     have shown two identical columns.
 *
 * Both are now recorded here, by every path that reaches a settled state:
 * `runCloudSync` for noop, pushed, pulled and merged, and each side of a
 * conflict resolution. A conflict, a retry and an error settle nothing and do
 * not come here.
 *
 * Neither write is allowed to fail the sync that earned it. The data has
 * already moved; a timestamp that could not be stored is a worse status line,
 * not a worse outcome.
 */
export async function recordSyncSettled(input: {
  readonly uid: string;
  readonly now: () => string;
}): Promise<void> {
  try {
    await saveLastSyncAt(input.now());
  } catch (error: unknown) {
    logEvent('automatic sync failed', error);
  }

  // Cleared unconditionally rather than only when one was set: reading first
  // would be a second round-trip to storage to decide whether to do something
  // idempotent, and a clear with nothing to clear costs nothing.
  try {
    await clearUnresolvedConflict();
  } catch (error: unknown) {
    logEvent('automatic sync failed', error);
  }
}

/** The outcomes that mean this phone and the account agree. */
export function isSettledSyncOutcome(kind: string): boolean {
  return kind === 'noop' || kind === 'pushed' || kind === 'pulled' || kind === 'merged';
}
