import type { SQLiteDatabase } from 'expo-sqlite';

import { buildCloudRestorePreviewV1 } from '@/features/backup/domain/cloud-restore-preview-v1';
import type { CloudRestorePreviewV1 } from '@/features/backup/domain/cloud-restore-preview-v1';
import { buildCloudSyncPayloadV1 } from '@/features/privacy/application/build-cloud-sync-payload-v1';
import type { CloudSyncPayloadV1 } from '@/features/privacy/domain/cloud-sync-payload-v1';

import { loadRemoteSyncState } from '../data/cloud-sync-repository';
import type { CloudBackupEnvelopeV1 } from '../domain/cloud-backup-envelope-v1';

/**
 * What the two sides of a conflict hold, in the shape a screen can show.
 *
 * It reuses the restore preview on purpose. That already answers exactly the
 * question somebody choosing here has — how many records, is there a pregnancy,
 * is there an avatar — and already refuses to answer the ones they must not be
 * asked in front of another person: which day, which value, which record.
 *
 * Two previews rather than one, because a conflict is symmetrical. "What would
 * change if I kept the cloud" is the ordinary restore question; "what would
 * change if I kept this phone" is its mirror, and somebody choosing between
 * them needs both.
 *
 * Nothing here decides anything and nothing here writes. It reads both sides
 * and describes them.
 */

export type SyncConflictSideSummary = {
  readonly periodRecordCount: number;
  readonly hasPregnancy: boolean;
  readonly hasAvatar: boolean;
  readonly hasCycleSettings: boolean;
};

export type SyncConflictPreview = {
  /** What the cloud would do to this phone, in restore terms. */
  readonly ifCloudWins: CloudRestorePreviewV1;
  readonly local: SyncConflictSideSummary;
  readonly remote: SyncConflictSideSummary;
  /** The revision the choice will be made against. */
  readonly revision: number;
  /** The server's stamp on the cloud side, or `null`. */
  readonly remoteUpdatedAt: string | null;
  /** Whether the cloud side was last written by this installation. */
  readonly remoteWrittenByThisDevice: boolean;
  /** Kept so a resolution does not have to read it again. */
  readonly remotePayload: CloudSyncPayloadV1;
};

export type BuildConflictPreviewInput = {
  readonly db: SQLiteDatabase;
  readonly uid: string;
  readonly deviceId: string;
};

export type BuildConflictPreviewResult =
  | { readonly kind: 'ready'; readonly preview: SyncConflictPreview }
  /** There is nothing in the account any more; there is no conflict to settle. */
  | { readonly kind: 'no-remote' }
  | { readonly kind: 'failed' };

function summarise(payload: CloudSyncPayloadV1): SyncConflictSideSummary {
  return {
    periodRecordCount: payload.periodRecords.length,
    hasPregnancy: payload.pregnancyProfile !== null,
    hasAvatar: payload.avatarConfig !== null,
    hasCycleSettings: payload.cycleSettings !== null,
  };
}

export async function buildConflictPreview(
  input: BuildConflictPreviewInput
): Promise<BuildConflictPreviewResult> {
  const { db, uid, deviceId } = input;

  let remote: CloudBackupEnvelopeV1 | null;
  let local: CloudSyncPayloadV1;

  try {
    local = await buildCloudSyncPayloadV1(db);
    remote = await loadRemoteSyncState(uid);
  } catch {
    return { kind: 'failed' };
  }

  if (remote === null) {
    return { kind: 'no-remote' };
  }

  return {
    kind: 'ready',
    preview: {
      ifCloudWins: buildCloudRestorePreviewV1(local, remote.payload),
      local: summarise(local),
      remote: summarise(remote.payload),
      revision: remote.revision,
      remoteUpdatedAt: remote.updatedAt,
      remoteWrittenByThisDevice: remote.deviceId !== null && remote.deviceId === deviceId,
      remotePayload: remote.payload,
    },
  };
}
