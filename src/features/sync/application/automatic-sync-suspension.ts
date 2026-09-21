/**
 * A gate that holds automatic sync off while something else owns the data.
 *
 * Its own module rather than a part of the scheduler, and the reason is import
 * weight. A wipe, a restore and a conflict resolution all need to close this
 * gate; the scheduler reaches Firestore through `runCloudSync`, so importing it
 * from `wipeLocalData` would put the whole Firebase SDK behind the settings
 * screen, which does nothing with any of it.
 *
 * What is here is a counter and two functions. No storage, no clock, nothing
 * that fails.
 *
 * Counted rather than a flag: a restore runs inside a wipe's suspension in the
 * account-deletion path, and an inner scope closing must not lift the outer
 * one.
 */

let suspensionDepth = 0;

/**
 * Runs something with automatic sync held off for the whole of it.
 *
 * A sync landing in the middle of a wipe or a restore would read a
 * half-written database and push it. Lifted in a `finally`, so a failure does
 * not leave the app permanently unable to sync.
 */
export async function withAutomaticSyncSuspended<T>(run: () => Promise<T>): Promise<T> {
  suspensionDepth += 1;

  try {
    return await run();
  } finally {
    suspensionDepth -= 1;
  }
}

/** Whether the gate is currently shut. */
export function isAutomaticSyncSuspended(): boolean {
  return suspensionDepth > 0;
}

/** Opens it, whatever happened. For tests only. */
export function resetAutomaticSyncSuspensionForTests(): void {
  suspensionDepth = 0;
}
