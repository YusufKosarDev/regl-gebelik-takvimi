/**
 * One local database write at a time.
 *
 * `db.ts` hands every caller the same connection for the lifetime of the JS
 * runtime, and that is deliberate — see its own doc for the upstream Android
 * NPE that opening the file twice triggers. This is the other half of that
 * decision: one connection means every writer shares one transaction state,
 * so they have to take turns, and nothing in expo-sqlite makes them.
 *
 * ## What goes wrong without it
 *
 * `withTransactionAsync` is a bare `BEGIN` / `COMMIT` / `ROLLBACK` on the
 * shared connection. The library says so itself: *"This transaction is not
 * exclusive and can be interrupted by other async queries."* So while one
 * transaction is open and suspended at an `await` — and a restore has six of
 * them — another task's write runs.
 *
 * If that other write is itself a transaction, its `BEGIN` fails with
 * `cannot start a transaction within a transaction`, its `catch` issues a
 * `ROLLBACK`, and that rollback **undoes the first transaction**, which is
 * still open. The first writer then carries on in autocommit, so its remaining
 * statements land one at a time and keep. It finally tries to `COMMIT`, which
 * fails too, and it reports failure — over a database that now holds half of
 * what it was writing.
 *
 * A single-statement write is no safer. Issued while somebody else's `BEGIN`
 * is open it is simply swallowed into that transaction, and committed or rolled
 * back with work it has nothing to do with.
 *
 * ## Why not `withExclusiveTransactionAsync`
 *
 * Because it is not an exclusive transaction on this connection — it opens a
 * second one. `Transaction.createAsync` builds a new `NativeDatabase` for the
 * same file with `useNewConnection: true`, which is precisely the pattern
 * `db.ts` exists to avoid. Trading a serialisation bug for the NPE is not a
 * trade.
 *
 * ## The rule
 *
 * **Every path that writes the local database takes this lock exactly once, at
 * the highest layer whose work inside it is nothing but local database work.**
 *
 * Two corollaries, and both are load-bearing:
 *
 *   - **Nothing under a `data/` folder takes it.** Repositories are the leaves;
 *     the layer above owns the turn. A repository function cannot know whether
 *     its caller already holds the lock, so it must never ask.
 *   - **Nothing holding network I/O, a system dialog or a notification or
 *     widget rebuild takes it.** Such a function locks the local-only spans
 *     inside it, one acquisition each. A queue held across a Firestore round
 *     trip on mobile data, or across a permission dialog somebody left open,
 *     is a frozen app by another name.
 *
 * ## It is not reentrant, and nesting hangs rather than throws
 *
 * This is a promise chain, not a counter. A second acquisition from inside the
 * first waits on `tail` — which *is* the first call's unsettled result. It
 * never rejects and never times out: the app simply stops, with whatever busy
 * state the screen was showing left on screen.
 *
 * A reentrancy flag would be worse, not better. While the holder is suspended
 * at an `await`, an unrelated task would see the flag set and skip the queue
 * altogether, which is the bug this file exists to prevent wearing the costume
 * of its fix. There is no `AsyncLocalStorage` under Hermes to tell the two
 * apart, so the rule above is the whole defence, and
 * `local-db-write-lock-placement.test.ts` is what keeps it true.
 *
 * ## What this does not do
 *
 * **Reads are not serialised.** A read taken while a holder's transaction is
 * open still sees uncommitted rows. That is unchanged by this module and out of
 * its scope — the export, the backup builder and every screen's focus reload
 * all read without a turn. Do not describe local database access as serialised;
 * writes are. If reads ever need it, they can share this same `tail`.
 *
 * ## Order matters where a suppression is involved
 *
 * `withLocalDataChangeSuppressed` is a global counter, not an async-scoped one.
 * Taken *inside* this lock it is contained by an exclusive span and suppresses
 * only its own writes' announcements. Taken *outside*, it is wider than the
 * lock, and another writer that finishes during it lands on disk and is never
 * announced — never synced, never reloaded by a screen. So the nesting is
 * always `withLocalDbWriteLock( withLocalDataChangeSuppressed( … ) )`, and
 * never the reverse.
 *
 * In-process only, which is what the app is: one JavaScript thread, one
 * connection.
 */

let tail: Promise<unknown> = Promise.resolve();

/**
 * Runs `run` once every write queued before it has finished.
 *
 * A chain rather than a refusal: a caller that arrives while another is running
 * waits instead of being turned away, so nothing a person asked for is dropped.
 * A failure releases the turn exactly as a success does — the rejection belongs
 * to the caller that earned it, not to the next one in line.
 */
export function withLocalDbWriteLock<T>(run: () => Promise<T>): Promise<T> {
  // `tail` is always the caught form below, so it never rejects and a plain
  // `then` is the whole queue. A rejection handler here would be dead code.
  const result = tail.then(run);

  tail = result.catch(() => undefined);

  return result;
}

/** Lets each test start with nobody in the queue. */
export function resetLocalDbWriteLockForTests(): void {
  tail = Promise.resolve();
}
