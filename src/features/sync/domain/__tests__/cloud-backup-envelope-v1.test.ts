import type { PeriodRecord } from '@/features/cycle/domain/types';
import type { CloudSyncPayloadV1 } from '@/features/privacy/domain/cloud-sync-payload-v1';
import { CLOUD_SYNC_PAYLOAD_V1_FIELDS } from '@/features/privacy/domain/cloud-sync-payload-v1';
import type { ISODate } from '@/types/iso-date';

import { cloudSyncContentHash } from '../cloud-sync-hash';
import type { CloudBackupEnvelopeV1 } from '../cloud-backup-envelope-v1';
import {
  CLOUD_BACKUP_DOCUMENT_FIELDS,
  CLOUD_BACKUP_ENVELOPE_V1_FIELDS,
  CLOUD_BACKUP_ENVELOPE_VERSION,
  LEGACY_CLOUD_BACKUP_REVISION,
  buildCloudBackupEnvelopeV1,
  cloudBackupDocumentFields,
  isCloudBackupEnvelopeConsistent,
  isLegacyCloudBackupDocument,
  parseCloudBackupEnvelopeV1,
  validateCloudBackupEnvelopeV1,
} from '../cloud-backup-envelope-v1';

const date = (value: string) => value as ISODate;

const DEVICE = 'device-abc123';

function record(overrides: Partial<PeriodRecord> = {}): PeriodRecord {
  return {
    id: 'period-2026-09-02',
    startDate: date('2026-09-02'),
    endDate: date('2026-09-07'),
    isOngoing: false,
    ...overrides,
  };
}

function payload(overrides: Partial<CloudSyncPayloadV1> = {}): CloudSyncPayloadV1 {
  return {
    version: 1,
    cycleSettings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
    periodRecords: [record()],
    pregnancyProfile: {
      lastMenstrualPeriodStartDate: date('2026-09-02'),
      estimatedDueDate: date('2027-06-09'),
      dueDateSource: 'lmp',
    },
    avatarConfig: {
      skinToneId: 'skin-tone-3',
      hairStyleId: 'wavy',
      hairColorId: 'dark-brown',
      outfitId: 'shirt',
    },
    notificationPreferences: {
      periodReminderEnabled: true,
      pregnancyWeeklyReminderEnabled: false,
    },
    ...overrides,
  };
}

function envelope(overrides: Partial<CloudBackupEnvelopeV1> = {}): CloudBackupEnvelopeV1 {
  return {
    version: 1,
    revision: 4,
    contentHash: cloudSyncContentHash(payload()),
    deviceId: DEVICE,
    updatedAt: '2026-09-20T06:00:00.000Z',
    payload: payload(),
    ...overrides,
  };
}

/** A document written by this build. */
function storedDocument(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    revision: 4,
    contentHash: cloudSyncContentHash(payload()),
    deviceId: DEVICE,
    updatedAt: { seconds: 1789000000, nanoseconds: 0 },
    payload: payload(),
    ...overrides,
  };
}

/** A document written before any of the sync bookkeeping existed. */
function legacyDocument(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    payload: payload(),
    updatedAt: { seconds: 1789000000, nanoseconds: 0 },
    ...overrides,
  };
}

const STAMPED = new Date(1789000000 * 1000).toISOString();

describe('building an envelope around a payload', () => {
  it('carries the version, the revision and the device', () => {
    const built = buildCloudBackupEnvelopeV1({ payload: payload(), revision: 4, deviceId: DEVICE });

    expect(built.version).toBe(CLOUD_BACKUP_ENVELOPE_VERSION);
    expect(built.revision).toBe(4);
    expect(built.deviceId).toBe(DEVICE);
  });

  it('hashes the payload with the one hash this app has', () => {
    const built = buildCloudBackupEnvelopeV1({ payload: payload(), revision: 1, deviceId: DEVICE });

    expect(built.contentHash).toBe(cloudSyncContentHash(payload()));
  });

  it('leaves the timestamp for the server', () => {
    const built = buildCloudBackupEnvelopeV1({ payload: payload(), revision: 1, deviceId: DEVICE });

    expect(built.updatedAt).toBeNull();
  });

  it('keeps the payload exactly as it was given', () => {
    const original = payload();
    const built = buildCloudBackupEnvelopeV1({ payload: original, revision: 1, deviceId: DEVICE });

    expect(built.payload).toEqual(original);
    expect(built.payload).toBe(original);
  });

  it('changes nothing about the payload it was given', () => {
    const original = payload();
    const copy = JSON.parse(JSON.stringify(original)) as CloudSyncPayloadV1;

    buildCloudBackupEnvelopeV1({ payload: original, revision: 1, deviceId: DEVICE });

    expect(original).toEqual(copy);
  });

  it('has the six fields it declares and no others', () => {
    const built = buildCloudBackupEnvelopeV1({ payload: payload(), revision: 1, deviceId: DEVICE });

    expect(Object.keys(built).sort()).toEqual([...CLOUD_BACKUP_ENVELOPE_V1_FIELDS].sort());
  });

  it('accepts the first revision a counted document can have', () => {
    expect(
      buildCloudBackupEnvelopeV1({ payload: payload(), revision: 0, deviceId: DEVICE }).revision
    ).toBe(0);
  });

  it.each([-1, 1.5, Number.NaN, '4' as unknown as number, null as unknown as number])(
    'refuses a revision of %p',
    (revision) => {
      expect(() =>
        buildCloudBackupEnvelopeV1({ payload: payload(), revision, deviceId: DEVICE })
      ).toThrow(/revision/);
    }
  );

  it.each(['', '   ', null as unknown as string, 7 as unknown as string])(
    'refuses a device id of %p',
    (deviceId) => {
      expect(() =>
        buildCloudBackupEnvelopeV1({ payload: payload(), revision: 1, deviceId })
      ).toThrow(/device id/);
    }
  );

  it('refuses a payload the app itself would refuse', () => {
    expect(() =>
      buildCloudBackupEnvelopeV1({
        payload: payload({ version: 2 as 1 }),
        revision: 1,
        deviceId: DEVICE,
      })
    ).toThrow(/expects version 1/);
  });

  it('is consistent with its own payload', () => {
    const built = buildCloudBackupEnvelopeV1({ payload: payload(), revision: 1, deviceId: DEVICE });

    expect(isCloudBackupEnvelopeConsistent(built)).toBe(true);
  });
});

describe('reading a document written by this build', () => {
  it('reads every field back', () => {
    expect(parseCloudBackupEnvelopeV1(storedDocument())).toEqual({
      version: 1,
      revision: 4,
      contentHash: cloudSyncContentHash(payload()),
      deviceId: DEVICE,
      updatedAt: STAMPED,
      payload: payload(),
    });
  });

  it('keeps the stored hash rather than recomputing it', () => {
    // A document whose hash does not match is a fact worth noticing, not one to
    // paper over on the way in.
    const parsed = parseCloudBackupEnvelopeV1(
      storedDocument({ contentHash: 'aaaaaaaabbbbbbbb' })
    );

    expect(parsed.contentHash).toBe('aaaaaaaabbbbbbbb');
    expect(isCloudBackupEnvelopeConsistent(parsed)).toBe(false);
  });

  it('maps a server timestamp to an ISO string', () => {
    expect(parseCloudBackupEnvelopeV1(storedDocument()).updatedAt).toBe(STAMPED);
  });

  it('copes with a document the server has not stamped yet', () => {
    expect(parseCloudBackupEnvelopeV1(storedDocument({ updatedAt: null })).updatedAt).toBeNull();
  });

  it('keeps only the fields it knows', () => {
    const parsed = parseCloudBackupEnvelopeV1(
      storedDocument({ writtenBy: 'a later build', _meta: { fromCache: true } })
    );

    expect(Object.keys(parsed).sort()).toEqual([...CLOUD_BACKUP_ENVELOPE_V1_FIELDS].sort());
  });

  it('is not called legacy', () => {
    expect(isLegacyCloudBackupDocument(storedDocument())).toBe(false);
  });
});

describe('reading a document written before the bookkeeping existed', () => {
  it('reads it rather than refusing it', () => {
    expect(() => parseCloudBackupEnvelopeV1(legacyDocument())).not.toThrow();
  });

  it('orders it before every counted write', () => {
    expect(parseCloudBackupEnvelopeV1(legacyDocument()).revision).toBe(
      LEGACY_CLOUD_BACKUP_REVISION
    );
    expect(LEGACY_CLOUD_BACKUP_REVISION).toBe(0);
  });

  it('works out the hash from the payload that is there', () => {
    const parsed = parseCloudBackupEnvelopeV1(legacyDocument());

    expect(parsed.contentHash).toBe(cloudSyncContentHash(payload()));
    expect(isCloudBackupEnvelopeConsistent(parsed)).toBe(true);
  });

  it('says the device is unknown rather than claiming this one', () => {
    expect(parseCloudBackupEnvelopeV1(legacyDocument()).deviceId).toBeNull();
  });

  it('keeps the timestamp it was stored with', () => {
    expect(parseCloudBackupEnvelopeV1(legacyDocument()).updatedAt).toBe(STAMPED);
  });

  it('keeps the payload exactly', () => {
    expect(parseCloudBackupEnvelopeV1(legacyDocument()).payload).toEqual(payload());
  });

  it('is recognised as legacy', () => {
    expect(isLegacyCloudBackupDocument(legacyDocument())).toBe(true);
  });

  it('refuses a payload that does not validate, old or not', () => {
    expect(() =>
      parseCloudBackupEnvelopeV1(
        legacyDocument({
          payload: payload({
            periodRecords: [{ id: 'a', startDate: date('2026-02-30'), isOngoing: false }],
          }),
        })
      )
    ).toThrow(/invalid startDate/);
  });

  it('refuses a legacy document with no payload at all', () => {
    expect(() => parseCloudBackupEnvelopeV1({ version: 1, updatedAt: null })).toThrow();
  });

  it('reads one written with half the bookkeeping', () => {
    // A build that recorded a revision but not a device, say.
    const parsed = parseCloudBackupEnvelopeV1(
      legacyDocument({ revision: 3, updatedAt: null })
    );

    expect(parsed.revision).toBe(3);
    expect(parsed.deviceId).toBeNull();
    expect(parsed.contentHash).toBe(cloudSyncContentHash(payload()));
  });
});

describe('what a document has to be to be read at all', () => {
  it.each([null, undefined, 'a backup', 7, []])('refuses %p', (document) => {
    expect(() => parseCloudBackupEnvelopeV1(document)).toThrow(/not a document|expects version/);
  });

  it.each([0, 2, '1', null, undefined])('refuses a document at version %p', (version) => {
    expect(() => parseCloudBackupEnvelopeV1(storedDocument({ version }))).toThrow(
      /expects version 1/
    );
  });

  it.each([-1, 1.5, '4'])('refuses a stored revision of %p', (revision) => {
    expect(() => parseCloudBackupEnvelopeV1(storedDocument({ revision }))).toThrow(/revision/);
  });

  it.each(['', '   ', 7])('refuses a stored content hash of %p', (contentHash) => {
    expect(() => parseCloudBackupEnvelopeV1(storedDocument({ contentHash }))).toThrow(
      /contentHash/
    );
  });

  it.each(['', '   ', 7])('refuses a stored device id of %p', (deviceId) => {
    expect(() => parseCloudBackupEnvelopeV1(storedDocument({ deviceId }))).toThrow(/deviceId/);
  });

  it('refuses a payload that is not one', () => {
    expect(() => parseCloudBackupEnvelopeV1(storedDocument({ payload: 'everything' }))).toThrow(
      /not a payload/
    );
  });

  it('names no stored value when it refuses', () => {
    const message = (() => {
      try {
        parseCloudBackupEnvelopeV1(
          storedDocument({
            payload: payload({
              periodRecords: [{ id: 'a', startDate: date('2026-02-30'), isOngoing: false }],
            }),
          })
        );

        return '';
      } catch (thrown) {
        return (thrown as Error).message;
      }
    })();

    expect(message).not.toMatch(/\d{4}-\d{2}-\d{2}|skin-tone|device-abc/);
  });
});

describe('validating an envelope', () => {
  it('accepts a whole one', () => {
    expect(() => validateCloudBackupEnvelopeV1(envelope())).not.toThrow();
  });

  it('accepts one with no device and no timestamp, as a legacy read gives', () => {
    expect(() =>
      validateCloudBackupEnvelopeV1(envelope({ deviceId: null, updatedAt: null }))
    ).not.toThrow();
  });

  it.each([-1, 1.5, '4' as unknown as number])('refuses a revision of %p', (revision) => {
    expect(() => validateCloudBackupEnvelopeV1(envelope({ revision }))).toThrow(/revision/);
  });

  it.each(['', '   ', 7 as unknown as string])('refuses a content hash of %p', (contentHash) => {
    expect(() => validateCloudBackupEnvelopeV1(envelope({ contentHash }))).toThrow(/contentHash/);
  });

  it.each(['', '   ', 7 as unknown as string])('refuses a device id of %p', (deviceId) => {
    expect(() => validateCloudBackupEnvelopeV1(envelope({ deviceId }))).toThrow(/deviceId/);
  });

  it.each([0 as 1, 2 as 1, '1' as unknown as 1])('refuses version %p', (version) => {
    expect(() => validateCloudBackupEnvelopeV1(envelope({ version }))).toThrow(/expects version 1/);
  });

  it('refuses a payload the app would refuse', () => {
    expect(() =>
      validateCloudBackupEnvelopeV1(
        envelope({
          payload: payload({
            cycleSettings: { averageCycleLengthDays: 3, averagePeriodLengthDays: 5 },
          }),
        })
      )
    ).toThrow(/averageCycleLengthDays/);
  });

  it.each([null, 'an envelope', 7, []])('refuses %p in place of an envelope', (value) => {
    expect(() =>
      validateCloudBackupEnvelopeV1(value as unknown as CloudBackupEnvelopeV1)
    ).toThrow(/not an envelope|expects version 1/);
  });
});

describe('the fields a document is written from', () => {
  it('are the five the server does not supply', () => {
    expect(Object.keys(cloudBackupDocumentFields(envelope())).sort()).toEqual(
      [...CLOUD_BACKUP_DOCUMENT_FIELDS].sort()
    );
  });

  it('leave the timestamp out, because the server writes it', () => {
    expect(cloudBackupDocumentFields(envelope())).not.toHaveProperty('updatedAt');
  });

  it('carry the payload through untouched', () => {
    expect(cloudBackupDocumentFields(envelope()).payload).toEqual(payload());
  });

  it('refuse an envelope that does not validate', () => {
    expect(() => cloudBackupDocumentFields(envelope({ contentHash: '' }))).toThrow(/contentHash/);
  });
});

describe('the payload keeps to itself', () => {
  it('holds none of the bookkeeping', () => {
    const built = buildCloudBackupEnvelopeV1({ payload: payload(), revision: 4, deviceId: DEVICE });

    for (const field of ['revision', 'contentHash', 'deviceId', 'updatedAt']) {
      expect(built.payload).not.toHaveProperty(field);
    }
  });

  it('still has exactly the fields the payload contract declares', () => {
    const built = buildCloudBackupEnvelopeV1({ payload: payload(), revision: 4, deviceId: DEVICE });

    expect(Object.keys(built.payload).sort()).toEqual([...CLOUD_SYNC_PAYLOAD_V1_FIELDS].sort());
  });

  it('is the same after a round trip through a document', () => {
    const built = buildCloudBackupEnvelopeV1({ payload: payload(), revision: 4, deviceId: DEVICE });
    const document = { ...cloudBackupDocumentFields(built), updatedAt: null };

    expect(parseCloudBackupEnvelopeV1(document).payload).toEqual(payload());
  });

  it('is not mutated by being parsed', () => {
    const document = storedDocument();
    const before = JSON.stringify(document);

    parseCloudBackupEnvelopeV1(document);

    expect(JSON.stringify(document)).toBe(before);
  });

  it('carries no account or device detail of its own', () => {
    const built = buildCloudBackupEnvelopeV1({ payload: payload(), revision: 4, deviceId: DEVICE });

    expect(JSON.stringify(built.payload)).not.toMatch(/device-abc|uid|@/);
  });
});

describe('the hash an envelope carries', () => {
  it('is the same for the same payload, every time', () => {
    const first = buildCloudBackupEnvelopeV1({ payload: payload(), revision: 1, deviceId: DEVICE });
    const second = buildCloudBackupEnvelopeV1({ payload: payload(), revision: 9, deviceId: 'other' });

    expect(second.contentHash).toBe(first.contentHash);
  });

  it('does not change when the keys are written in another order', () => {
    const reordered = payload({
      avatarConfig: {
        outfitId: 'shirt',
        hairColorId: 'dark-brown',
        hairStyleId: 'wavy',
        skinToneId: 'skin-tone-3',
      } as CloudSyncPayloadV1['avatarConfig'],
    });

    expect(
      buildCloudBackupEnvelopeV1({ payload: reordered, revision: 1, deviceId: DEVICE }).contentHash
    ).toBe(cloudSyncContentHash(payload()));
  });

  it('does not change when the records arrive in another order', () => {
    const first = record({ id: 'a', startDate: date('2026-07-02'), endDate: date('2026-07-07') });
    const second = record({ id: 'b', startDate: date('2026-08-02'), endDate: date('2026-08-07') });

    const ascending = buildCloudBackupEnvelopeV1({
      payload: payload({ periodRecords: [first, second] }),
      revision: 1,
      deviceId: DEVICE,
    });

    const descending = buildCloudBackupEnvelopeV1({
      payload: payload({ periodRecords: [second, first] }),
      revision: 1,
      deviceId: DEVICE,
    });

    expect(descending.contentHash).toBe(ascending.contentHash);
  });

  it('does not change for a field this build does not know', () => {
    const withExtra = payload({
      cycleSettings: {
        averageCycleLengthDays: 28,
        averagePeriodLengthDays: 5,
        somethingALaterBuildAdded: true,
      } as unknown as CloudSyncPayloadV1['cycleSettings'],
    });

    expect(
      buildCloudBackupEnvelopeV1({ payload: withExtra, revision: 1, deviceId: DEVICE }).contentHash
    ).toBe(cloudSyncContentHash(payload()));
  });

  it('changes for anything a restore would write', () => {
    const changed = payload({ periodRecords: [record({ endDate: date('2026-09-08') })] });

    expect(
      buildCloudBackupEnvelopeV1({ payload: changed, revision: 1, deviceId: DEVICE }).contentHash
    ).not.toBe(cloudSyncContentHash(payload()));
  });
});
