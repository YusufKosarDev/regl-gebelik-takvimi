import type { PeriodRecord } from '@/features/cycle/domain/types';
import type { CloudSyncPayloadV1 } from '@/features/privacy/domain/cloud-sync-payload-v1';

/**
 * What restoring a backup would do, without saying what is in it.
 *
 * Counts and verdicts only. Not a date, not a record id, not a cycle length —
 * nothing a person would mind being read over their shoulder, and nothing that
 * would put their history into a screenshot of a confirmation dialog.
 *
 * The point is consent that means something. "This will overwrite your data" is
 * not a question anyone can answer; "12 records will be removed" is.
 */

/** What would happen to one thing the app stores. */
export type CloudRestoreStatus = 'unchanged' | 'replace' | 'add' | 'remove';

/** What would happen to the period history, in counts. */
export type CloudRestorePeriodRecordsPreview = {
  readonly localCount: number;
  readonly remoteCount: number;
  readonly added: number;
  readonly removed: number;
  readonly changed: number;
};

export type CloudRestorePreviewV1 = {
  readonly cycleSettings: CloudRestoreStatus;
  readonly periodRecords: CloudRestorePeriodRecordsPreview;
  readonly pregnancyProfile: CloudRestoreStatus;
  readonly avatarConfig: CloudRestoreStatus;
  readonly notificationPreferences: CloudRestoreStatus;
};

/**
 * Whether two stored values are the same thing.
 *
 * Compared as JSON rather than field by field, because every one of these is a
 * small object of primitives that this app builds itself, and a comparison that
 * had to be updated whenever a field was added is a comparison that would
 * eventually say "unchanged" about a change.
 *
 * Key order is not a worry: both sides are built by this app's own repositories
 * from the same literals, and the payload has been validated before it arrives.
 */
function isSame(local: unknown, remote: unknown): boolean {
  return JSON.stringify(local) === JSON.stringify(remote);
}

/** What would happen to one nullable value. */
function statusOf(local: unknown, remote: unknown): CloudRestoreStatus {
  const hasLocal = local !== null && local !== undefined;
  const hasRemote = remote !== null && remote !== undefined;

  if (!hasLocal && !hasRemote) {
    return 'unchanged';
  }

  if (!hasLocal) {
    return 'add';
  }

  if (!hasRemote) {
    return 'remove';
  }

  return isSame(local, remote) ? 'unchanged' : 'replace';
}

/**
 * What would happen to the period history.
 *
 * Matched by id, which is what makes "changed" meaningful: the same record with
 * a corrected end date is a change, while a record only one side has is an
 * addition or a removal. A payload cannot hold two records with the same id —
 * the payload validator refuses that — so one pass over each side is enough.
 */
function periodRecordsPreview(
  local: readonly PeriodRecord[],
  remote: readonly PeriodRecord[]
): CloudRestorePeriodRecordsPreview {
  const localById = new Map(local.map((record) => [record.id, record]));
  const remoteById = new Map(remote.map((record) => [record.id, record]));

  let added = 0;
  let changed = 0;

  for (const record of remote) {
    const match = localById.get(record.id);

    if (match === undefined) {
      added += 1;
      continue;
    }

    if (!isSame(match, record)) {
      changed += 1;
    }
  }

  let removed = 0;

  for (const record of local) {
    if (!remoteById.has(record.id)) {
      removed += 1;
    }
  }

  return {
    localCount: local.length,
    remoteCount: remote.length,
    added,
    removed,
    changed,
  };
}

/**
 * Compares what is on the phone with what is in the backup.
 *
 * Both sides are payloads that have already been validated, so nothing here
 * checks them again: this answers one question, which is what would change.
 *
 * Nothing is worked out beyond the comparison — no cycle day, no phase, no
 * prediction — and nothing is written anywhere.
 *
 * Pure: neither payload is mutated and neither is kept.
 */
export function buildCloudRestorePreviewV1(
  local: CloudSyncPayloadV1,
  remote: CloudSyncPayloadV1
): CloudRestorePreviewV1 {
  return {
    cycleSettings: statusOf(local.cycleSettings, remote.cycleSettings),
    periodRecords: periodRecordsPreview(local.periodRecords, remote.periodRecords),
    pregnancyProfile: statusOf(local.pregnancyProfile, remote.pregnancyProfile),
    avatarConfig: statusOf(local.avatarConfig, remote.avatarConfig),
    // Never absent on either side: "nothing chosen" is the defaults, so this is
    // only ever unchanged or replaced.
    notificationPreferences: statusOf(
      local.notificationPreferences,
      remote.notificationPreferences
    ),
  };
}

/** Whether restoring this backup would change anything at all. */
export function isRestoreWithoutChange(preview: CloudRestorePreviewV1): boolean {
  const { periodRecords } = preview;

  return (
    preview.cycleSettings === 'unchanged' &&
    preview.pregnancyProfile === 'unchanged' &&
    preview.avatarConfig === 'unchanged' &&
    preview.notificationPreferences === 'unchanged' &&
    periodRecords.added === 0 &&
    periodRecords.removed === 0 &&
    periodRecords.changed === 0
  );
}
