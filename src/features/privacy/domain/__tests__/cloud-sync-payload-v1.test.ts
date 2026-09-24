import type { AvatarConfig } from '@/features/avatar/domain/avatar-config';
import type { CycleSettings, PeriodRecord } from '@/features/cycle/domain/types';
import type { NotificationPreferences } from '@/features/notifications/domain/notification-preferences';
import type { PregnancyProfile } from '@/features/pregnancy/domain/types';
import type { ISODate } from '@/types/iso-date';

import type { CloudSyncPayloadV1 } from '../cloud-sync-payload-v1';
import {
  CLOUD_SYNC_PAYLOAD_V1_FIELDS,
  CLOUD_SYNC_PAYLOAD_VERSION,
  parseCloudSyncPayloadV1,
  serializeCloudSyncPayloadV1,
  validateCloudSyncPayloadV1,
} from '../cloud-sync-payload-v1';

const date = (value: string) => value as ISODate;

function settings(): CycleSettings {
  return { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 };
}

function record(overrides: Partial<PeriodRecord> = {}): PeriodRecord {
  return {
    id: 'period-2026-09-02',
    startDate: date('2026-09-02'),
    endDate: date('2026-09-07'),
    isOngoing: false,
    ...overrides,
  };
}

function pregnancy(): PregnancyProfile {
  return {
    lastMenstrualPeriodStartDate: date('2026-09-02'),
    estimatedDueDate: date('2027-06-09'),
    dueDateSource: 'lmp',
  };
}

function avatar(): AvatarConfig {
  return {
    skinToneId: 'skin-tone-3',
    hairStyleId: 'wavy',
    hairColorId: 'dark-brown',
    outfitId: 'shirt',
  };
}

function preferences(): NotificationPreferences {
  return { periodReminderEnabled: true, pregnancyWeeklyReminderEnabled: false };
}

function payload(overrides: Partial<CloudSyncPayloadV1> = {}): CloudSyncPayloadV1 {
  return {
    version: 1,
    cycleSettings: settings(),
    periodRecords: [record()],
    pregnancyProfile: pregnancy(),
    avatarConfig: avatar(),
    notificationPreferences: preferences(),
    dailyEntries: [],
    ...overrides,
  };
}

describe('what a payload is made of', () => {
  it('carries the version it was written at', () => {
    expect(CLOUD_SYNC_PAYLOAD_VERSION).toBe(1);
  });

  it('has one field per category and nothing else', () => {
    expect([...CLOUD_SYNC_PAYLOAD_V1_FIELDS]).toEqual([
      'version',
      'cycleSettings',
      'periodRecords',
      'pregnancyProfile',
      'avatarConfig',
      'notificationPreferences',
      'dailyEntries',
    ]);
  });

  it('accepts a full one', () => {
    expect(() => validateCloudSyncPayloadV1(payload())).not.toThrow();
  });

  it('accepts one from someone who has entered nothing', () => {
    expect(() =>
      validateCloudSyncPayloadV1(
        payload({
          cycleSettings: null,
          periodRecords: [],
          pregnancyProfile: null,
          avatarConfig: null,
          notificationPreferences: {
            periodReminderEnabled: false,
            pregnancyWeeklyReminderEnabled: false,
          },
        })
      )
    ).not.toThrow();
  });

  it('accepts a history with no settings beside it, rather than losing it', () => {
    expect(() => validateCloudSyncPayloadV1(payload({ cycleSettings: null }))).not.toThrow();
  });
});

describe('what a payload never carries', () => {
  const derived = [
    'cycleDay',
    'phase',
    'fertility',
    'fertilityLevel',
    'moodLabels',
    'supportMessage',
    'dashboard',
    'calendar',
    'weeklyContent',
    'pregnancyWeek',
    'today',
    'snapshot',
    'widget',
    'scheduledNotificationIds',
    'notificationIdentifiers',
    'mode',
    'sources',
  ];

  it.each(derived)('has no %s', (field) => {
    expect(CLOUD_SYNC_PAYLOAD_V1_FIELDS as readonly string[]).not.toContain(field);
    expect(Object.keys(payload())).not.toContain(field);
  });

  it('serialises exactly the fields it declares', () => {
    const written = JSON.parse(serializeCloudSyncPayloadV1(payload())) as Record<string, unknown>;

    expect(Object.keys(written).sort()).toEqual([...CLOUD_SYNC_PAYLOAD_V1_FIELDS].sort());
  });

  it('carries no derived word anywhere in its text', () => {
    const text = serializeCloudSyncPayloadV1(payload());

    expect(text).not.toMatch(/cycleDay|phase|fertil|moodLabels|supportMessage|snapshot/i);
  });
});

describe('the version rule', () => {
  it.each([0, 2, '1', null, undefined])('refuses version %p', (version) => {
    expect(() => validateCloudSyncPayloadV1(payload({ version: version as 1 }))).toThrow(
      /expects version 1/
    );
  });

  it('names the version it found when that is a number', () => {
    expect(() => validateCloudSyncPayloadV1(payload({ version: 2 as 1 }))).toThrow(
      'CloudSyncPayloadV1 expects version 1, received 2.'
    );
  });
});

describe('the payload reuses the rules the app already has', () => {
  it('refuses cycle settings the app would refuse', () => {
    expect(() =>
      validateCloudSyncPayloadV1(
        payload({ cycleSettings: { averageCycleLengthDays: 3, averagePeriodLengthDays: 5 } })
      )
    ).toThrow(/averageCycleLengthDays/);
  });

  it('refuses a period record the app would refuse', () => {
    expect(() =>
      validateCloudSyncPayloadV1(
        payload({ periodRecords: [record({ startDate: date('2026-02-30') })] })
      )
    ).toThrow(/invalid startDate/);
  });

  it('refuses a pregnancy the app would refuse', () => {
    expect(() =>
      validateCloudSyncPayloadV1(
        payload({
          pregnancyProfile: { ...pregnancy(), estimatedDueDate: date('2027-06-10') },
        })
      )
    ).toThrow(/counted from the last menstrual period/);
  });

  it('refuses an avatar the app would refuse', () => {
    expect(() =>
      validateCloudSyncPayloadV1(payload({ avatarConfig: { ...avatar(), outfitId: '' } }))
    ).toThrow(/blank outfitId/);
  });

  it('refuses preferences the app would refuse', () => {
    expect(() =>
      validateCloudSyncPayloadV1(
        payload({
          notificationPreferences: {
            periodReminderEnabled: 1,
            pregnancyWeeklyReminderEnabled: false,
          } as unknown as NotificationPreferences,
        })
      )
    ).toThrow(/non-boolean periodReminderEnabled/);
  });

  it('refuses a list in place of a payload', () => {
    expect(() => validateCloudSyncPayloadV1([] as unknown as CloudSyncPayloadV1)).toThrow(
      /not a payload/
    );
  });
});

describe('the period record list', () => {
  it('refuses two records with the same id', () => {
    expect(() =>
      validateCloudSyncPayloadV1(
        payload({
          periodRecords: [
            record(),
            record({ startDate: date('2026-10-01'), endDate: date('2026-10-05') }),
          ],
        })
      )
    ).toThrow('CloudSyncPayloadV1 has two period records with the same id.');
  });

  it('refuses two records starting on the same day', () => {
    expect(() =>
      validateCloudSyncPayloadV1(payload({ periodRecords: [record(), record({ id: 'another' })] }))
    ).toThrow('CloudSyncPayloadV1 has two period records starting on the same day.');
  });

  it('refuses two periods running at once', () => {
    expect(() =>
      validateCloudSyncPayloadV1(
        payload({
          periodRecords: [
            record({ id: 'a', startDate: date('2026-09-02'), endDate: undefined, isOngoing: true }),
            record({ id: 'b', startDate: date('2026-10-02'), endDate: undefined, isOngoing: true }),
          ],
        })
      )
    ).toThrow(/2 ongoing period records/);
  });

  it.each([null, undefined, 'none', {}])('refuses periodRecords that are %p', (records) => {
    expect(() =>
      validateCloudSyncPayloadV1(
        payload({ periodRecords: records as unknown as readonly PeriodRecord[] })
      )
    ).toThrow(/periodRecords that are not a list/);
  });

  it('accepts a long history', () => {
    const history = Array.from({ length: 24 }, (_unused, index) => {
      const month = String((index % 12) + 1).padStart(2, '0');
      const year = 2025 + Math.floor(index / 12);

      return record({
        id: `period-${year}-${month}-02`,
        startDate: date(`${year}-${month}-02`),
        endDate: date(`${year}-${month}-07`),
      });
    });

    expect(() => validateCloudSyncPayloadV1(payload({ periodRecords: history }))).not.toThrow();
  });
});

describe('writing and reading a payload back', () => {
  it('reads back exactly what was written', () => {
    const original = payload();

    expect(parseCloudSyncPayloadV1(serializeCloudSyncPayloadV1(original))).toEqual(original);
  });

  it('reads back an empty one', () => {
    const original = payload({
      cycleSettings: null,
      periodRecords: [],
      pregnancyProfile: null,
      avatarConfig: null,
    });

    expect(parseCloudSyncPayloadV1(serializeCloudSyncPayloadV1(original))).toEqual(original);
  });

  it('keeps a field a later version added', () => {
    const text = JSON.stringify({ ...payload(), somethingNew: 'from a later build' });

    expect(parseCloudSyncPayloadV1(text)).toHaveProperty('somethingNew');
  });

  it.each([
    ['nothing', ''],
    ['half a payload', '{"version":1,'],
    ['not JSON at all', 'period history'],
  ])('refuses %s', (_label, text) => {
    expect(() => parseCloudSyncPayloadV1(text)).toThrow(
      'parseCloudSyncPayloadV1 could not read the payload as JSON.'
    );
  });

  it('refuses text from another version', () => {
    const text = JSON.stringify({ ...payload(), version: 2 });

    expect(() => parseCloudSyncPayloadV1(text)).toThrow(/expects version 1, received 2/);
  });

  it.each([null, 7, {}])('refuses %p in place of text', (json) => {
    expect(() => parseCloudSyncPayloadV1(json as unknown as string)).toThrow(/expects text/);
  });

  it('refuses text holding something that is not a payload', () => {
    expect(() => parseCloudSyncPayloadV1('"2026-09-02"')).toThrow(/not a payload/);
  });
});

describe('what an error about a payload gives away', () => {
  function messageFrom(broken: CloudSyncPayloadV1): string {
    try {
      validateCloudSyncPayloadV1(broken);
      return '';
    } catch (thrown) {
      return (thrown as Error).message;
    }
  }

  it.each([
    ['a bad start date', payload({ periodRecords: [record({ startDate: date('2026-02-30') })] })],
    [
      'a duplicated id',
      payload({ periodRecords: [record(), record({ startDate: date('2026-10-01') })] }),
    ],
    [
      'a due date that disagrees with its source',
      payload({ pregnancyProfile: { ...pregnancy(), estimatedDueDate: date('2027-06-10') } }),
    ],
    ['a blank avatar id', payload({ avatarConfig: { ...avatar(), hairColorId: '' } })],
  ])('names no date, id or catalogue id for %s', (_label, broken) => {
    const message = messageFrom(broken);

    expect(message).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(message).not.toMatch(/skin-tone|wavy|dark-brown|shirt|period-2026/);
  });

  it('names no payload contents when the whole thing is the wrong shape', () => {
    const message = messageFrom('2026-09-02' as unknown as CloudSyncPayloadV1);

    expect(message).toBe(
      'validateCloudSyncPayloadV1 received something that is not a payload: text.'
    );
  });

  it('gives away nothing through the JSON parser either', () => {
    const half = JSON.stringify(payload()).slice(0, 60);

    expect(() => parseCloudSyncPayloadV1(half)).toThrow(
      'parseCloudSyncPayloadV1 could not read the payload as JSON.'
    );
  });
});

describe('nothing is changed by being checked', () => {
  it('leaves the payload it validated alone', () => {
    const original = payload();
    const copy = JSON.parse(JSON.stringify(original)) as CloudSyncPayloadV1;

    validateCloudSyncPayloadV1(original);

    expect(original).toEqual(copy);
  });

  it('leaves the payload it serialised alone', () => {
    const original = payload();
    const copy = JSON.parse(JSON.stringify(original)) as CloudSyncPayloadV1;

    serializeCloudSyncPayloadV1(original);

    expect(original).toEqual(copy);
  });

  it('returns a payload that shares nothing with the text it was read from', () => {
    const original = payload();
    const parsed = parseCloudSyncPayloadV1(serializeCloudSyncPayloadV1(original));

    expect(parsed).not.toBe(original);
    expect(parsed.periodRecords).not.toBe(original.periodRecords);
  });
});
