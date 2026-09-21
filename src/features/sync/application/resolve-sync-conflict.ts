import type { SQLiteDatabase } from 'expo-sqlite';

import { restoreCloudBackup } from '@/features/backup/application/restore-cloud-backup';
import { buildCloudSyncPayloadV1 } from '@/features/privacy/application/build-cloud-sync-payload-v1';
import { logEvent } from '@/shared/logging';

import { loadRemoteSyncState, pushRemoteSyncState } from '../data/cloud-sync-repository';
import { saveSyncState } from '../data/sync-state-repository';
import { cloudSyncContentHash } from '../domain/cloud-sync-hash';
import type { DeviceIdProvider } from '../infrastructure/device-id';
import { deviceIdProvider } from '../infrastructure/device-id';


import { announceSyncOutcome } from './sync-outcome-notifier';
import type { CloudSyncOutcome } from './run-cloud-sync';
import { withAutomaticSyncSuspended } from './automatic-sync-suspension';
import { recordSyncSettled } from './settle-sync';

/**
 * Settling a conflict the only way this app offers: one whole side wins.
 *
 * No per-record merging, and that is a decision rather than a shortcut. The
 * three-way merge already did everything that can be done without asking; what
 * is left is the part where both sides changed the same thing, and the payload
 * the merge hands back holds the *base* value at each of those places — the one
 * value neither side wrote. Storing it would quietly undo whichever edit lost.
 * Choosing a side avoids that entirely: whatever is kept is something somebody
 * actually entered.
 *
 * Both paths re-read the account first. A conflict screen can sit open for
 * minutes, and a third device writing in that time must not have its work
 * thrown away by a choice made about an older version.
 *
 * Automatic sync is suspended for the duration of either path, so a foreground
 * trigger cannot land in the middle of a restore and push a half-written
 * database.
 */

export type ResolveSyncConflictFailure =
  /** The account moved since the screen was drawn. Nothing was written. */
  | 'revision-moved'
  | 'network-failed'
  /** The phone's own database refused. Nothing was written. */
  | 'local-failed'
  | 'unknown';

export type ResolveSyncConflictOutcome =
  /** The phone's data is now in the account. */
  | { readonly kind: 'local-kept'; readonly revision: number }
  /** The account's data is now on the phone. */
  | { readonly kind: 'remote-kept'; readonly revision: number }
  | { readonly kind: 'failed'; readonly reason: ResolveSyncConflictFailure };

export type ResolveSyncConflictInput = {
  readonly db: SQLiteDatabase;
  readonly uid: string;
  /** The revision the person was shown. A different one means re-deciding. */
  readonly expectedRevision: number;
  readonly deviceId?: DeviceIdProvider;
  readonly now?: () => string;
};

const isoNow = () => new Date().toISOString();

/**
 * Records that this phone and the account now agree, and says so out loud.
 *
 * The same step every ordinary sync takes: the note about the disagreement is
 * dropped and the time is written down. The announcement is what the account
 * screen listens to, so the notice goes without waiting for a remount — a
 * resolution is a sync, described to a screen as the push or the pull it was.
 */
async function settle(uid: string, stamp: () => string, outcome: CloudSyncOutcome): Promise<void> {
  await recordSyncSettled({ uid, now: stamp });

  announceSyncOutcome(outcome);
}

/**
 * Keeps what is on this phone, and overwrites the account with it.
 *
 * The payload is rebuilt here rather than taken from the screen: minutes may
 * have passed, and sending what the phone held when the screen opened would
 * quietly drop anything written since.
 *
 * The write is a compare-and-set on the revision that was read a moment ago.
 * Losing that compare is not a failure to report as one — it means somebody
 * else got there first, and the honest answer is to look again.
 */
export async function keepLocalData(
  input: ResolveSyncConflictInput
): Promise<ResolveSyncConflictOutcome> {
  const { db, uid, expectedRevision } = input;
  const resolveDeviceId = input.deviceId ?? deviceIdProvider;
  const stamp = input.now ?? isoNow;

  return withAutomaticSyncSuspended(async () => {
    try {
      const remote = await loadRemoteSyncState(uid);
      const actualRevision = remote?.revision ?? 0;

      if (actualRevision !== expectedRevision) {
        return { kind: 'failed', reason: 'revision-moved' };
      }

      const payload = await buildCloudSyncPayloadV1(db);

      const stored = await pushRemoteSyncState({
        uid,
        expectedRevision,
        payload,
        deviceId: await resolveDeviceId(),
      });

      if (stored.kind === 'conflict') {
        return { kind: 'failed', reason: 'revision-moved' };
      }

      // The account now holds this. The base has to say so, or the next sync
      // measures from something that is no longer true.
      try {
        await saveSyncState(db, {
          uid,
          revision: stored.envelope.revision,
          contentHash: cloudSyncContentHash(payload),
          basePayload: payload,
          updatedAt: stored.envelope.updatedAt ?? stamp(),
        });
      } catch (error: unknown) {
        // The write landed; a base that is behind is re-derived next time.
        logEvent('sync conflict resolve failed', error);
      }

      await settle(uid, stamp, { kind: 'pushed', revision: stored.envelope.revision });

      return { kind: 'local-kept', revision: stored.envelope.revision };
    } catch (error: unknown) {
      logEvent('sync conflict resolve failed', error);

      return { kind: 'failed', reason: classify(error) };
    }
  });
}

/**
 * Keeps what is in the account, and overwrites this phone with it.
 *
 * Nothing is written to the account at all — it already holds what is wanted —
 * so there is no compare to lose here. The revision is still checked first,
 * because writing an older version of the cloud onto the phone would be acting
 * on a screen that had gone stale.
 *
 * The local write is `restoreCloudBackup`, which is one transaction: the phone
 * ends up wholly replaced or wholly untouched.
 */
export async function keepRemoteData(
  input: ResolveSyncConflictInput
): Promise<ResolveSyncConflictOutcome> {
  const { db, uid, expectedRevision } = input;
  const stamp = input.now ?? isoNow;

  return withAutomaticSyncSuspended(async () => {
    let remote;

    try {
      remote = await loadRemoteSyncState(uid);
    } catch (error: unknown) {
      logEvent('sync conflict resolve failed', error);

      return { kind: 'failed', reason: classify(error) };
    }

    if (remote === null || remote.revision !== expectedRevision) {
      return { kind: 'failed', reason: 'revision-moved' };
    }

    try {
      await restoreCloudBackup(db, remote.payload);
    } catch (error: unknown) {
      logEvent('sync conflict resolve failed', error);

      return { kind: 'failed', reason: 'local-failed' };
    }

    try {
      await saveSyncState(db, {
        uid,
        revision: remote.revision,
        contentHash: remote.contentHash,
        basePayload: remote.payload,
        updatedAt: remote.updatedAt ?? stamp(),
      });
    } catch (error: unknown) {
      logEvent('sync conflict resolve failed', error);
    }

    await settle(uid, stamp, { kind: 'pulled', revision: remote.revision });

    return { kind: 'remote-kept', revision: remote.revision };
  });
}

/** What a thrown thing means here, without letting its message out. */
function classify(error: unknown): ResolveSyncConflictFailure {
  const code = (error as { code?: unknown })?.code;

  if (code === 'unavailable' || code === 'deadline-exceeded' || code === 'auth/network-request-failed') {
    return 'network-failed';
  }

  return 'unknown';
}
