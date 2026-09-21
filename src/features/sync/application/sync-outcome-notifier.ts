import type { CloudSyncOutcome } from './run-cloud-sync';

/**
 * What finished syncs came to, for whoever is showing something about them.
 *
 * Its own module rather than a part of the scheduler, for the same reason the
 * suspension gate is: import weight. The scheduler reaches Firestore through
 * `runCloudSync`, so announcing from the conflict resolution — or subscribing
 * from a screen — would put the whole Firebase SDK behind anything that only
 * wanted to know a sync had happened.
 *
 * The type comes from `run-cloud-sync`, but only as a type, which is erased.
 *
 * A conflict resolution announces here too. To a screen it is a sync in every
 * way that matters: data moved, and what is on display is now out of date.
 */

const listeners = new Set<(outcome: CloudSyncOutcome) => void>();

/** Watches what finished syncs came to. Returns the way to stop watching. */
export function onSyncOutcome(listener: (outcome: CloudSyncOutcome) => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/**
 * Tells the watchers, and never lets one of them break the sync.
 *
 * Copied before iterating, so a listener that unsubscribes on hearing this does
 * not disturb the walk.
 */
export function announceSyncOutcome(outcome: CloudSyncOutcome): void {
  for (const listener of [...listeners]) {
    try {
      listener(outcome);
    } catch {
      // A screen that has gone away is not this module's problem.
    }
  }
}

/** Drops every listener. For tests, so one case cannot hear another's. */
export function resetSyncOutcomeListenersForTests(): void {
  listeners.clear();
}
