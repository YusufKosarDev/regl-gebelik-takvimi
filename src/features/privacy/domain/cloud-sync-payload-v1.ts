import type { AvatarConfig } from '@/features/avatar/domain/avatar-config';
import { validateAvatarConfig } from '@/features/avatar/domain/avatar-config';
import type { CycleSettings, PeriodRecord } from '@/features/cycle/domain/types';
import {
  validateCycleSettings,
  validatePeriodRecord,
} from '@/features/cycle/domain/validation';
import type { NotificationPreferences } from '@/features/notifications/domain/notification-preferences';
import { validateNotificationPreferences } from '@/features/notifications/domain/notification-preferences';
import type { PregnancyProfile } from '@/features/pregnancy/domain/types';
import { validatePregnancyProfile } from '@/features/pregnancy/domain/validation';
import { describeValue } from '@/shared/logging';

/**
 * Everything a sync would be allowed to carry, and nothing else.
 *
 * One field per category in `DATA_CATEGORIES`, each holding what the person
 * entered in the shape the domain already uses. There is no cycle day here, no
 * phase, no fertility window, no widget snapshot and no queued reminder: all of
 * those are worked out from these fields, and sending an answer as well as the
 * question is how two devices end up disagreeing about the same day.
 *
 * Nothing sends this anywhere. There is no account and no network call in this
 * app. This is the contract a sync would have to fit into, written first.
 */
export type CloudSyncPayloadV1 = {
  readonly version: 1;
  /** `null` before onboarding has written any settings. */
  readonly cycleSettings: CycleSettings | null;
  /** Empty before anything has been recorded; never absent. */
  readonly periodRecords: readonly PeriodRecord[];
  /** `null` when no pregnancy is being tracked. */
  readonly pregnancyProfile: PregnancyProfile | null;
  /** `null` before anyone has chosen an avatar. */
  readonly avatarConfig: AvatarConfig | null;
  /** Always present: "nothing chosen" is the defaults, not an absence. */
  readonly notificationPreferences: NotificationPreferences;
};

/**
 * The version this file reads and writes.
 *
 * A payload that says anything else is refused rather than read as far as it
 * can be. Fields move between versions, and a reader that guessed would be
 * writing someone's period history into the wrong shape.
 */
export const CLOUD_SYNC_PAYLOAD_VERSION = 1;

/** The keys a payload of this version is built from. */
export const CLOUD_SYNC_PAYLOAD_V1_FIELDS = [
  'version',
  'cycleSettings',
  'periodRecords',
  'pregnancyProfile',
  'avatarConfig',
  'notificationPreferences',
] as const satisfies readonly (keyof CloudSyncPayloadV1)[];

function assertVersion(version: unknown): void {
  if (version !== CLOUD_SYNC_PAYLOAD_VERSION) {
    throw new Error(
      `CloudSyncPayloadV1 expects version ${CLOUD_SYNC_PAYLOAD_VERSION}, received ` +
        `${typeof version === 'number' ? version : describeValue(version)}.`
    );
  }
}

/**
 * The period records, as a list rather than as part of a profile.
 *
 * `validateCycleProfile` is not reused here because a payload can hold records
 * with no settings beside them — a settings row can be missing from a restore
 * while the history is intact, and refusing the whole payload for that would
 * throw away the part that cannot be recovered any other way. The per-record
 * rules are the domain's, and the list-level ones are stated here.
 */
function assertPeriodRecords(records: unknown): void {
  if (!Array.isArray(records)) {
    throw new Error(
      `CloudSyncPayloadV1 has periodRecords that are not a list: ${describeValue(records)}.`
    );
  }

  const seenIds = new Set<string>();
  const seenStartDates = new Set<string>();
  let ongoingCount = 0;

  for (const record of records as readonly PeriodRecord[]) {
    validatePeriodRecord(record);

    if (seenIds.has(record.id)) {
      throw new Error('CloudSyncPayloadV1 has two period records with the same id.');
    }
    seenIds.add(record.id);

    if (seenStartDates.has(record.startDate)) {
      throw new Error('CloudSyncPayloadV1 has two period records starting on the same day.');
    }
    seenStartDates.add(record.startDate);

    if (record.isOngoing) {
      ongoingCount += 1;
    }
  }

  // Only one period can be happening at a time, whichever device recorded it.
  if (ongoingCount > 1) {
    throw new Error(
      `CloudSyncPayloadV1 has ${ongoingCount} ongoing period records; at most 1 is valid.`
    );
  }
}

/**
 * Checks one payload, throwing on the first rule it breaks.
 *
 * Every field is checked by the validator the app already uses for it, so a
 * payload cannot carry something the app itself would refuse to store. The
 * nullable fields are checked only when they are there; `null` is a real
 * answer, and `undefined` is not.
 *
 * No message names a value. What is in these fields is a period history and a
 * due date, and an error about them is not a place to repeat them.
 *
 * Pure: nothing is mutated and the payload is read exactly as given.
 */
export function validateCloudSyncPayloadV1(payload: CloudSyncPayloadV1): void {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new Error(
      `validateCloudSyncPayloadV1 received something that is not a payload: ${describeValue(
        payload
      )}.`
    );
  }

  assertVersion(payload.version);

  if (payload.cycleSettings !== null) {
    validateCycleSettings(payload.cycleSettings);
  }

  assertPeriodRecords(payload.periodRecords);

  if (payload.pregnancyProfile !== null) {
    validatePregnancyProfile(payload.pregnancyProfile);
  }

  if (payload.avatarConfig !== null) {
    validateAvatarConfig(payload.avatarConfig);
  }

  validateNotificationPreferences(payload.notificationPreferences);
}

/**
 * The payload as the text a sync would carry.
 *
 * Validated before it is written: text that could not be read back is not
 * something to hand to anything, least of all to something that would keep it.
 */
export function serializeCloudSyncPayloadV1(payload: CloudSyncPayloadV1): string {
  validateCloudSyncPayloadV1(payload);

  return JSON.stringify(payload);
}

/**
 * The payload a piece of text claims to be.
 *
 * Everything is checked again on the way in. Text that has been anywhere other
 * than this app's own memory is not something this app wrote a moment ago, and
 * a restore is exactly the moment to stop trusting that it was.
 *
 * Fields the reader does not know are kept rather than refused, so a payload
 * written by a later build that only *added* fields still reads. A different
 * `version` is refused outright, because that is the marker for fields that
 * moved rather than fields that appeared.
 */
export function parseCloudSyncPayloadV1(json: string): CloudSyncPayloadV1 {
  if (typeof json !== 'string') {
    throw new Error(`parseCloudSyncPayloadV1 expects text, received ${describeValue(json)}.`);
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch {
    // The parser quotes the text it choked on, and that text is someone's
    // period history, so its message is dropped rather than wrapped.
    throw new Error('parseCloudSyncPayloadV1 could not read the payload as JSON.');
  }

  validateCloudSyncPayloadV1(parsed as CloudSyncPayloadV1);

  return parsed as CloudSyncPayloadV1;
}

/**
 * The keys in a payload that this build has no meaning for.
 *
 * Derived rather than declared. A later build that adds a field does not have
 * to remember to announce it anywhere: the field itself is the announcement,
 * and every earlier build can see it by comparing what it was handed against
 * what it knows. A marker stored beside the payload could be forgotten, could
 * be wrong, and would only work for builds shipped after the marker existed.
 *
 * This is the whole basis of the rule that nothing may overwrite what it cannot
 * reproduce: a non-empty answer means this build would be writing a smaller
 * payload than the one it read, and the difference is somebody's data.
 *
 * Pure: the payload is read and never mutated.
 */
export function unknownCloudSyncPayloadFields(payload: CloudSyncPayloadV1): readonly string[] {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return [];
  }

  const known = new Set<string>(CLOUD_SYNC_PAYLOAD_V1_FIELDS);

  return Object.keys(payload).filter((key) => !known.has(key));
}

/**
 * Whether this build could write the payload it was handed without losing any
 * of it.
 */
export function canReproduceCloudSyncPayload(payload: CloudSyncPayloadV1): boolean {
  return unknownCloudSyncPayloadFields(payload).length === 0;
}

/**
 * A payload with the fields this build does not understand copied onto it.
 *
 * `target` is this build's answer and wins every field it owns: it is the
 * merged result, and the point of merging was to work those out. `source` is
 * the payload that came from outside, and contributes only what `target` could
 * not have had an opinion about.
 *
 * This is the backstop rather than the defence. The defence is refusing to
 * write at all when there is something here to carry — a field carried through
 * is a field kept, not a field merged, and two sides that both edited one would
 * still lose an edit. But if a write does happen, it should take everything
 * with it rather than nothing.
 *
 * Pure: neither argument is mutated and the result is a new object.
 */
export function carryUnknownCloudSyncPayloadFields(
  target: CloudSyncPayloadV1,
  source: CloudSyncPayloadV1
): CloudSyncPayloadV1 {
  const unknown = unknownCloudSyncPayloadFields(source);

  if (unknown.length === 0) {
    return target;
  }

  const carried: Record<string, unknown> = { ...target };

  for (const key of unknown) {
    carried[key] = (source as unknown as Record<string, unknown>)[key];
  }

  return carried as unknown as CloudSyncPayloadV1;
}
