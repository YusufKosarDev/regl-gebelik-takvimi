import type { PeriodRecord } from '@/features/cycle/domain/types';
import type { CloudSyncPayloadV1 } from '@/features/privacy/domain/cloud-sync-payload-v1';
import type { ISODate } from '@/types/iso-date';

import {
  buildCloudRestorePreviewV1,
  isRestoreWithoutChange,
} from '../cloud-restore-preview-v1';

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
    ...overrides,
  };
}

describe('a backup that matches the phone', () => {
  it('says everything is unchanged', () => {
    expect(buildCloudRestorePreviewV1(payload(), payload())).toEqual({
      cycleSettings: 'unchanged',
      periodRecords: { localCount: 1, remoteCount: 1, added: 0, removed: 0, changed: 0 },
      pregnancyProfile: 'unchanged',
      avatarConfig: 'unchanged',
      notificationPreferences: 'unchanged',
    });
  });

  it('is recognised as a restore that would do nothing', () => {
    expect(isRestoreWithoutChange(buildCloudRestorePreviewV1(payload(), payload()))).toBe(true);
  });

  it('says so for two empty sides as well', () => {
    const empty = payload({
      cycleSettings: null,
      periodRecords: [],
      pregnancyProfile: null,
      avatarConfig: null,
    });

    expect(isRestoreWithoutChange(buildCloudRestorePreviewV1(empty, empty))).toBe(true);
  });
});

describe('what would happen to one stored thing', () => {
  it.each([
    ['cycleSettings', { averageCycleLengthDays: 30, averagePeriodLengthDays: 5 }],
    [
      'pregnancyProfile',
      {
        lastMenstrualPeriodStartDate: date('2026-10-02'),
        estimatedDueDate: date('2027-07-09'),
        dueDateSource: 'lmp' as const,
      },
    ],
    [
      'avatarConfig',
      { skinToneId: 'skin-tone-5', hairStyleId: 'bun', hairColorId: 'red', outfitId: 'dress' },
    ],
    [
      'notificationPreferences',
      { periodReminderEnabled: false, pregnancyWeeklyReminderEnabled: true },
    ],
  ])('says %s would be replaced when both sides differ', (field, remoteValue) => {
    const preview = buildCloudRestorePreviewV1(
      payload(),
      payload({ [field]: remoteValue } as Partial<CloudSyncPayloadV1>)
    );

    expect(preview[field as 'cycleSettings']).toBe('replace');
  });

  it.each(['cycleSettings', 'pregnancyProfile', 'avatarConfig'] as const)(
    'says %s would be added when only the backup has it',
    (field) => {
      const preview = buildCloudRestorePreviewV1(
        payload({ [field]: null } as Partial<CloudSyncPayloadV1>),
        payload()
      );

      expect(preview[field]).toBe('add');
    }
  );

  it.each(['cycleSettings', 'pregnancyProfile', 'avatarConfig'] as const)(
    'says %s would be removed when only the phone has it',
    (field) => {
      const preview = buildCloudRestorePreviewV1(
        payload(),
        payload({ [field]: null } as Partial<CloudSyncPayloadV1>)
      );

      expect(preview[field]).toBe('remove');
    }
  );

  it.each(['cycleSettings', 'pregnancyProfile', 'avatarConfig'] as const)(
    'says %s is unchanged when neither side has it',
    (field) => {
      const without = payload({ [field]: null } as Partial<CloudSyncPayloadV1>);

      expect(buildCloudRestorePreviewV1(without, without)[field]).toBe('unchanged');
    }
  );

  it('notices a single changed field inside a stored value', () => {
    const preview = buildCloudRestorePreviewV1(
      payload(),
      payload({
        avatarConfig: {
          skinToneId: 'skin-tone-3',
          hairStyleId: 'wavy',
          hairColorId: 'dark-brown',
          outfitId: 'dress',
        },
      })
    );

    expect(preview.avatarConfig).toBe('replace');
  });

  it('notices an accessory that was added to an avatar', () => {
    const preview = buildCloudRestorePreviewV1(
      payload(),
      payload({
        avatarConfig: {
          skinToneId: 'skin-tone-3',
          hairStyleId: 'wavy',
          hairColorId: 'dark-brown',
          outfitId: 'shirt',
          accessoryId: 'earrings',
        },
      })
    );

    expect(preview.avatarConfig).toBe('replace');
  });
});

describe('what would happen to the period history', () => {
  it('counts what each side holds', () => {
    const preview = buildCloudRestorePreviewV1(
      payload({ periodRecords: [record(), record({ id: 'b', startDate: date('2026-10-02') })] }),
      payload({ periodRecords: [record()] })
    );

    expect(preview.periodRecords.localCount).toBe(2);
    expect(preview.periodRecords.remoteCount).toBe(1);
  });

  it('counts a record only the backup has as added', () => {
    const preview = buildCloudRestorePreviewV1(
      payload({ periodRecords: [] }),
      payload({ periodRecords: [record(), record({ id: 'b', startDate: date('2026-10-02') })] })
    );

    expect(preview.periodRecords).toEqual({
      localCount: 0,
      remoteCount: 2,
      added: 2,
      removed: 0,
      changed: 0,
    });
  });

  it('counts a record only the phone has as removed', () => {
    const preview = buildCloudRestorePreviewV1(
      payload({ periodRecords: [record(), record({ id: 'b', startDate: date('2026-10-02') })] }),
      payload({ periodRecords: [] })
    );

    expect(preview.periodRecords).toEqual({
      localCount: 2,
      remoteCount: 0,
      added: 0,
      removed: 2,
      changed: 0,
    });
  });

  it('counts the same id with different contents as changed', () => {
    const preview = buildCloudRestorePreviewV1(
      payload({ periodRecords: [record()] }),
      payload({ periodRecords: [record({ endDate: date('2026-09-08') })] })
    );

    expect(preview.periodRecords).toEqual({
      localCount: 1,
      remoteCount: 1,
      added: 0,
      removed: 0,
      changed: 1,
    });
  });

  it.each([
    ['a start date', { startDate: date('2026-09-03') }],
    ['an end date', { endDate: date('2026-09-09') }],
    ['an end date that is now absent', { endDate: undefined, isOngoing: true }],
    ['the ongoing flag', { endDate: undefined, isOngoing: true }],
  ])('counts a change of %s', (_label, overrides) => {
    const preview = buildCloudRestorePreviewV1(
      payload({ periodRecords: [record()] }),
      payload({ periodRecords: [record(overrides)] })
    );

    expect(preview.periodRecords.changed).toBe(1);
  });

  it('counts all three at once', () => {
    const local = [
      record({ id: 'stays', startDate: date('2026-07-02') }),
      record({ id: 'changes', startDate: date('2026-08-02') }),
      record({ id: 'goes', startDate: date('2026-09-02') }),
    ];

    const remote = [
      record({ id: 'stays', startDate: date('2026-07-02') }),
      record({ id: 'changes', startDate: date('2026-08-03') }),
      record({ id: 'arrives', startDate: date('2026-10-02') }),
    ];

    expect(
      buildCloudRestorePreviewV1(payload({ periodRecords: local }), payload({ periodRecords: remote }))
    ).toMatchObject({
      periodRecords: { localCount: 3, remoteCount: 3, added: 1, removed: 1, changed: 1 },
    });
  });

  it('is not fooled by a different order', () => {
    const first = record({ id: 'a', startDate: date('2026-08-02') });
    const second = record({ id: 'b', startDate: date('2026-09-02') });

    const preview = buildCloudRestorePreviewV1(
      payload({ periodRecords: [first, second] }),
      payload({ periodRecords: [second, first] })
    );

    expect(preview.periodRecords).toMatchObject({ added: 0, removed: 0, changed: 0 });
  });

  it('says a restore with only record changes would change something', () => {
    const preview = buildCloudRestorePreviewV1(
      payload({ periodRecords: [record()] }),
      payload({ periodRecords: [record({ endDate: date('2026-09-08') })] })
    );

    expect(isRestoreWithoutChange(preview)).toBe(false);
  });
});

describe('what a preview never carries', () => {
  const preview = buildCloudRestorePreviewV1(
    payload(),
    payload({
      periodRecords: [record({ id: 'period-2026-10-02', startDate: date('2026-10-02') })],
      avatarConfig: {
        skinToneId: 'skin-tone-5',
        hairStyleId: 'bun',
        hairColorId: 'red',
        outfitId: 'dress',
      },
    })
  );

  it('holds no date, id or catalogue id', () => {
    const text = JSON.stringify(preview);

    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(text).not.toMatch(/period-|skin-tone|wavy|bun|dress|shirt/);
  });

  it('holds no cycle or period length', () => {
    expect(JSON.stringify(preview)).not.toMatch(/averageCycleLengthDays|averagePeriodLengthDays/);
  });

  it('holds nothing worked out from either side', () => {
    expect(JSON.stringify(preview)).not.toMatch(/cycleDay|phase|fertil|mood|support|widget/i);
  });

  it('has the five fields the screen shows and no more', () => {
    expect(Object.keys(preview).sort()).toEqual([
      'avatarConfig',
      'cycleSettings',
      'notificationPreferences',
      'periodRecords',
      'pregnancyProfile',
    ]);
  });
});

describe('building a preview changes nothing', () => {
  it('leaves both payloads exactly as they were', () => {
    const local = payload();
    const remote = payload({ periodRecords: [] });
    const localCopy = JSON.parse(JSON.stringify(local)) as CloudSyncPayloadV1;
    const remoteCopy = JSON.parse(JSON.stringify(remote)) as CloudSyncPayloadV1;

    buildCloudRestorePreviewV1(local, remote);

    expect(local).toEqual(localCopy);
    expect(remote).toEqual(remoteCopy);
  });

  it('writes nothing to the console', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});

    buildCloudRestorePreviewV1(payload(), payload({ periodRecords: [] }));

    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();

    jest.restoreAllMocks();
  });
});

/**
 * The same values with every object's keys in alphabetical order.
 *
 * What a document looks like coming back from Firestore: the fields are there,
 * the values are there, and the order they were written in is not.
 */
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
function asStored(payload: CloudSyncPayloadV1): CloudSyncPayloadV1 {
  return sortKeysDeep(JSON.parse(JSON.stringify(payload))) as CloudSyncPayloadV1;
}

describe('a backup whose keys come back in another order', () => {
  it('says nothing changed when only the key order differs', () => {
    const local = payload();

    expect(buildCloudRestorePreviewV1(local, asStored(local))).toEqual({
      cycleSettings: 'unchanged',
      periodRecords: { localCount: 1, remoteCount: 1, added: 0, removed: 0, changed: 0 },
      pregnancyProfile: 'unchanged',
      avatarConfig: 'unchanged',
      notificationPreferences: 'unchanged',
    });
  });

  it('is recognised as a restore that would do nothing', () => {
    const local = payload();

    expect(isRestoreWithoutChange(buildCloudRestorePreviewV1(local, asStored(local)))).toBe(true);
  });

  it('says nothing changed for a whole history in another order', () => {
    const local = payload({
      periodRecords: [
        record({ id: 'a', startDate: date('2026-07-02'), endDate: date('2026-07-07') }),
        record({ id: 'b', startDate: date('2026-08-02'), endDate: undefined, isOngoing: true }),
        record({ id: 'c', startDate: date('2026-09-02'), endDate: date('2026-09-07') }),
      ],
    });

    expect(buildCloudRestorePreviewV1(local, asStored(local)).periodRecords).toMatchObject({
      added: 0,
      removed: 0,
      changed: 0,
    });
  });

  it.each([
    ['cycleSettings', 'cycleSettings'],
    ['pregnancyProfile', 'pregnancyProfile'],
    ['avatarConfig', 'avatarConfig'],
    ['notificationPreferences', 'notificationPreferences'],
  ] as const)('says %s is unchanged across the round trip', (_label, field) => {
    const local = payload();

    expect(buildCloudRestorePreviewV1(local, asStored(local))[field]).toBe('unchanged');
  });

  it('still sees a real difference through the round trip', () => {
    const local = payload();
    const remote = asStored(
      payload({ cycleSettings: { averageCycleLengthDays: 30, averagePeriodLengthDays: 5 } })
    );

    expect(buildCloudRestorePreviewV1(local, remote).cycleSettings).toBe('replace');
  });

  it('still counts a changed record through the round trip', () => {
    const local = payload();
    const remote = asStored(payload({ periodRecords: [record({ endDate: date('2026-09-08') })] }));

    expect(buildCloudRestorePreviewV1(local, remote).periodRecords.changed).toBe(1);
  });
});

describe('two plain objects whose keys are written in another order', () => {
  it('reads a flat object the same either way', () => {
    const local = payload({
      notificationPreferences: {
        periodReminderEnabled: true,
        pregnancyWeeklyReminderEnabled: false,
      },
    });

    const remote = payload({
      notificationPreferences: {
        pregnancyWeeklyReminderEnabled: false,
        periodReminderEnabled: true,
      } as CloudSyncPayloadV1['notificationPreferences'],
    });

    expect(buildCloudRestorePreviewV1(local, remote).notificationPreferences).toBe('unchanged');
  });

  it('reads a nested object the same either way', () => {
    const local = payload();

    const remote = payload({
      avatarConfig: {
        accessoryId: undefined,
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
      periodRecords: [
        {
          isOngoing: false,
          endDate: date('2026-09-07'),
          startDate: date('2026-09-02'),
          id: 'period-2026-09-02',
        },
      ],
    });

    expect(buildCloudRestorePreviewV1(local, remote)).toEqual({
      cycleSettings: 'unchanged',
      periodRecords: { localCount: 1, remoteCount: 1, added: 0, removed: 0, changed: 0 },
      pregnancyProfile: 'unchanged',
      avatarConfig: 'unchanged',
      notificationPreferences: 'unchanged',
    });
  });
});

describe('a stored value carrying a field this build does not know', () => {
  it('is not called a change, because a restore would not write it', () => {
    const local = payload();

    const remote = payload({
      cycleSettings: {
        averageCycleLengthDays: 28,
        averagePeriodLengthDays: 5,
        somethingALaterBuildAdded: true,
      } as unknown as CloudSyncPayloadV1['cycleSettings'],
    });

    expect(buildCloudRestorePreviewV1(local, remote).cycleSettings).toBe('unchanged');
  });

  it('is not called a change on a record either', () => {
    const local = payload();

    const remote = payload({
      periodRecords: [
        {
          ...record(),
          writtenBy: 'some other build',
        } as unknown as PeriodRecord,
      ],
    });

    expect(buildCloudRestorePreviewV1(local, remote).periodRecords.changed).toBe(0);
  });
});

describe('an absent optional field, however it is written', () => {
  it('treats an avatar with no accessory the same as one with the key missing', () => {
    const withoutKey = payload({
      avatarConfig: {
        skinToneId: 'skin-tone-3',
        hairStyleId: 'wavy',
        hairColorId: 'dark-brown',
        outfitId: 'shirt',
      },
    });

    const withUndefined = payload({
      avatarConfig: {
        skinToneId: 'skin-tone-3',
        hairStyleId: 'wavy',
        hairColorId: 'dark-brown',
        outfitId: 'shirt',
        accessoryId: undefined,
      },
    });

    expect(buildCloudRestorePreviewV1(withoutKey, withUndefined).avatarConfig).toBe('unchanged');
  });

  it('still sees an accessory that was chosen on one side only', () => {
    const withAccessory = payload({
      avatarConfig: { ...payload().avatarConfig!, accessoryId: 'earrings' },
    });

    // The fixture avatar has no accessory, so this is one side having chosen one.
    expect(buildCloudRestorePreviewV1(payload(), withAccessory).avatarConfig).toBe('replace');
    expect(buildCloudRestorePreviewV1(withAccessory, payload()).avatarConfig).toBe('replace');
  });

  it('treats a record with no end date the same however it is written', () => {
    const withoutKey = payload({
      periodRecords: [{ id: 'a', startDate: date('2026-09-02'), isOngoing: true }],
    });

    const withUndefined = payload({
      periodRecords: [
        { id: 'a', startDate: date('2026-09-02'), endDate: undefined, isOngoing: true },
      ],
    });

    expect(buildCloudRestorePreviewV1(withoutKey, withUndefined).periodRecords.changed).toBe(0);
  });
});

describe('the fields a comparison must not forget', () => {
  it.each([
    ['averageCycleLengthDays', { averageCycleLengthDays: 30, averagePeriodLengthDays: 5 }],
    ['averagePeriodLengthDays', { averageCycleLengthDays: 28, averagePeriodLengthDays: 6 }],
  ])('sees a change of %s', (_label, settings) => {
    expect(buildCloudRestorePreviewV1(payload(), payload({ cycleSettings: settings })).cycleSettings).toBe(
      'replace'
    );
  });

  it.each([
    ['lastMenstrualPeriodStartDate', { lastMenstrualPeriodStartDate: date('2026-09-03') }],
    ['estimatedDueDate', { estimatedDueDate: date('2027-06-10') }],
    ['dueDateSource', { dueDateSource: 'adjusted' as const }],
  ])('sees a change of %s', (_label, overrides) => {
    const remote = payload({
      pregnancyProfile: { ...payload().pregnancyProfile!, ...overrides },
    });

    expect(buildCloudRestorePreviewV1(payload(), remote).pregnancyProfile).toBe('replace');
  });

  it.each([
    ['skinToneId', { skinToneId: 'skin-tone-1' }],
    ['hairStyleId', { hairStyleId: 'bun' }],
    ['hairColorId', { hairColorId: 'red' }],
    ['outfitId', { outfitId: 'dress' }],
    ['accessoryId', { accessoryId: 'glasses' }],
  ])('sees a change of %s', (_label, overrides) => {
    const remote = payload({ avatarConfig: { ...payload().avatarConfig!, ...overrides } });

    expect(buildCloudRestorePreviewV1(payload(), remote).avatarConfig).toBe('replace');
  });

  it.each([
    ['periodReminderEnabled', { periodReminderEnabled: false }],
    ['pregnancyWeeklyReminderEnabled', { pregnancyWeeklyReminderEnabled: true }],
  ])('sees a change of %s', (_label, overrides) => {
    const remote = payload({
      notificationPreferences: { ...payload().notificationPreferences, ...overrides },
    });

    expect(buildCloudRestorePreviewV1(payload(), remote).notificationPreferences).toBe('replace');
  });

  it.each([
    ['id', { id: 'another' }],
    ['startDate', { startDate: date('2026-09-03') }],
    ['endDate', { endDate: date('2026-09-08') }],
    ['isOngoing', { endDate: undefined, isOngoing: true }],
  ])('sees a change of %s on a record', (label, overrides) => {
    const preview = buildCloudRestorePreviewV1(
      payload(),
      payload({ periodRecords: [record(overrides)] })
    );

    // A different id is a different record: one arrives and one goes.
    if (label === 'id') {
      expect(preview.periodRecords).toMatchObject({ added: 1, removed: 1, changed: 0 });

      return;
    }

    expect(preview.periodRecords.changed).toBe(1);
  });
});
