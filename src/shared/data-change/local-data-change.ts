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
 * What it carries is the fact that something changed, and nothing else. No
 * table, no row, no value: a listener that needed those would be reading health
 * data out of an event bus, and the only listener there is re-reads the
 * database anyway.
 */

type Listener = () => void;

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
export function notifyLocalDataChanged(): void {
  if (suppressionDepth > 0) {
    return;
  }

  for (const listener of [...listeners]) {
    try {
      listener();
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
 * Runs something without any of its writes counting as a local change.
 *
 * For the writes that are not somebody editing their data: a restore and a
 * merge are the *result* of a sync, and letting them announce a change would
 * schedule another sync of what was just received — a loop that settles only
 * because the second sync finds nothing to do. A wipe is the same in reverse:
 * there is nothing left to send, and the account is deliberately not being
 * touched.
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
