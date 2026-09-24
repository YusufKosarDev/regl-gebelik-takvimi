import type { AvatarConfig } from '@/features/avatar/domain/avatar-config';
import { validateAvatarConfig } from '@/features/avatar/domain/avatar-config';
import type { Fingerprint } from '@/features/backup/domain/cloud-restore-preview-v1';
import {
  fingerprintAvatarConfig,
  fingerprintCycleSettings,
  fingerprintNotificationPreferences,
  fingerprintPeriodRecord,
  fingerprintPregnancyProfile,
} from '@/features/backup/domain/cloud-restore-preview-v1';
import type { CycleSettings, PeriodRecord } from '@/features/cycle/domain/types';
import type { DailyEntry } from '@/features/daily-log/domain/catalogues';
import { sortDailyEntries } from '@/features/daily-log/domain/validation';
import { validateCycleSettings } from '@/features/cycle/domain/validation';
import type { NotificationPreferences } from '@/features/notifications/domain/notification-preferences';
import { validateNotificationPreferences } from '@/features/notifications/domain/notification-preferences';
import type { PregnancyProfile } from '@/features/pregnancy/domain/types';
import { validatePregnancyProfile } from '@/features/pregnancy/domain/validation';
import type { CloudSyncPayloadV1 } from '@/features/privacy/domain/cloud-sync-payload-v1';
import {
  CLOUD_SYNC_PAYLOAD_VERSION,
  carryUnknownCloudSyncPayloadFields,
  validateCloudSyncPayloadV1,
} from '@/features/privacy/domain/cloud-sync-payload-v1';

/**
 * Putting two people's week back together.
 *
 * Three payloads go in — what the two sides last agreed (`base`), what is on
 * this phone now, and what is in the account now — and one comes out, with a
 * list of the places where the two sides disagree in a way no rule can settle.
 *
 * The whole point of the base is that it turns "these are different" into
 * "somebody changed this". Without it, a phone that has been offline for a week
 * and an account edited from another phone look like two unrelated histories
 * and every single difference is a question for the person. With it, almost
 * nothing is: a day written down here and a setting changed there are both
 * kept, and what is left over is the genuinely contested part.
 *
 * What this is not:
 *
 *   - It is not a policy. Nothing here prefers the phone, prefers the account,
 *     prefers the newer write or prefers the longer history. Where both sides
 *     moved the same thing to different values, the answer is a conflict and a
 *     person decides.
 *   - It is not a sync. It reads no database, opens no connection, knows no
 *     account and has no clock. It is a function of three values.
 *   - It is not a deep merge. Each part of the payload is merged the way its own
 *     domain says it may be, and a value whose fields depend on each other is
 *     merged whole rather than field by field.
 *
 * Pure: the three payloads are read and never mutated, and nothing in the result
 * shares a mutable structure with them.
 */

/** Why one place could not be settled without asking. */
export type CloudSyncConflictReason =
  /** Both sides moved it, to different values. */
  | 'changed-on-both-sides'
  /** One side removed it while the other changed it. */
  | 'removed-and-changed'
  /** Neither side had it before, and each made a different one. */
  | 'added-on-both-sides'
  /** Two records would start on the same day, which the payload forbids. */
  | 'same-day'
  /** More than one period would be ongoing, which the payload forbids. */
  | 'two-ongoing'
  /** The field-by-field merge came out as something the domain refuses. */
  | 'invalid-combination';

/** A stored value that can be in dispute. */
export type CloudSyncConflictValue =
  | string
  | number
  | boolean
  | CycleSettings
  | PregnancyProfile
  | AvatarConfig
  | NotificationPreferences
  | PeriodRecord
  | DailyEntry;

/**
 * What one side held, which may be nothing at all.
 *
 * "Not there" is a real answer and a different one from any value: a cleared
 * pregnancy, a deleted record and an avatar with no accessory are all absences
 * the person chose, and a merge that read them as `null` values would be
 * inventing a value they never entered.
 */
export type CloudSyncConflictSide =
  | { readonly present: false }
  | { readonly present: true; readonly value: CloudSyncConflictValue };

/**
 * One place two sides disagree.
 *
 * `path` names it the way the domain does — `cycleSettings.averageCycleLengthDays`
 * for a field, `periodRecords/<id>` for a record — so a screen can label it and
 * a test can assert on it without either depending on the order things were
 * merged in.
 *
 * The three values are here because the person has to be shown what they are
 * choosing between. They are that person's own data: they belong on their
 * screen and in nothing else. No message built anywhere in this file contains
 * one.
 */
export type CloudSyncConflict = {
  readonly path: string;
  readonly reason: CloudSyncConflictReason;
  readonly base: CloudSyncConflictSide;
  readonly local: CloudSyncConflictSide;
  readonly remote: CloudSyncConflictSide;
};

/**
 * What the merge came to.
 *
 * `merged` means the payload can be stored as it is: every difference between
 * the two sides was one that only one side made, and all of them are in there.
 *
 * `conflict` still carries a payload, and it is still every change that could be
 * settled — a conflict about a cycle length does not throw away a period record
 * somebody wrote down. What it is not is finished: at every conflicting path the
 * payload holds what the two sides last agreed, which is the one value neither
 * of them is the author of. Storing it while conflicts are outstanding would
 * quietly undo whichever side's edit was not chosen, so nothing may store it
 * until each conflict has an answer.
 */
export type CloudSyncMergeResult =
  | { readonly kind: 'merged'; readonly payload: CloudSyncPayloadV1 }
  | {
      readonly kind: 'conflict';
      readonly payload: CloudSyncPayloadV1;
      readonly conflicts: readonly CloudSyncConflict[];
    };

/** The three payloads a merge is worked out from. */
export type CloudSyncMergeInput = {
  /**
   * What the two sides last agreed.
   *
   * Required. A three-way merge without a base is a two-way comparison, and a
   * two-way comparison cannot tell an edit from a deletion — which is exactly
   * the distinction everything below is built on. `decideSync` already answers
   * `conflict` for an account this device has never synced, so that case never
   * reaches here.
   */
  readonly base: CloudSyncPayloadV1;
  readonly local: CloudSyncPayloadV1;
  readonly remote: CloudSyncPayloadV1;
};

// ---------------------------------------------------------------------------
// Sides
// ---------------------------------------------------------------------------

/** One side's answer about one thing: a value, or nothing. */
type Side<T> = { readonly present: false } | { readonly present: true; readonly value: T };

const ABSENT = { present: false } as const;

function sideOf<T>(value: T | null | undefined): Side<T> {
  return value === null || value === undefined ? ABSENT : { present: true, value };
}

/** The side as the result reports it; the two types are the same shape. */
function toConflictSide<T extends CloudSyncConflictValue>(side: Side<T>): CloudSyncConflictSide {
  return side.present ? { present: true, value: side.value } : ABSENT;
}

/** Whether two fingerprints describe the same stored value. */
function sameFingerprint(left: Fingerprint, right: Fingerprint): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/**
 * A "same value?" test built from the fingerprint the app already compares by.
 *
 * Reusing those is deliberate. There is one answer in this app to "are these
 * two the same as far as we store them?" — it is what the restore preview shows
 * and what the content hash is computed from — and a merge that took a second
 * opinion would be able to call two payloads identical that the hash calls
 * different, or the other way round.
 */
function sameBy<T>(fingerprint: (value: T) => Fingerprint) {
  return (left: T, right: T): boolean => sameFingerprint(fingerprint(left), fingerprint(right));
}

function sameSide<T>(left: Side<T>, right: Side<T>, same: (a: T, b: T) => boolean): boolean {
  if (!left.present || !right.present) {
    return left.present === right.present;
  }

  return same(left.value, right.value);
}

/** Why a three-way comparison that fell through to a conflict did so. */
function reasonFor<T>(base: Side<T>, local: Side<T>, remote: Side<T>): CloudSyncConflictReason {
  if (!base.present) {
    return 'added-on-both-sides';
  }

  if (!local.present || !remote.present) {
    return 'removed-and-changed';
  }

  return 'changed-on-both-sides';
}

/**
 * The three-way rule, once, for one thing.
 *
 * In order, and the order is what makes it a merge rather than a preference:
 *
 *   1. the two sides already agree — take it, whatever the base said. This is
 *      also the case where nothing changed at all.
 *   2. this side still holds what was agreed — the other side is the only one
 *      that moved, so take the other side.
 *   3. the other side still holds it — take this side.
 *   4. both moved, differently — nobody here is entitled to choose. The value
 *      stays at what was agreed and the disagreement is reported.
 *
 * Step 4 returning the base is not a third policy. It is the absence of one:
 * the base is the only value that is not one of the two answers in dispute.
 */
function resolve<T>(
  base: Side<T>,
  local: Side<T>,
  remote: Side<T>,
  same: (a: T, b: T) => boolean
): { readonly value: Side<T>; readonly reason: CloudSyncConflictReason | null } {
  if (sameSide(local, remote, same)) {
    return { value: local, reason: null };
  }

  if (sameSide(local, base, same)) {
    return { value: remote, reason: null };
  }

  if (sameSide(remote, base, same)) {
    return { value: local, reason: null };
  }

  return { value: base, reason: reasonFor(base, local, remote) };
}

// ---------------------------------------------------------------------------
// Fields inside a section
// ---------------------------------------------------------------------------

/** One field of a settings object, merged on its own. */
function mergeField<T extends string | number | boolean>(
  path: string,
  base: T,
  local: T,
  remote: T,
  conflicts: CloudSyncConflict[]
): T {
  const resolved = resolve(sideOf(base), sideOf(local), sideOf(remote), (a, b) => a === b);

  if (resolved.reason !== null) {
    conflicts.push({
      path,
      reason: resolved.reason,
      base: { present: true, value: base },
      local: { present: true, value: local },
      remote: { present: true, value: remote },
    });
  }

  // Present by construction: all three inputs are values, so every branch of
  // `resolve` returns one of them.
  return resolved.value.present ? resolved.value.value : base;
}

/** The same, for a field that may simply not be there. */
function mergeOptionalField(
  path: string,
  base: string | undefined,
  local: string | undefined,
  remote: string | undefined,
  conflicts: CloudSyncConflict[]
): string | undefined {
  const sides = {
    base: sideOf(base),
    local: sideOf(local),
    remote: sideOf(remote),
  };

  const resolved = resolve(sides.base, sides.local, sides.remote, (a, b) => a === b);

  if (resolved.reason !== null) {
    conflicts.push({
      path,
      reason: resolved.reason,
      base: toConflictSide(sides.base),
      local: toConflictSide(sides.local),
      remote: toConflictSide(sides.remote),
    });
  }

  return resolved.value.present ? resolved.value.value : undefined;
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

/**
 * One nullable part of the payload.
 *
 * Presence is decided first, and by the same three-way rule as everything else.
 * A side that cleared a pregnancy and a side that edited it are a removal and a
 * change, and that pair is a conflict here for the same reason it is among the
 * period records: silently keeping the edit would undo a deletion the person
 * made on purpose, and silently keeping the deletion would throw away an edit.
 *
 * Only when all three sides have the value does it go field by field. That is
 * what lets two phones change two different settings in the same week without
 * either of them being asked about it.
 *
 * `fieldMerge` is optional, and a section without one is merged whole. See
 * `mergePregnancyProfile` for why one of them has to be.
 *
 * The field-merged result is put through the domain's own validator before it is
 * accepted. Two edits that are each fine on their own can combine into something
 * the domain refuses — a period longer than the cycle it sits in — and a merge
 * is not entitled to invent that. When it happens the field conflicts are
 * dropped in favour of one conflict about the section, because "these two
 * numbers cannot both be that" is the thing that needs answering, and the
 * section stays at what was agreed.
 */
function mergeSection<T extends CloudSyncConflictValue>(
  path: string,
  base: T | null,
  local: T | null,
  remote: T | null,
  options: {
    readonly same: (a: T, b: T) => boolean;
    readonly validate: (value: T) => void;
    readonly fieldMerge?: (base: T, local: T, remote: T, conflicts: CloudSyncConflict[]) => T;
  },
  conflicts: CloudSyncConflict[]
): T | null {
  const sides = {
    base: sideOf(base),
    local: sideOf(local),
    remote: sideOf(remote),
  };

  if (options.fieldMerge !== undefined && sides.base.present && sides.local.present && sides.remote.present) {
    const fieldConflicts: CloudSyncConflict[] = [];
    const merged = options.fieldMerge(
      sides.base.value,
      sides.local.value,
      sides.remote.value,
      fieldConflicts
    );

    try {
      options.validate(merged);
    } catch {
      // The message is not read: it describes the person's own values, and the
      // three of them are already on the conflict for a screen to show.
      conflicts.push({
        path,
        reason: 'invalid-combination',
        base: toConflictSide(sides.base),
        local: toConflictSide(sides.local),
        remote: toConflictSide(sides.remote),
      });

      return base;
    }

    conflicts.push(...fieldConflicts);

    return merged;
  }

  const resolved = resolve(sides.base, sides.local, sides.remote, options.same);

  if (resolved.reason !== null) {
    conflicts.push({
      path,
      reason: resolved.reason,
      base: toConflictSide(sides.base),
      local: toConflictSide(sides.local),
      remote: toConflictSide(sides.remote),
    });
  }

  return resolved.value.present ? resolved.value.value : null;
}

function mergeCycleSettingsFields(
  base: CycleSettings,
  local: CycleSettings,
  remote: CycleSettings,
  conflicts: CloudSyncConflict[]
): CycleSettings {
  return {
    averageCycleLengthDays: mergeField(
      'cycleSettings.averageCycleLengthDays',
      base.averageCycleLengthDays,
      local.averageCycleLengthDays,
      remote.averageCycleLengthDays,
      conflicts
    ),
    averagePeriodLengthDays: mergeField(
      'cycleSettings.averagePeriodLengthDays',
      base.averagePeriodLengthDays,
      local.averagePeriodLengthDays,
      remote.averagePeriodLengthDays,
      conflicts
    ),
  };
}

function mergeAvatarConfigFields(
  base: AvatarConfig,
  local: AvatarConfig,
  remote: AvatarConfig,
  conflicts: CloudSyncConflict[]
): AvatarConfig {
  const required = {
    skinToneId: mergeField(
      'avatarConfig.skinToneId',
      base.skinToneId,
      local.skinToneId,
      remote.skinToneId,
      conflicts
    ),
    hairStyleId: mergeField(
      'avatarConfig.hairStyleId',
      base.hairStyleId,
      local.hairStyleId,
      remote.hairStyleId,
      conflicts
    ),
    hairColorId: mergeField(
      'avatarConfig.hairColorId',
      base.hairColorId,
      local.hairColorId,
      remote.hairColorId,
      conflicts
    ),
    outfitId: mergeField(
      'avatarConfig.outfitId',
      base.outfitId,
      local.outfitId,
      remote.outfitId,
      conflicts
    ),
  };

  const accessoryId = mergeOptionalField(
    'avatarConfig.accessoryId',
    base.accessoryId,
    local.accessoryId,
    remote.accessoryId,
    conflicts
  );

  // The key is left out rather than set to `undefined`. No accessory is stored
  // as an absent field everywhere else in this app, and an explicit `undefined`
  // is not the same thing to a database or to `JSON.stringify`.
  return accessoryId === undefined ? required : { ...required, accessoryId };
}

function mergeNotificationPreferencesFields(
  base: NotificationPreferences,
  local: NotificationPreferences,
  remote: NotificationPreferences,
  conflicts: CloudSyncConflict[]
): NotificationPreferences {
  return {
    periodReminderEnabled: mergeField(
      'notificationPreferences.periodReminderEnabled',
      base.periodReminderEnabled,
      local.periodReminderEnabled,
      remote.periodReminderEnabled,
      conflicts
    ),
    pregnancyWeeklyReminderEnabled: mergeField(
      'notificationPreferences.pregnancyWeeklyReminderEnabled',
      base.pregnancyWeeklyReminderEnabled,
      local.pregnancyWeeklyReminderEnabled,
      remote.pregnancyWeeklyReminderEnabled,
      conflicts
    ),
  };
}

// ---------------------------------------------------------------------------
// Period records
// ---------------------------------------------------------------------------

/** What is known about one record id across the three payloads. */
type RecordMerge = {
  readonly id: string;
  readonly base: Side<PeriodRecord>;
  readonly local: Side<PeriodRecord>;
  readonly remote: Side<PeriodRecord>;
  chosen: Side<PeriodRecord>;
  reason: CloudSyncConflictReason | null;
};

const samePeriodRecord = sameBy(fingerprintPeriodRecord);

function byId(records: readonly PeriodRecord[]): ReadonlyMap<string, PeriodRecord> {
  return new Map(records.map((record) => [record.id, record]));
}

/**
 * Every record id any of the three sides knows, in a fixed order.
 *
 * Sorted by code unit rather than by `localeCompare`, exactly as the content
 * hash sorts: a comparison that depended on the device's language would put the
 * same history in a different order on two phones, and every downstream answer
 * built on that order would differ too.
 */
function allRecordIds(payloads: readonly (readonly PeriodRecord[])[]): readonly string[] {
  const ids = new Set<string>();

  for (const records of payloads) {
    for (const record of records) {
      ids.add(record.id);
    }
  }

  return [...ids].sort((left, right) => (left === right ? 0 : left < right ? -1 : 1));
}

/**
 * The period history, merged record by record.
 *
 * Identity is the record id and only the id. Position in the list is not
 * identity: two phones that each wrote down a period this month would otherwise
 * "agree" that their first record is the same one and quietly overwrite one with
 * the other.
 *
 * A record is merged whole rather than field by field. Its fields are not
 * independent — `isOngoing` forbids an `endDate`, and an end date is checked
 * against the start — so half of one side's record beside half of the other's
 * can be something neither of them recorded and the domain refuses.
 *
 * Deleting is absence: a record the payload no longer lists is one that is gone,
 * which is how the restore preview counts removals and how the repositories
 * write them. There is no tombstone, and that is what makes a deletion on one
 * side and an edit on the other genuinely undecidable here — see below.
 */
function mergeRecordChoices(
  base: readonly PeriodRecord[],
  local: readonly PeriodRecord[],
  remote: readonly PeriodRecord[]
): RecordMerge[] {
  const baseById = byId(base);
  const localById = byId(local);
  const remoteById = byId(remote);

  return allRecordIds([base, local, remote]).map((id) => {
    const sides = {
      base: sideOf(baseById.get(id)),
      local: sideOf(localById.get(id)),
      remote: sideOf(remoteById.get(id)),
    };

    const resolved = resolve(sides.base, sides.local, sides.remote, samePeriodRecord);

    return {
      id,
      base: sides.base,
      local: sides.local,
      remote: sides.remote,
      chosen: resolved.value,
      reason: resolved.reason,
    };
  });
}

/**
 * The rules that are about the list rather than about one record.
 *
 * A payload may not hold two records starting on the same day, and may not hold
 * two ongoing periods. Both can be broken by changes that are each unambiguous
 * on their own: this phone moves one period's start date to the third, that
 * phone adds a period starting on the third, and neither edit is in doubt while
 * the pair of them is impossible.
 *
 * What happens then is the same as everywhere else. The records that moved are
 * put back to what was agreed and reported as conflicts; the records that did
 * not move are left alone, because they are not the ones in question. Putting
 * them back can uncover another collision — a date freed up here is a date
 * occupied there — so it runs until the list is quiet, which it always becomes:
 * every pass returns at least one more record to the base, and the base is a
 * payload that was valid.
 *
 * Returns the ids it had to put back, which is what turns into conflicts.
 */
function settleRecordCollisions(choices: readonly RecordMerge[]): void {
  for (let pass = 0; pass <= choices.length; pass += 1) {
    const chosen = choices.filter((choice) => choice.chosen.present);

    const byStartDate = new Map<string, RecordMerge[]>();

    for (const choice of chosen) {
      const record = choice.chosen as { readonly value: PeriodRecord };
      const sameDay = byStartDate.get(record.value.startDate) ?? [];

      sameDay.push(choice);
      byStartDate.set(record.value.startDate, sameDay);
    }

    const collided: { readonly choice: RecordMerge; readonly reason: CloudSyncConflictReason }[] =
      [];

    // Dates in their own order, so the same three payloads always produce the
    // same conflicts in the same order.
    for (const startDate of [...byStartDate.keys()].sort()) {
      const sharing = byStartDate.get(startDate) ?? [];

      if (sharing.length > 1) {
        for (const choice of sharing) {
          collided.push({ choice, reason: 'same-day' });
        }
      }
    }

    const ongoing = chosen.filter(
      (choice) => (choice.chosen as { readonly value: PeriodRecord }).value.isOngoing
    );

    if (ongoing.length > 1) {
      for (const choice of ongoing) {
        collided.push({ choice, reason: 'two-ongoing' });
      }
    }

    // Only the ones that moved. A record still holding what both sides agreed
    // on is not the reason the pair of them collides.
    const moved = collided.filter(
      ({ choice }) => !sameSide(choice.chosen, choice.base, samePeriodRecord)
    );

    if (moved.length === 0) {
      return;
    }

    for (const { choice, reason } of moved) {
      choice.chosen = choice.base;
      choice.reason = reason;
    }
  }
}

function recordConflicts(choices: readonly RecordMerge[]): CloudSyncConflict[] {
  return choices
    .filter((choice) => choice.reason !== null)
    .map((choice) => ({
      path: `periodRecords/${choice.id}`,
      reason: choice.reason as CloudSyncConflictReason,
      base: toConflictSide(choice.base),
      local: toConflictSide(choice.local),
      remote: toConflictSide(choice.remote),
    }));
}

/**
 * One recorded day reduced to the fields this app stores, in a fixed order.
 *
 * The symptoms are sorted before they are joined, because two devices can
 * hold the same day with its symptoms in different orders and a fingerprint
 * that cared would call the same day different.
 */
function fingerprintDailyEntry(entry: DailyEntry): Fingerprint {
  return [
    entry.date,
    entry.flowId,
    entry.moodId,
    [...entry.symptomIds].sort().join(','),
  ];
}

const sameDailyEntry = sameBy(fingerprintDailyEntry);

/**
 * The recorded days, merged a day at a time.
 *
 * The date is identity, which is what makes this simpler than the period
 * history: there is nothing to reconcile about *which* day two sides mean.
 *
 * A day is merged whole rather than field by field. Flow, mood and symptoms
 * are independent enough that a field-level merge would work, and it was left
 * out on purpose: it would turn "you wrote different things for the 14th" into
 * three separate questions about one day, and a person answering them cannot
 * see the day they add up to. Whole days also match how the screen edits them.
 *
 * Deleting is absence, as everywhere else here: a day the payload no longer
 * lists is a day somebody cleared.
 */
function mergeDailyEntries(
  base: readonly DailyEntry[],
  local: readonly DailyEntry[],
  remote: readonly DailyEntry[],
  conflicts: CloudSyncConflict[]
): readonly DailyEntry[] {
  const byDate = (entries: readonly DailyEntry[]) =>
    new Map(entries.map((entry) => [entry.date as string, entry]));

  const baseByDate = byDate(base);
  const localByDate = byDate(local);
  const remoteByDate = byDate(remote);

  const dates = new Set<string>([
    ...baseByDate.keys(),
    ...localByDate.keys(),
    ...remoteByDate.keys(),
  ]);

  // Sorted by code unit, exactly as the content hash sorts. A comparison
  // that depended on the device's language would order the same history
  // differently on two phones.
  const ordered = [...dates].sort((left, right) =>
    left === right ? 0 : left < right ? -1 : 1
  );

  const chosen: DailyEntry[] = [];

  for (const date of ordered) {
    const sides = {
      base: sideOf(baseByDate.get(date)),
      local: sideOf(localByDate.get(date)),
      remote: sideOf(remoteByDate.get(date)),
    };

    const resolved = resolve(sides.base, sides.local, sides.remote, sameDailyEntry);

    if (resolved.reason !== null) {
      conflicts.push({
        path: `dailyEntries/${date}`,
        reason: resolved.reason,
        base: toConflictSide(sides.base),
        local: toConflictSide(sides.local),
        remote: toConflictSide(sides.remote),
      });
    }

    if (resolved.value.present) {
      chosen.push(resolved.value.value);
    }
  }

  return sortDailyEntries(chosen);
}

function chosenRecords(choices: readonly RecordMerge[]): readonly PeriodRecord[] {
  return choices
    .filter((choice) => choice.chosen.present)
    .map((choice) => (choice.chosen as { readonly value: PeriodRecord }).value);
}

// ---------------------------------------------------------------------------

/**
 * Merges what is on the phone with what is in the account, against what the two
 * last agreed.
 *
 * All three payloads are validated first. Everything below depends on rules the
 * validator is the keeper of — that no two records share an id, that a record
 * is a record — and a merge that assumed them without checking would produce
 * its worst results on exactly the input that broke them.
 *
 * The result is validated too. It is assembled rather than copied, and the one
 * thing worse than refusing to merge is handing back a payload that the thing
 * storing it will refuse, after the person has been asked to approve it.
 *
 * Conflicts come back in the payload's own field order, and the records within
 * them by id, so the same three payloads always produce the same list in the
 * same order.
 *
 * Pure: nothing is mutated. Values that neither side changed are handed back by
 * reference, which is safe because every one of them is readonly.
 */
export function mergeCloudSyncPayload(input: CloudSyncMergeInput): CloudSyncMergeResult {
  if (typeof input !== 'object' || input === null) {
    throw new Error('mergeCloudSyncPayload received no payloads to merge.');
  }

  const { base, local, remote } = input;

  validateCloudSyncPayloadV1(base);
  validateCloudSyncPayloadV1(local);
  validateCloudSyncPayloadV1(remote);

  const conflicts: CloudSyncConflict[] = [];

  // In the payload's own field order, so the conflict list reads in it too.
  const cycleSettings = mergeSection(
    'cycleSettings',
    base.cycleSettings,
    local.cycleSettings,
    remote.cycleSettings,
    {
      same: sameBy(fingerprintCycleSettings),
      validate: validateCycleSettings,
      fieldMerge: mergeCycleSettingsFields,
    },
    conflicts
  );

  const choices = mergeRecordChoices(base.periodRecords, local.periodRecords, remote.periodRecords);
  settleRecordCollisions(choices);
  conflicts.push(...recordConflicts(choices));

  // Merged whole, on purpose, and this is the one section where that is not a
  // simplification. A due date means nothing apart from where it came from: a
  // date counted from the last period has to *be* the counted date, and one
  // somebody measured is theirs to set. Take this side's last-period date and
  // that side's due date and the result is a pregnancy neither of them is
  // tracking — which `validatePregnancyProfile` would refuse, and which a
  // person would have no way to recognise as wrong.
  const pregnancyProfile = mergeSection(
    'pregnancyProfile',
    base.pregnancyProfile,
    local.pregnancyProfile,
    remote.pregnancyProfile,
    { same: sameBy(fingerprintPregnancyProfile), validate: validatePregnancyProfile },
    conflicts
  );

  const avatarConfig = mergeSection(
    'avatarConfig',
    base.avatarConfig,
    local.avatarConfig,
    remote.avatarConfig,
    {
      same: sameBy(fingerprintAvatarConfig),
      validate: validateAvatarConfig,
      fieldMerge: mergeAvatarConfigFields,
    },
    conflicts
  );

  // Never absent on either side: "nothing chosen" is the defaults, so this one
  // always goes field by field and always comes back with a value.
  const notificationPreferences = mergeSection(
    'notificationPreferences',
    base.notificationPreferences,
    local.notificationPreferences,
    remote.notificationPreferences,
    {
      same: sameBy(fingerprintNotificationPreferences),
      validate: validateNotificationPreferences,
      fieldMerge: mergeNotificationPreferencesFields,
    },
    conflicts
  ) as NotificationPreferences;

  /**
  * Absent on a side written before the field existed, which reads as nothing
  * recorded rather than as everything deleted. Without this an older backup
  * would merge as a deletion of every day on the other side.
  */
  const dailyEntries = mergeDailyEntries(
    base.dailyEntries ?? [],
    local.dailyEntries ?? [],
    remote.dailyEntries ?? [],
    conflicts
  );

  const known: CloudSyncPayloadV1 = {
    version: CLOUD_SYNC_PAYLOAD_VERSION,
    cycleSettings,
    periodRecords: chosenRecords(choices),
    pregnancyProfile,
    avatarConfig,
    notificationPreferences,
    dailyEntries,
  };

  /**
   * Whatever a later build put in the account that this one has no meaning for.
   *
   * Taken from `remote` alone, and not from `base`. `remote` is the stored
   * state as it is now: if a later build removed one of its own fields, base
   * still has it and putting it back would be this build resurrecting data
   * somebody deleted. `local` cannot have any — it is built from this phone's
   * tables, and a field with no table cannot come out of one.
   *
   * Carried rather than merged, which is the honest description: two sides that
   * both edited such a field would still lose an edit here. That is why the
   * caller refuses to write at all when there is anything to carry, and why
   * this is the backstop rather than the protection.
   */
  const payload = carryUnknownCloudSyncPayloadFields(known, remote);

  validateCloudSyncPayloadV1(payload);

  return conflicts.length === 0
    ? { kind: 'merged', payload }
    : { kind: 'conflict', payload, conflicts };
}

/** Every path a merge could not settle, in the order it reported them. */
export function cloudSyncConflictPaths(result: CloudSyncMergeResult): readonly string[] {
  return result.kind === 'conflict' ? result.conflicts.map((conflict) => conflict.path) : [];
}
