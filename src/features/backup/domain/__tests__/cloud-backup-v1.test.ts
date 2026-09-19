import type { CloudSyncPayloadV1 } from '@/features/privacy/domain/cloud-sync-payload-v1';
import type { ISODate } from '@/types/iso-date';

import type { CloudBackupV1 } from '../cloud-backup-v1';
import {
  CLOUD_BACKUP_V1_FIELDS,
  CLOUD_BACKUP_VERSION,
  parseCloudBackupV1,
  toUpdatedAt,
  validateCloudBackupV1,
} from '../cloud-backup-v1';

const date = (value: string) => value as ISODate;

function payload(overrides: Partial<CloudSyncPayloadV1> = {}): CloudSyncPayloadV1 {
  return {
    version: 1,
    cycleSettings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
    periodRecords: [
      {
        id: 'period-2026-09-02',
        startDate: date('2026-09-02'),
        endDate: date('2026-09-07'),
        isOngoing: false,
      },
    ],
    pregnancyProfile: null,
    avatarConfig: null,
    notificationPreferences: {
      periodReminderEnabled: true,
      pregnancyWeeklyReminderEnabled: false,
    },
    ...overrides,
  };
}

function backup(overrides: Partial<CloudBackupV1> = {}): CloudBackupV1 {
  return {
    version: 1,
    payload: payload(),
    updatedAt: '2026-09-19T06:00:00.000Z',
    ...overrides,
  };
}

describe('what a backup is made of', () => {
  it('carries the version it was written at', () => {
    expect(CLOUD_BACKUP_VERSION).toBe(1);
  });

  it('has three fields and no more', () => {
    expect([...CLOUD_BACKUP_V1_FIELDS]).toEqual(['version', 'payload', 'updatedAt']);
  });

  it('accepts a whole one', () => {
    expect(() => validateCloudBackupV1(backup())).not.toThrow();
  });

  it('accepts one the server has not stamped yet', () => {
    expect(() => validateCloudBackupV1(backup({ updatedAt: null }))).not.toThrow();
  });

  it.each([0, 2, '1', null, undefined])('refuses version %p', (version) => {
    expect(() => validateCloudBackupV1(backup({ version: version as 1 }))).toThrow(
      /expects version 1/
    );
  });

  it.each([7, {}, []])('refuses an updatedAt of %p', (updatedAt) => {
    expect(() =>
      validateCloudBackupV1(backup({ updatedAt: updatedAt as unknown as string }))
    ).toThrow(/updatedAt that is not text/);
  });

  it('refuses a payload the app itself would refuse', () => {
    expect(() =>
      validateCloudBackupV1(
        backup({
          payload: payload({
            periodRecords: [{ id: 'a', startDate: date('2026-02-30'), isOngoing: false }],
          }),
        })
      )
    ).toThrow(/invalid startDate/);
  });

  it.each([null, 'a backup', 7, []])('refuses %p in place of a backup', (value) => {
    expect(() => validateCloudBackupV1(value as unknown as CloudBackupV1)).toThrow(
      /not a backup|expects version 1/
    );
  });
});

describe('reading the time a backup was written', () => {
  it('maps a Firestore timestamp to an ISO string', () => {
    expect(toUpdatedAt({ seconds: 1789000000, nanoseconds: 0 })).toBe(
      new Date(1789000000 * 1000).toISOString()
    );
  });

  it('prefers the SDK’s own toDate when it is there', () => {
    const when = new Date('2026-09-19T06:00:00.000Z');

    expect(toUpdatedAt({ seconds: 1, nanoseconds: 0, toDate: () => when })).toBe(
      when.toISOString()
    );
  });

  it('keeps an ISO string that is already one', () => {
    expect(toUpdatedAt('2026-09-19T06:00:00.000Z')).toBe('2026-09-19T06:00:00.000Z');
  });

  it.each([
    ['nothing', null],
    ['undefined', undefined],
    ['text that is not a time', 'yesterday'],
    ['a number', 7],
    ['an empty object', {}],
    ['a toDate that gives nothing', { toDate: () => null }],
    ['a toDate that gives an invalid date', { toDate: () => new Date('nonsense') }],
  ])('says null for %s', (_label, value) => {
    expect(toUpdatedAt(value)).toBeNull();
  });
});

describe('parseCloudBackupV1', () => {
  it('reads a stored document into this app’s own backup', () => {
    const document = {
      version: 1,
      payload: payload(),
      updatedAt: { seconds: 1789000000, nanoseconds: 0 },
    };

    expect(parseCloudBackupV1(document)).toEqual({
      version: 1,
      payload: payload(),
      updatedAt: new Date(1789000000 * 1000).toISOString(),
    });
  });

  it('keeps only the three fields it knows', () => {
    const parsed = parseCloudBackupV1({
      version: 1,
      payload: payload(),
      updatedAt: null,
      writtenBy: 'some other build',
      _metadata: { fromCache: true },
    });

    expect(Object.keys(parsed).sort()).toEqual(['payload', 'updatedAt', 'version']);
  });

  it.each([null, 'a backup', 7, []])('refuses %p', (document) => {
    expect(() => parseCloudBackupV1(document)).toThrow(/not a document|not a backup/);
  });

  it('refuses a document from another version', () => {
    expect(() => parseCloudBackupV1({ version: 2, payload: payload(), updatedAt: null })).toThrow(
      /expects version 1/
    );
  });

  it('refuses a document whose payload is corrupt', () => {
    expect(() =>
      parseCloudBackupV1({
        version: 1,
        payload: payload({ cycleSettings: { averageCycleLengthDays: 3, averagePeriodLengthDays: 5 } }),
        updatedAt: null,
      })
    ).toThrow(/averageCycleLengthDays/);
  });

  it('names no stored value when it refuses', () => {
    const message = (() => {
      try {
        parseCloudBackupV1({
          version: 1,
          payload: payload({
            periodRecords: [{ id: 'a', startDate: date('2026-02-30'), isOngoing: false }],
          }),
          updatedAt: null,
        });

        return '';
      } catch (thrown) {
        return (thrown as Error).message;
      }
    })();

    expect(message).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

describe('what a backup never carries', () => {
  it.each([
    'cycleDay',
    'phase',
    'fertility',
    'moodLabels',
    'supportMessage',
    'snapshot',
    'widget',
    'scheduledNotificationIds',
    'mode',
    'uid',
    'email',
  ])('has no %s of its own', (field) => {
    expect([...CLOUD_BACKUP_V1_FIELDS] as readonly string[]).not.toContain(field);
    expect(Object.keys(backup())).not.toContain(field);
  });

  it('holds no account details: the path says whose it is', () => {
    expect(JSON.stringify(backup())).not.toMatch(/@example\.com|firebase-uid/);
  });

  it('changes nothing about what it was given', () => {
    const original = backup();
    const copy = JSON.parse(JSON.stringify(original)) as CloudBackupV1;

    validateCloudBackupV1(original);

    expect(original).toEqual(copy);
  });
});
