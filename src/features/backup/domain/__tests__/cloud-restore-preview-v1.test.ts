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
