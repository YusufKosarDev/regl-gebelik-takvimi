/**
 * "Something a sync would carry just changed on this phone."
 *
 * One announcement, made in one place, heard by whoever is interested. The
 * alternative was a call beside every write in every screen — ten of them
 * today — where the failure mode is silent and permanent: a mutation added
 * later without the call simply never reaches the account, and nothing says so.
 *
 * It lives in `shared/` for the same reason the logger does. A repository may
 * depend on this floor without depending on the layers above it, and nothing
 * here knows who is listening or what they will do about it — so `data/` stays
 * persistence and the decision to sync stays in `application/`.
 *
 * What it carries is the fact that something changed and where it came from,
 * and nothing else. No table, no row, no value: a listener that needed those
 * would be reading health data out of an event bus, and every listener there is
 * re-reads the database anyway.
 */

/**
 * Who changed it, which is the only thing a listener needs to tell apart.
 *
 * `local` is somebody editing their own data on this phone. It is what schedules
 * a sync.
 *
 * `remote` is a sync writing what it received — a pull, a merge, a restore, a
 * conflict resolved in the cloud's favour. Screens must hear it, because what
 * they are showing has just been replaced underneath them. The sync scheduler
 * must not, or receiving data would schedule a sync of the data just received.
 */
export type LocalDataChangeOrigin = 'local' | 'remote';

type Listener = (origin: LocalDataChangeOrigin) => void;

const listeners = new Set<Listener>();

/**
 * How many suppressions are currently open.
 *
 * A count rather than a flag: a restore runs inside a wipe's suppression in the
 * account-deletion path, and an inner scope closing must not lift the outer
 * one.
 */
let suppressionDepth = 0;

/**
 * Says that the phone's own data changed.
 *
 * Called by the repositories that own the five things a sync can carry, after
 * the write has succeeded — never before, because an announcement for a write
 * that then failed would schedule a sync of data that does not exist.
 *
 * Listener failures are swallowed on purpose. This is called from inside
 * repository functions whose contract is "the write landed"; letting a
 * listener's problem escape would turn a successful save into a thrown error
 * at the call site.
 */
export function notifyLocalDataChanged(origin: LocalDataChangeOrigin = 'local'): void {
  if (suppressionDepth > 0) {
    return;
  }

  for (const listener of [...listeners]) {
    try {
      listener(origin);
    } catch {
      // Not this function's to report, and not worth failing a save over.
    }
  }
}

/** Subscribes, and hands back the way to stop. */
export function onLocalDataChanged(listener: Listener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/**
 * Runs a batch of writes as one change rather than many.
 *
 * A restore rewrites every table through the repositories, each of which would
 * announce a `local` change — a dozen announcements for one event, every one of
 * them wrong about where the data came from. The caller suppresses those and
 * makes a single `remote` announcement of its own afterwards.
 *
 * A wipe suppresses and announces nothing: there is nothing left to show, and
 * the app is on its way back to onboarding.
 *
 * Restores the previous depth even when the body throws, so a failed restore
 * does not leave the app permanently unable to notice edits.
 */
export async function withLocalDataChangeSuppressed<T>(run: () => Promise<T>): Promise<T> {
  suppressionDepth += 1;

  try {
    return await run();
  } finally {
    suppressionDepth -= 1;
  }
}

/** Whether announcements are currently being swallowed. For tests and guards. */
export function isLocalDataChangeSuppressed(): boolean {
  return suppressionDepth > 0;
}

/** Drops every listener. For tests, so one case cannot hear another's. */
export function resetLocalDataChangeListenersForTests(): void {
  listeners.clear();
  suppressionDepth = 0;
}
