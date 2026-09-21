import type { SQLiteDatabase } from 'expo-sqlite';

import { AuthError } from '@/features/auth/domain/auth-error';
import { restoreCloudBackup } from '@/features/backup/application/restore-cloud-backup';
import { buildCloudSyncPayloadV1 } from '@/features/privacy/application/build-cloud-sync-payload-v1';
import type { CloudSyncPayloadV1 } from '@/features/privacy/domain/cloud-sync-payload-v1';

import {
  CloudSyncDocumentError,
  NO_REMOTE_REVISION,
  loadRemoteSyncState,
  pushRemoteSyncState,
} from '../data/cloud-sync-repository';
import { loadSyncState, saveSyncState } from '../data/sync-state-repository';
import type { CloudBackupEnvelopeV1 } from '../domain/cloud-backup-envelope-v1';
import { cloudSyncContentHash } from '../domain/cloud-sync-hash';
import { decideSync } from '../domain/decide-sync';
import type { CloudSyncConflict } from '../domain/merge-cloud-sync-payload';
import { mergeCloudSyncPayload } from '../domain/merge-cloud-sync-payload';
import type { DeviceIdProvider } from '../infrastructure/device-id';
import { deviceIdProvider } from '../infrastructure/device-id';

/**
 * One sync, from end to end.
 *
 * The pieces already exist and each of them is provable on its own: `decideSync`
 * says what should happen, `mergeCloudSyncPayload` says how two histories fit
 * together, the repositories read and write. This is the only place that knows
 * the order to call them in, and it is deliberately the only place — the rules
 * stay where they can be tested without a database, and what is left here is
 * sequencing.
 *
 * One caller, and it is a button. The account screen's "Şimdi senkronize et"
 * runs this and nothing else does: there is no trigger, no listener, no timer
 * and no sign-in hook. A sync happens because a person asked for one.
 *
 * The automatic sync preference does not change that. It records what someone
 * chose and nothing acts on it yet, so turning it on starts no background work
 * — see `../infrastructure/sync-preferences`.
 *
 * Two things it will not do, whatever happens:
 *
 *   - overwrite the phone with something the account did not accept. The remote
 *     write goes first, and the local one only happens once the account has the
 *     same thing.
 *   - move the base forward past a write that did not land. The base is what
 *     every later decision is measured from, and a base that claims an agreement
 *     that never happened turns one failed sync into a wrong answer for good.
 */

/** Why a sync could not run, in words a screen can use. */
export type CloudSyncFailure =
  /** Nobody is signed in, so there is no account to sync with. */
  | 'signed-out'
  /** This build has no Firebase project. */
  | 'not-configured'
  /** The rules refused it, or the session is no longer good. */
  | 'invalid-credentials'
  /** It did not reach the server. */
  | 'network-failed'
  /** The stored backup is there and is not something this app can read. */
  | 'unreadable-backup'
  /** The phone's own database could not be read or written. */
  | 'local-failed'
  | 'unknown';

/**
 * What one sync came to.
 *
 * A conflict is one of these rather than a thrown error, because it is an
 * ordinary outcome: two phones used in the same week will produce them, and
 * something a person is going to be asked about is not an exception.
 *
 * `retry-required` is the same kind of thing. It means the account moved while
 * this sync was working — somebody else's write landed first — and the answer
 * is to look again, not to insist.
 */
export type CloudSyncOutcome =
  /** Both sides already held the same thing. */
  | { readonly kind: 'noop'; readonly revision: number }
  /** What was on the phone is now in the account. */
  | { readonly kind: 'pushed'; readonly revision: number }
  /** What was in the account is now on the phone. */
  | { readonly kind: 'pulled'; readonly revision: number }
  /** Both had changed, and the two sets of changes fitted together. */
  | { readonly kind: 'merged'; readonly revision: number }
  /** Somebody has to choose. Nothing was written on either side. */
  | {
      readonly kind: 'conflict';
      readonly reason: CloudSyncConflictOutcomeReason;
      readonly conflicts: readonly CloudSyncConflict[];
    }
  /** The account moved underneath this sync. Nothing was written. */
  | { readonly kind: 'retry-required'; readonly actualRevision: number }
  | { readonly kind: 'error'; readonly failure: CloudSyncFailure };

/**
 * Why a conflict could not be settled here.
 *
 * `unresolved` is the ordinary one: there is a base, the merge ran, and some of
 * it needs a person. `conflicts` lists exactly which parts.
 *
 * `no-base` is the other: this device has never synced this account, both sides
 * hold something, and there is no agreed starting point to measure either
 * against. A three-way merge cannot be run at all, so there is nothing to list —
 * the question is the blunt one, whether to keep the phone's or the account's,
 * and it is not this function's to answer.
 */
export type CloudSyncConflictOutcomeReason = 'unresolved' | 'no-base';

export type RunCloudSyncInput = {
  readonly db: SQLiteDatabase;
  /** The signed-in account. Anything else means there is nothing to sync with. */
  readonly uid: string | null | undefined;
  /** Injectable so a test needs no device storage. */
  readonly deviceId?: DeviceIdProvider;
  /** Injectable so a test's base rows are not dated by the wall clock. */
  readonly now?: () => string;
};

/**
 * How many times one call will go round.
 *
 * Two. A compare-and-set that lost means the account changed a moment ago, and
 * one more look is usually enough to find it settled; a loop that kept trying
 * would be a device competing with another device, on someone's mobile data,
 * with no one having asked it to. Twice, and then the caller is told.
 */
const MAX_SYNC_ATTEMPTS = 2;

/**
 * A failure that came from the phone's own database rather than from the
 * network.
 *
 * Its own type so the two are never confused. "Could not reach the server" and
 * "could not read this phone" lead to different things being said and different
 * things being tried, and an unlabelled error would make one look like the
 * other.
 */
class LocalStoreError extends Error {
  constructor() {
    super('The local store could not be read or written.');

    this.name = 'LocalStoreError';
  }
}

/**
 * Runs something against the phone's database, labelling anything it throws.
 *
 * The original error is dropped rather than wrapped. A SQLite error quotes the
 * statement it failed on, and those statements carry period dates as bound
 * parameters in every other repository in this app; there is nothing in the
 * message worth the risk of carrying it upward.
 */
async function onThisPhone<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch {
    throw new LocalStoreError();
  }
}

function isoNow(): string {
  // An instant, not a day in a cycle: there is no calendar arithmetic here to
  // get wrong, and this is exactly what `Date` is for.
  return new Date().toISOString();
}

/** What a thrown failure means to whoever asked for a sync. */
function failureOf(error: unknown): CloudSyncFailure {
  if (error instanceof LocalStoreError) {
    return 'local-failed';
  }

  if (error instanceof CloudSyncDocumentError) {
    return 'unreadable-backup';
  }

  if (error instanceof AuthError) {
    if (
      error.code === 'not-configured' ||
      error.code === 'network-failed' ||
      error.code === 'invalid-credentials'
    ) {
      return error.code;
    }

    return 'unknown';
  }

  return 'unknown';
}

/**
 * Writes down what the two sides now agree on.
 *
 * Exactly the envelope that was stored or read: its revision, its hash and the
 * payload it carries. Anything assembled from somewhere else would be a base
 * describing an agreement that did not happen.
 *
 * `updatedAt` is the server's stamp where there is one. There is not one on an
 * envelope this device has just written — the server stamps it after the write,
 * and this device has not read it back — so the clock stands in. Nothing decides
 * anything from this field; it is here to be shown to a person.
 */
async function rememberAgreement(
  db: SQLiteDatabase,
  uid: string,
  envelope: CloudBackupEnvelopeV1,
  now: () => string
): Promise<void> {
  await onThisPhone(() =>
    saveSyncState(db, {
      uid,
      revision: envelope.revision,
      contentHash: envelope.contentHash,
      basePayload: envelope.payload,
      updatedAt: envelope.updatedAt ?? now(),
    })
  );
}

/** Writes a payload over what is on the phone, in one transaction. */
async function applyToThisPhone(db: SQLiteDatabase, payload: CloudSyncPayloadV1): Promise<void> {
  // The restore use case, reused rather than reimplemented: it is already the
  // one operation that writes a whole payload atomically, and a second way to
  // do it would be a second thing to keep correct.
  await onThisPhone(() => restoreCloudBackup(db, payload));
}

type Attempt = {
  readonly db: SQLiteDatabase;
  readonly uid: string;
  readonly deviceId: DeviceIdProvider;
  readonly now: () => string;
};

/**
 * One pass: read everything, decide, carry it out.
 *
 * The three reads happen before anything is decided, and nothing is decided
 * from a value read after a write. A pass that looked again halfway would be
 * deciding from two different moments.
 */
async function attemptSync(attempt: Attempt): Promise<CloudSyncOutcome> {
  const { db, uid, now } = attempt;

  const local = await onThisPhone(() => buildCloudSyncPayloadV1(db));
  const state = await onThisPhone(() => loadSyncState(db, uid));
  const remote = await loadRemoteSyncState(uid);

  const decision = decideSync({
    base: state === null ? null : { revision: state.revision, contentHash: state.contentHash },
    local: { contentHash: cloudSyncContentHash(local) },
    remote: remote === null ? null : { revision: remote.revision, contentHash: remote.contentHash },
  });

  if (decision === 'noop') {
    // Nothing to carry either way. The base still moves forward when it is
    // behind: the two sides agreeing is the agreement, and a base that does not
    // record it would make the next sync ask the same question again — and, on
    // a device whose last sync was interrupted between the two writes, keep
    // asking it forever.
    if (remote === null) {
      return { kind: 'error', failure: 'unknown' };
    }

    if (
      state !== null &&
      state.revision === remote.revision &&
      state.contentHash === remote.contentHash
    ) {
      return { kind: 'noop', revision: remote.revision };
    }

    await rememberAgreement(db, uid, remote, now);

    return { kind: 'noop', revision: remote.revision };
  }

  if (decision === 'push') {
    const stored = await pushRemoteSyncState({
      uid,
      // No document and a document nobody counted are the same expectation: the
      // repository reports both as `NO_REMOTE_REVISION`, and the first counted
      // write lands on revision 1 either way.
      expectedRevision: remote === null ? NO_REMOTE_REVISION : remote.revision,
      payload: local,
      deviceId: await onThisPhone(attempt.deviceId),
    });

    if (stored.kind === 'conflict') {
      return { kind: 'retry-required', actualRevision: stored.actualRevision };
    }

    await rememberAgreement(db, uid, stored.envelope, now);

    return { kind: 'pushed', revision: stored.envelope.revision };
  }

  if (decision === 'pull') {
    if (remote === null) {
      return { kind: 'error', failure: 'unknown' };
    }

    await applyToThisPhone(db, remote.payload);
    await rememberAgreement(db, uid, remote, now);

    return { kind: 'pulled', revision: remote.revision };
  }

  if (remote === null || state === null) {
    // Nothing agreed to measure from. `decideSync` answers `conflict` here
    // rather than guessing, and so does this.
    return { kind: 'conflict', reason: 'no-base', conflicts: [] };
  }

  const merged = mergeCloudSyncPayload({
    base: state.basePayload,
    local,
    remote: remote.payload,
  });

  if (merged.kind === 'conflict') {
    // Not one write, on either side. The payload a merge hands back in this
    // case holds what was last agreed wherever the two sides disagree, and
    // storing that would quietly undo whichever edit was not chosen.
    return { kind: 'conflict', reason: 'unresolved', conflicts: merged.conflicts };
  }

  // The account first, and this is the important half of the ordering. If the
  // write is refused because somebody else got there first, the phone still
  // holds exactly what it held, and nothing has been decided on its behalf.
  const stored = await pushRemoteSyncState({
    uid,
    expectedRevision: remote.revision,
    payload: merged.payload,
    deviceId: await onThisPhone(attempt.deviceId),
  });

  if (stored.kind === 'conflict') {
    return { kind: 'retry-required', actualRevision: stored.actualRevision };
  }

  // Then the phone, and only then the base. Should this fail, the account is
  // ahead and the base is not: the next sync reads both, finds them apart, and
  // merges again from the same base — which converges on what is already stored,
  // because that is what the merge produced.
  await applyToThisPhone(db, merged.payload);
  await rememberAgreement(db, uid, stored.envelope, now);

  return { kind: 'merged', revision: stored.envelope.revision };
}

/**
 * Syncs this phone with one account.
 *
 * The account is named by the caller rather than looked up here, for the same
 * reason the repositories take a uid: this module holds no idea of a "current
 * user" and cannot sync "the" account.
 *
 * Every failure comes back as a result. Nothing here throws for a reason a
 * person could be told about — a lost race, a refused write, a connection that
 * was not there — and nothing carries a message from Firestore or from SQLite
 * out with it.
 *
 * Local writes are atomic on their own: `restoreCloudBackup` is one
 * transaction, and the base row is one statement. What this cannot do is put
 * those two in a single transaction, because the restore opens its own and
 * SQLite does not nest them. The order is chosen so that the gap is safe rather
 * than closed: the base is written last, so an interruption leaves it behind
 * rather than ahead, and a base that is behind is re-derived by the next sync.
 */
export async function runCloudSync(input: RunCloudSyncInput): Promise<CloudSyncOutcome> {
  const { db, uid } = input;

  if (typeof uid !== 'string' || uid.trim() === '') {
    return { kind: 'error', failure: 'signed-out' };
  }

  const attempt: Attempt = {
    db,
    uid,
    deviceId: input.deviceId ?? deviceIdProvider,
    now: input.now ?? isoNow,
  };

  try {
    let outcome: CloudSyncOutcome = { kind: 'error', failure: 'unknown' };

    for (let round = 0; round < MAX_SYNC_ATTEMPTS; round += 1) {
      outcome = await attemptSync(attempt);

      if (outcome.kind !== 'retry-required') {
        return outcome;
      }
    }

    // Twice was not enough. The caller is told what the revision actually is,
    // and nothing was written on either side.
    return outcome;
  } catch (error) {
    return { kind: 'error', failure: failureOf(error) };
  }
}
