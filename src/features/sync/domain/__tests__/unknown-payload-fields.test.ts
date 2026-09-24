import type { CloudSyncPayloadV1 } from '@/features/privacy/domain/cloud-sync-payload-v1';
import {
  CLOUD_SYNC_PAYLOAD_V1_FIELDS,
  carryUnknownCloudSyncPayloadFields,
  parseCloudSyncPayloadV1,
  serializeCloudSyncPayloadV1,
  unknownCloudSyncPayloadFields,
  validateCloudSyncPayloadV1,
} from '@/features/privacy/domain/cloud-sync-payload-v1';

import { cloudSyncContentHash } from '../cloud-sync-hash';
import { mergeCloudSyncPayload } from '../merge-cloud-sync-payload';

/**
 * What happens when a newer build has written the backup.
 *
 * One rule underneath all of it: never overwrite what you cannot reproduce. A
 * build that does not understand a field must be able to read past it, must not
 * drop it, and must not push over it.
 */

const FUTURE_FIELD = 'dailyEntries';

const FUTURE_VALUE = [
  { date: '2026-10-14', flow: 'medium', mood: 'good', symptoms: ['cramps'] },
];

function payload(overrides: Partial<CloudSyncPayloadV1> = {}): CloudSyncPayloadV1 {
  return {
    version: 1,
    cycleSettings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
    periodRecords: [],
    pregnancyProfile: null,
    avatarConfig: null,
    notificationPreferences: {
      periodReminderEnabled: false,
      pregnancyWeeklyReminderEnabled: false,
    },
    ...overrides,
  };
}

/** A payload as a later build would have written it: the same, plus one field. */
function withFutureField(base: CloudSyncPayloadV1 = payload()): CloudSyncPayloadV1 {
  return { ...base, [FUTURE_FIELD]: FUTURE_VALUE } as unknown as CloudSyncPayloadV1;
}

/** Reads a field the type does not have, which is the whole point here. */
function futureFieldOf(value: CloudSyncPayloadV1): unknown {
  return (value as unknown as Record<string, unknown>)[FUTURE_FIELD];
}

const OTHER_SETTINGS = { averageCycleLengthDays: 30, averagePeriodLengthDays: 5 };

describe('1. a payload with a field this build does not know', () => {
  it('parses rather than being refused', () => {
    // A refusal here would lock somebody out of their own backup because a
    // newer phone touched it.
    expect(() => parseCloudSyncPayloadV1(JSON.stringify(withFutureField()))).not.toThrow();
  });

  it('keeps the field it does not know', () => {
    const parsed = parseCloudSyncPayloadV1(JSON.stringify(withFutureField()));

    expect(futureFieldOf(parsed)).toEqual(FUTURE_VALUE);
  });

  it('passes validation, because an unknown field is not an invalid one', () => {
    expect(() => validateCloudSyncPayloadV1(withFutureField())).not.toThrow();
  });

  it('is named by unknownCloudSyncPayloadFields', () => {
    expect(unknownCloudSyncPayloadFields(withFutureField())).toEqual([FUTURE_FIELD]);
  });

  it('reports nothing for a payload this build wrote itself', () => {
    expect(unknownCloudSyncPayloadFields(payload())).toEqual([]);
  });

  it('never calls one of its own fields unknown', () => {
    // Guards against the field list and the type drifting apart.
    const reported = unknownCloudSyncPayloadFields(payload());

    for (const field of CLOUD_SYNC_PAYLOAD_V1_FIELDS) {
      expect(reported).not.toContain(field);
    }
  });
});

describe('2. a merge keeps what it cannot merge', () => {
  it('carries an unknown field from the account through the merge', () => {
    // The destruction path. The phone builds its payload from its own tables,
    // which cannot hold a field it has no table for. If the merge drops the
    // account copy, the push that follows erases it.
    const result = mergeCloudSyncPayload({
      base: payload(),
      local: payload({ cycleSettings: OTHER_SETTINGS }),
      remote: withFutureField(),
    });

    expect(result.kind).toBe('merged');
    expect(futureFieldOf(result.payload)).toEqual(FUTURE_VALUE);
  });

  it('still merges the fields it does understand', () => {
    const result = mergeCloudSyncPayload({
      base: payload(),
      local: payload({ cycleSettings: OTHER_SETTINGS }),
      remote: withFutureField(),
    });

    expect(result.payload.cycleSettings).toEqual(OTHER_SETTINGS);
  });

  it('follows the account when it removed a field the base had', () => {
    // The account is the newer stored state. Resurrecting a field from the
    // base would be this build inventing data a later one deleted on purpose.
    const result = mergeCloudSyncPayload({
      base: withFutureField(),
      local: payload({ cycleSettings: OTHER_SETTINGS }),
      remote: payload(),
    });

    expect(unknownCloudSyncPayloadFields(result.payload)).toEqual([]);
  });

  it('carries it through a merge that ended in conflict too', () => {
    const result = mergeCloudSyncPayload({
      base: payload(),
      local: payload({ cycleSettings: OTHER_SETTINGS }),
      remote: withFutureField(
        payload({ cycleSettings: { averageCycleLengthDays: 26, averagePeriodLengthDays: 5 } })
      ),
    });

    expect(result.kind).toBe('conflict');
    expect(futureFieldOf(result.payload)).toEqual(FUTURE_VALUE);
  });
});

describe('3. carrying fields across explicitly', () => {
  it('copies what the source has and the target does not', () => {
    const carried = carryUnknownCloudSyncPayloadFields(payload(), withFutureField());

    expect(unknownCloudSyncPayloadFields(carried)).toEqual([FUTURE_FIELD]);
  });

  it('never lets the source overwrite a field this build owns', () => {
    const carried = carryUnknownCloudSyncPayloadFields(
      payload({ cycleSettings: OTHER_SETTINGS }),
      withFutureField(payload())
    );

    expect(carried.cycleSettings).toEqual(OTHER_SETTINGS);
  });

  it('leaves the target alone when the source has nothing extra', () => {
    const target = payload();

    expect(carryUnknownCloudSyncPayloadFields(target, payload())).toEqual(target);
  });

  it('does not mutate either side', () => {
    const target = payload();
    const source = withFutureField();
    const targetBefore = JSON.stringify(target);
    const sourceBefore = JSON.stringify(source);

    carryUnknownCloudSyncPayloadFields(target, source);

    expect(JSON.stringify(target)).toBe(targetBefore);
    expect(JSON.stringify(source)).toBe(sourceBefore);
  });
});

describe('4. a payload written before the field existed', () => {
  it('reads as it always did', () => {
    // The other direction. Nothing here may make yesterday backup unreadable.
    expect(() => parseCloudSyncPayloadV1(JSON.stringify(payload()))).not.toThrow();
  });

  it('is reported as having nothing unknown in it', () => {
    expect(unknownCloudSyncPayloadFields(payload())).toEqual([]);
  });
});

describe('6. a different version is still refused outright', () => {
  it('refuses version 2', () => {
    // An added field is compatible; a moved one is not, and the version number
    // is the marker for the second. None of the above may soften this.
    const moved = { ...payload(), version: 2 } as unknown as CloudSyncPayloadV1;

    expect(() => validateCloudSyncPayloadV1(moved)).toThrow();
  });

  it('refuses a version this build has never heard of', () => {
    const moved = { ...payload(), version: 99 } as unknown as CloudSyncPayloadV1;

    expect(() => validateCloudSyncPayloadV1(moved)).toThrow();
  });
});

describe('7 and 8. what the hash answers', () => {
  it('is blind to a field this build does not know', () => {
    // Deliberate, and argued in cloud-sync-hash.ts. The hash answers "would a
    // restore write something different?", and this build cannot write a field
    // it has no table for. Noticing the field is the guard job, at the write.
    expect(cloudSyncContentHash(withFutureField())).toBe(cloudSyncContentHash(payload()));
  });

  it('still changes when something this build does know changes', () => {
    expect(cloudSyncContentHash(payload({ cycleSettings: OTHER_SETTINGS }))).not.toBe(
      cloudSyncContentHash(payload())
    );
  });

  it('does not care what order the keys arrived in', () => {
    // A document that has been to Firestore and back does not come home with
    // its keys in the order they left in.
    const reordered = JSON.parse(
      JSON.stringify({
        notificationPreferences: payload().notificationPreferences,
        avatarConfig: null,
        periodRecords: [],
        version: 1,
        pregnancyProfile: null,
        cycleSettings: payload().cycleSettings,
      })
    ) as CloudSyncPayloadV1;

    expect(cloudSyncContentHash(reordered)).toBe(cloudSyncContentHash(payload()));
  });

  it('survives a round trip through text', () => {
    const roundTripped = parseCloudSyncPayloadV1(serializeCloudSyncPayloadV1(payload()));

    expect(cloudSyncContentHash(roundTripped)).toBe(cloudSyncContentHash(payload()));
  });
});
