import type { AvatarConfig } from '@/features/avatar/domain/avatar-config';
import type { CycleSettings, PeriodRecord } from '@/features/cycle/domain/types';
import type { NotificationPreferences } from '@/features/notifications/domain/notification-preferences';
import type { PregnancyProfile } from '@/features/pregnancy/domain/types';
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
 * Two values reduced to the fields this app actually stores, in a fixed order.
 *
 * Whole-object `JSON.stringify` was the obvious thing and it was wrong. One
 * side of this comparison comes from the device's own repositories, in the order
 * their literals are written; the other has been to Firestore and back, and a
 * document's fields do not come back in the order they went in. Two identical
 * backups then read as different, and the confirmation screen told someone that
 * everything would change when nothing would.
 *
 * Naming the fields fixes that, and fixes more than that: a key this build does
 * not know — from a later version, or from whatever else has written to the
 * document — no longer counts as a change to data this app can see. What is
 * compared is exactly what a restore would write.
 *
 * The cost is that a new field has to be added here as well as to the model. A
 * comparison that silently ignored a field would be worse than one that has to
 * be kept honest, and the tests below name every field so the omission shows up.
 *
 * Exported because a content hash has to reduce a payload the same way this
 * does. Two answers to "are these the same?" that disagreed would be worse than
 * either, so there is one set of fingerprints and both callers use it.
 */
export type Fingerprint = readonly (string | number | boolean | null)[];

export function fingerprintCycleSettings(settings: CycleSettings): Fingerprint {
  return [settings.averageCycleLengthDays, settings.averagePeriodLengthDays];
}

export function fingerprintPeriodRecord(record: PeriodRecord): Fingerprint {
  // `endDate` is absent rather than null on a record with no end, and Firestore
  // has no way to store "absent" differently from "not there". Both become null.
  return [record.id, record.startDate, record.endDate ?? null, record.isOngoing];
}

export function fingerprintPregnancyProfile(profile: PregnancyProfile): Fingerprint {
  return [
    profile.lastMenstrualPeriodStartDate,
    profile.estimatedDueDate,
    profile.dueDateSource,
  ];
}

export function fingerprintAvatarConfig(config: AvatarConfig): Fingerprint {
  return [
    config.skinToneId,
    config.hairStyleId,
    config.hairColorId,
    config.outfitId,
    config.accessoryId ?? null,
  ];
}

export function fingerprintNotificationPreferences(
  preferences: NotificationPreferences
): Fingerprint {
  return [preferences.periodReminderEnabled, preferences.pregnancyWeeklyReminderEnabled];
}

/** Whether two fingerprints describe the same stored value. */
function isSame(local: Fingerprint, remote: Fingerprint): boolean {
  return (
    local.length === remote.length && local.every((value, index) => value === remote[index])
  );
}

/**
 * What would happen to one nullable value.
 *
 * The fingerprint is taken here rather than by the caller, so a value that is
 * absent is never handed to something expecting an object.
 */
function statusOf<T>(
  local: T | null | undefined,
  remote: T | null | undefined,
  fingerprint: (value: T) => Fingerprint
): CloudRestoreStatus {
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

  return isSame(fingerprint(local), fingerprint(remote)) ? 'unchanged' : 'replace';
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

    if (!isSame(fingerprintPeriodRecord(match), fingerprintPeriodRecord(record))) {
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
    cycleSettings: statusOf(local.cycleSettings, remote.cycleSettings, fingerprintCycleSettings),
    periodRecords: periodRecordsPreview(local.periodRecords, remote.periodRecords),
    pregnancyProfile: statusOf(
      local.pregnancyProfile,
      remote.pregnancyProfile,
      fingerprintPregnancyProfile
    ),
    avatarConfig: statusOf(local.avatarConfig, remote.avatarConfig, fingerprintAvatarConfig),
    // Never absent on either side: "nothing chosen" is the defaults, so this is
    // only ever unchanged or replaced.
    notificationPreferences: statusOf(
      local.notificationPreferences,
      remote.notificationPreferences,
      fingerprintNotificationPreferences
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
