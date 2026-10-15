/**
 * One cycle mutation at a time.
 *
 * Every mutating use case in this folder reads the whole profile, edits it
 * in memory and writes it back as a snapshot — the repository's documented
 * shape, kept deliberately because a snapshot cannot drift the way a diff
 * can. What that shape cannot survive on its own is two of them
 * interleaving: both read the same snapshot, and the second write erases
 * the first's change. A double tap was enough.
 *
 * A promise chain rather than a flag: a caller that arrives while another
 * is running waits for it instead of being refused, so nothing a person
 * asked for is dropped. A failure releases the lock like a success — the
 * rejection is the caller's to handle, not the next caller's to inherit.
 *
 * In-process only, which is what the app is: one JavaScript thread, one
 * database connection (`db.ts`). The restore path does not take this lock —
 * it holds the automatic-sync suspension and re-checks its own precondition
 * inside its transaction, which are its guards.
 */

let tail: Promise<unknown> = Promise.resolve();

export function withCycleWriteLock<T>(run: () => Promise<T>): Promise<T> {
  // `tail` is always the caught form below, so it never rejects and a plain
  // `then` is the whole queue. (A rejection handler here would be dead code —
  // a mutation run proved it unreachable.)
  const result = tail.then(run);

  tail = result.catch(() => undefined);

  return result;
}

/** Lets each test start with nobody in the queue. */
export function resetCycleWriteLockForTests(): void {
  tail = Promise.resolve();
}
