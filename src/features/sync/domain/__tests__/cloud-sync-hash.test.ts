import type { PeriodRecord } from '@/features/cycle/domain/types';
import type { CloudSyncPayloadV1 } from '@/features/privacy/domain/cloud-sync-payload-v1';
import type { ISODate } from '@/types/iso-date';

import {
  buildCloudRestorePreviewV1,
  isRestoreWithoutChange,
} from '@/features/backup/domain/cloud-restore-preview-v1';

import { cloudSyncContentHash, isSameCloudSyncContent } from '../cloud-sync-hash';

const date = (value: string) => value as ISODate;

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
    dailyEntries: [],
    ...overrides,
  };
}

/** The same values with every object's keys in alphabetical order. */
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }

  if (typeof value !== 'object' || value === null) {
    return value;
  }

  const sorted = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a < b ? -1 : 1
  );

  return Object.fromEntries(sorted.map(([key, nested]) => [key, sortKeysDeep(nested)]));
}

/** A payload that has been to Firestore and back, values untouched. */
function asStored(value: CloudSyncPayloadV1): CloudSyncPayloadV1 {
  return sortKeysDeep(JSON.parse(JSON.stringify(value))) as CloudSyncPayloadV1;
}

describe('the shape of a content hash', () => {
  it('is sixteen hexadecimal characters', () => {
    expect(cloudSyncContentHash(payload())).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is the same answer every time it is asked', () => {
    const hash = cloudSyncContentHash(payload());

    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect(cloudSyncContentHash(payload())).toBe(hash);
    }
  });

  it('is the same for two payloads built separately', () => {
    expect(cloudSyncContentHash(payload())).toBe(cloudSyncContentHash(payload()));
  });

  it('is the same for an empty payload every time', () => {
    const empty = payload({
      cycleSettings: null,
      periodRecords: [],
      pregnancyProfile: null,
      avatarConfig: null,
    });

    expect(cloudSyncContentHash(empty)).toBe(cloudSyncContentHash(empty));
  });
});

describe('what a content hash ignores', () => {
  it('ignores the order the keys were written in', () => {
    const local = payload();

    expect(cloudSyncContentHash(asStored(local))).toBe(cloudSyncContentHash(local));
  });

  it('ignores a nested key order, field by field', () => {
    const local = payload();

    const remote = payload({
      avatarConfig: {
        outfitId: 'shirt',
        hairColorId: 'dark-brown',
        hairStyleId: 'wavy',
        skinToneId: 'skin-tone-3',
      } as CloudSyncPayloadV1['avatarConfig'],
      pregnancyProfile: {
        dueDateSource: 'lmp',
        estimatedDueDate: date('2027-06-09'),
        lastMenstrualPeriodStartDate: date('2026-09-02'),
      },
      notificationPreferences: {
        pregnancyWeeklyReminderEnabled: false,
        periodReminderEnabled: true,
      } as CloudSyncPayloadV1['notificationPreferences'],
      periodRecords: [
        {
          isOngoing: false,
          endDate: date('2026-09-07'),
          startDate: date('2026-09-02'),
          id: 'period-2026-09-02',
        },
      ],
    });

    expect(cloudSyncContentHash(remote)).toBe(cloudSyncContentHash(local));
  });

  it('ignores the order the records arrive in', () => {
    const first = record({ id: 'a', startDate: date('2026-07-02') });
    const second = record({ id: 'b', startDate: date('2026-08-02') });
    const third = record({ id: 'c', startDate: date('2026-09-02') });

    const ascending = payload({ periodRecords: [first, second, third] });
    const shuffled = payload({ periodRecords: [third, first, second] });
    const descending = payload({ periodRecords: [third, second, first] });

    expect(cloudSyncContentHash(shuffled)).toBe(cloudSyncContentHash(ascending));
    expect(cloudSyncContentHash(descending)).toBe(cloudSyncContentHash(ascending));
  });

  it('ignores a field this build does not know about', () => {
    const remote = payload({
      cycleSettings: {
        averageCycleLengthDays: 28,
        averagePeriodLengthDays: 5,
        somethingALaterBuildAdded: true,
      } as unknown as CloudSyncPayloadV1['cycleSettings'],
      periodRecords: [{ ...record(), writtenBy: 'another build' } as unknown as PeriodRecord],
    });

    expect(cloudSyncContentHash(remote)).toBe(cloudSyncContentHash(payload()));
  });

  it('ignores a field added to the payload itself', () => {
    const remote = {
      ...payload(),
      syncedBy: 'another build',
    } as unknown as CloudSyncPayloadV1;

    expect(cloudSyncContentHash(remote)).toBe(cloudSyncContentHash(payload()));
  });

  it('leaves the records it was given in the order it found them', () => {
    const records = [
      record({ id: 'c', startDate: date('2026-09-02') }),
      record({ id: 'a', startDate: date('2026-07-02') }),
    ];

    cloudSyncContentHash(payload({ periodRecords: records }));

    expect(records.map((entry) => entry.id)).toEqual(['c', 'a']);
  });
});

describe('what a content hash notices', () => {
  it.each([
    ['a cycle length', { cycleSettings: { averageCycleLengthDays: 30, averagePeriodLengthDays: 5 } }],
    ['a period length', { cycleSettings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 6 } }],
    ['no settings at all', { cycleSettings: null }],
    ['no pregnancy', { pregnancyProfile: null }],
    ['no avatar', { avatarConfig: null }],
    ['no records', { periodRecords: [] }],
    [
      'a reminder switch',
      {
        notificationPreferences: {
          periodReminderEnabled: false,
          pregnancyWeeklyReminderEnabled: false,
        },
      },
    ],
  ] as readonly (readonly [string, Partial<CloudSyncPayloadV1>])[])(
    'notices a change of %s',
    (_label, overrides) => {
      expect(cloudSyncContentHash(payload(overrides))).not.toBe(cloudSyncContentHash(payload()));
    }
  );

  it('notices the same id carrying different contents', () => {
    const changed = payload({ periodRecords: [record({ endDate: date('2026-09-08') })] });

    expect(cloudSyncContentHash(changed)).not.toBe(cloudSyncContentHash(payload()));
  });

  it.each([
    ['a start date', { startDate: date('2026-09-03') }],
    ['an end date', { endDate: date('2026-09-09') }],
    ['an end date that is now absent', { endDate: undefined, isOngoing: true }],
    ['the ongoing flag', { endDate: undefined, isOngoing: true }],
  ])('notices a change of %s on a record', (_label, overrides) => {
    const changed = payload({ periodRecords: [record(overrides)] });

    expect(cloudSyncContentHash(changed)).not.toBe(cloudSyncContentHash(payload()));
  });

  it('notices a record with a new id', () => {
    const added = payload({
      periodRecords: [record(), record({ id: 'period-2026-10-02', startDate: date('2026-10-02') })],
    });

    expect(cloudSyncContentHash(added)).not.toBe(cloudSyncContentHash(payload()));
  });

  it('notices a record that is no longer there', () => {
    const both = payload({
      periodRecords: [record(), record({ id: 'period-2026-10-02', startDate: date('2026-10-02') })],
    });

    expect(cloudSyncContentHash(payload())).not.toBe(cloudSyncContentHash(both));
  });

  it('notices a record whose id was renamed, contents and all', () => {
    const renamed = payload({ periodRecords: [record({ id: 'something-else' })] });

    expect(cloudSyncContentHash(renamed)).not.toBe(cloudSyncContentHash(payload()));
  });

  it('notices an avatar accessory that was chosen', () => {
    const withAccessory = payload({
      avatarConfig: { ...payload().avatarConfig!, accessoryId: 'earrings' },
    });

    expect(cloudSyncContentHash(withAccessory)).not.toBe(cloudSyncContentHash(payload()));
  });

  it('notices a payload version it has never seen', () => {
    const later = payload({ version: 2 as 1 });

    expect(cloudSyncContentHash(later)).not.toBe(cloudSyncContentHash(payload()));
  });

  it('tells two values apart that would join into the same text', () => {
    // `["a", "b"]` and `["ab"]` must not hash alike, which is why each value is
    // written with its own length.
    const left = payload({
      avatarConfig: {
        skinToneId: 'a',
        hairStyleId: 'b',
        hairColorId: 'dark-brown',
        outfitId: 'shirt',
      },
    });

    const right = payload({
      avatarConfig: {
        skinToneId: 'ab',
        hairStyleId: '',
        hairColorId: 'dark-brown',
        outfitId: 'shirt',
      },
    });

    expect(cloudSyncContentHash(left)).not.toBe(cloudSyncContentHash(right));
  });
});

describe('absent values, the way the preview reads them', () => {
  it('reads an accessory that is absent the same as one that is undefined', () => {
    const absent = payload({
      avatarConfig: {
        skinToneId: 'skin-tone-3',
        hairStyleId: 'wavy',
        hairColorId: 'dark-brown',
        outfitId: 'shirt',
      },
    });

    const undefinedAccessory = payload({
      avatarConfig: {
        skinToneId: 'skin-tone-3',
        hairStyleId: 'wavy',
        hairColorId: 'dark-brown',
        outfitId: 'shirt',
        accessoryId: undefined,
      },
    });

    expect(cloudSyncContentHash(undefinedAccessory)).toBe(cloudSyncContentHash(absent));
  });

  it('reads a record with no end date the same however it is written', () => {
    const absent = payload({
      periodRecords: [{ id: 'a', startDate: date('2026-09-02'), isOngoing: true }],
    });

    const undefinedEnd = payload({
      periodRecords: [
        { id: 'a', startDate: date('2026-09-02'), endDate: undefined, isOngoing: true },
      ],
    });

    expect(cloudSyncContentHash(undefinedEnd)).toBe(cloudSyncContentHash(absent));
  });

  it('tells a missing pregnancy from one that is there', () => {
    expect(cloudSyncContentHash(payload({ pregnancyProfile: null }))).not.toBe(
      cloudSyncContentHash(payload())
    );
  });

  it('tells an empty history from a single record', () => {
    expect(cloudSyncContentHash(payload({ periodRecords: [] }))).not.toBe(
      cloudSyncContentHash(payload())
    );
  });
});

describe('isSameCloudSyncContent', () => {
  it('says yes across a round trip', () => {
    expect(isSameCloudSyncContent(payload(), asStored(payload()))).toBe(true);
  });

  it('says no for a real difference', () => {
    expect(
      isSameCloudSyncContent(payload(), payload({ periodRecords: [record({ id: 'other' })] }))
    ).toBe(false);
  });
});

describe('the hash and the restore preview agree', () => {
  // Both answer "is this the same data?", from the same fingerprints. If they
  // ever disagreed, a sync would say nothing changed while the preview listed
  // changes, or the other way round.
  const pairs: readonly (readonly [string, CloudSyncPayloadV1, CloudSyncPayloadV1])[] = [
    ['two identical payloads', payload(), payload()],
    ['a payload and its stored form', payload(), asStored(payload())],
    [
      'records in another order',
      payload({
        periodRecords: [
          record({ id: 'a', startDate: date('2026-07-02') }),
          record({ id: 'b', startDate: date('2026-08-02') }),
        ],
      }),
      payload({
        periodRecords: [
          record({ id: 'b', startDate: date('2026-08-02') }),
          record({ id: 'a', startDate: date('2026-07-02') }),
        ],
      }),
    ],
    [
      'an unknown field on a record',
      payload(),
      payload({
        periodRecords: [{ ...record(), writtenBy: 'another build' } as unknown as PeriodRecord],
      }),
    ],
    ['a changed record', payload(), payload({ periodRecords: [record({ endDate: date('2026-09-08') })] })],
    ['an added record', payload(), payload({ periodRecords: [record(), record({ id: 'b' })] })],
    ['a removed record', payload(), payload({ periodRecords: [] })],
    [
      'changed settings',
      payload(),
      payload({ cycleSettings: { averageCycleLengthDays: 30, averagePeriodLengthDays: 5 } }),
    ],
    ['a removed pregnancy', payload(), payload({ pregnancyProfile: null })],
    [
      'an avatar accessory',
      payload(),
      payload({ avatarConfig: { ...payload().avatarConfig!, accessoryId: 'earrings' } }),
    ],
  ];

  it.each(pairs)('says the same as the preview about %s', (_label, local, remote) => {
    const sameByHash = isSameCloudSyncContent(local, remote);
    const sameByPreview = isRestoreWithoutChange(buildCloudRestorePreviewV1(local, remote));

    expect(sameByHash).toBe(sameByPreview);
  });
});
