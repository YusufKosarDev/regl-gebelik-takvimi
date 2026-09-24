import type { DailyEntry } from '@/features/daily-log/domain/catalogues';
import type { CloudSyncPayloadV1 } from '@/features/privacy/domain/cloud-sync-payload-v1';
import {
  parseCloudSyncPayloadV1,
  serializeCloudSyncPayloadV1,
  validateCloudSyncPayloadV1,
} from '@/features/privacy/domain/cloud-sync-payload-v1';
import { buildCloudRestorePreviewV1 } from '@/features/backup/domain/cloud-restore-preview-v1';
import { cloudSyncContentHash } from '@/features/sync/domain/cloud-sync-hash';
import { mergeCloudSyncPayload } from '@/features/sync/domain/merge-cloud-sync-payload';
import type { ISODate } from '@/types/iso-date';

/**
 * Daily entries crossing the boundary between two devices.
 *
 * `dailyEntries` was added to payload version 1 rather than making a version 2.
 * The cost of that choice is that a backup written before the field existed has
 * to keep reading, and the tests for that are the point of this file.
 */

const date = (value: string) => value as ISODate;

function entry(overrides: Partial<DailyEntry> = {}): DailyEntry {
  return {
    date: date('2026-10-14'),
    flowId: 'medium',
    moodId: 'good',
    symptomIds: ['cramps'],
    ...overrides,
  };
}

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
    dailyEntries: [],
    ...overrides,
  };
}

/** A backup as it was written before this field existed. */
function withoutTheField(): CloudSyncPayloadV1 {
  const { dailyEntries, ...rest } = payload();

  void dailyEntries;

  return rest as CloudSyncPayloadV1;
}

describe('a backup written before daily entries existed', () => {
  it('still parses', () => {
    // The whole reason this is an added field on version 1 rather than a
    // version 2: an older document has to keep opening.
    expect(() => parseCloudSyncPayloadV1(JSON.stringify(withoutTheField()))).not.toThrow();
  });

  it('still validates', () => {
    expect(() => validateCloudSyncPayloadV1(withoutTheField())).not.toThrow();
  });

  it('hashes the same as one that records nothing', () => {
    // Absent and empty mean the same thing, and two devices holding each must
    // not think they disagree.
    expect(cloudSyncContentHash(withoutTheField())).toBe(cloudSyncContentHash(payload()));
  });

  it('is not read as an instruction to delete every day', () => {
    // The dangerous reading. An older backup merging as "delete everything"
    // would quietly wipe a history the other phone had just written.
    const result = mergeCloudSyncPayload({
      base: withoutTheField(),
      local: payload({ dailyEntries: [entry()] }),
      remote: withoutTheField(),
    });

    expect(result.kind).toBe('merged');
    expect(result.payload.dailyEntries).toEqual([entry()]);
  });

  it('previews as adding nothing and removing nothing', () => {
    const preview = buildCloudRestorePreviewV1(payload(), withoutTheField());

    expect(preview.dailyEntries).toEqual({
      localCount: 0,
      remoteCount: 0,
      added: 0,
      removed: 0,
      changed: 0,
    });
  });
});

describe('the hash and recorded days', () => {
  it('changes when a day is added', () => {
    expect(cloudSyncContentHash(payload({ dailyEntries: [entry()] }))).not.toBe(
      cloudSyncContentHash(payload())
    );
  });

  it('changes when a day changes', () => {
    expect(cloudSyncContentHash(payload({ dailyEntries: [entry({ moodId: 'bad' })] }))).not.toBe(
      cloudSyncContentHash(payload({ dailyEntries: [entry()] }))
    );
  });

  it('changes when a symptom is added to a day', () => {
    expect(
      cloudSyncContentHash(payload({ dailyEntries: [entry({ symptomIds: ['cramps', 'acne'] })] }))
    ).not.toBe(cloudSyncContentHash(payload({ dailyEntries: [entry()] })));
  });

  it('does not care what order the days arrived in', () => {
    const a = entry({ date: date('2026-10-14') });
    const b = entry({ date: date('2026-10-15') });

    expect(cloudSyncContentHash(payload({ dailyEntries: [a, b] }))).toBe(
      cloudSyncContentHash(payload({ dailyEntries: [b, a] }))
    );
  });

  it('does not care what order a day lists its symptoms in', () => {
    // SQLite and a Firestore round trip both reserve the right to reorder.
    expect(
      cloudSyncContentHash(payload({ dailyEntries: [entry({ symptomIds: ['acne', 'cramps'] })] }))
    ).toBe(
      cloudSyncContentHash(payload({ dailyEntries: [entry({ symptomIds: ['cramps', 'acne'] })] }))
    );
  });

  it('tells a lost day from a day that was never there', () => {
    // The count goes into the hash for exactly this.
    expect(cloudSyncContentHash(payload({ dailyEntries: [entry()] }))).not.toBe(
      cloudSyncContentHash(payload({ dailyEntries: [] }))
    );
  });

  it('survives a round trip through text', () => {
    const full = payload({ dailyEntries: [entry()] });

    expect(cloudSyncContentHash(parseCloudSyncPayloadV1(serializeCloudSyncPayloadV1(full)))).toBe(
      cloudSyncContentHash(full)
    );
  });
});

describe('merging days between two phones', () => {
  it('keeps a day only one side recorded', () => {
    const result = mergeCloudSyncPayload({
      base: payload(),
      local: payload({ dailyEntries: [entry({ date: date('2026-10-14') })] }),
      remote: payload({ dailyEntries: [entry({ date: date('2026-10-15') })] }),
    });

    expect(result.kind).toBe('merged');
    expect(result.payload.dailyEntries.map((day) => day.date)).toEqual([
      '2026-10-14',
      '2026-10-15',
    ]);
  });

  it('keeps a day both sides recorded the same way', () => {
    const result = mergeCloudSyncPayload({
      base: payload(),
      local: payload({ dailyEntries: [entry()] }),
      remote: payload({ dailyEntries: [entry()] }),
    });

    expect(result.kind).toBe('merged');
    expect(result.payload.dailyEntries).toHaveLength(1);
  });

  it('follows the side that cleared a day the other left alone', () => {
    const result = mergeCloudSyncPayload({
      base: payload({ dailyEntries: [entry()] }),
      local: payload({ dailyEntries: [entry()] }),
      remote: payload({ dailyEntries: [] }),
    });

    expect(result.kind).toBe('merged');
    expect(result.payload.dailyEntries).toEqual([]);
  });

  it('asks when both sides wrote different things for the same day', () => {
    const result = mergeCloudSyncPayload({
      base: payload(),
      local: payload({ dailyEntries: [entry({ moodId: 'good' })] }),
      remote: payload({ dailyEntries: [entry({ moodId: 'bad' })] }),
    });

    expect(result.kind).toBe('conflict');
  });

  it('names the day it is asking about', () => {
    const result = mergeCloudSyncPayload({
      base: payload({ dailyEntries: [entry({ moodId: 'okay' })] }),
      local: payload({ dailyEntries: [entry({ moodId: 'good' })] }),
      remote: payload({ dailyEntries: [entry({ moodId: 'bad' })] }),
    });

    expect(result.kind === 'conflict' && result.conflicts.map((c) => c.path)).toEqual([
      'dailyEntries/2026-10-14',
    ]);
  });

  it('asks when one side cleared a day the other changed', () => {
    const result = mergeCloudSyncPayload({
      base: payload({ dailyEntries: [entry({ moodId: 'okay' })] }),
      local: payload({ dailyEntries: [entry({ moodId: 'good' })] }),
      remote: payload({ dailyEntries: [] }),
    });

    expect(result.kind === 'conflict' && result.conflicts[0].reason).toBe('removed-and-changed');
  });

  it('leaves the days nobody argued about alone while asking', () => {
    // A conflict about the 14th must not cost somebody the 15th.
    const other = entry({ date: date('2026-10-15'), moodId: 'good' });

    const result = mergeCloudSyncPayload({
      base: payload(),
      local: payload({ dailyEntries: [entry({ moodId: 'good' }), other] }),
      remote: payload({ dailyEntries: [entry({ moodId: 'bad' })] }),
    });

    expect(result.kind).toBe('conflict');
    expect(result.payload.dailyEntries.map((day) => day.date)).toContain('2026-10-15');
  });

  it('comes back in date order however the two sides held them', () => {
    const result = mergeCloudSyncPayload({
      base: payload(),
      local: payload({
        dailyEntries: [entry({ date: date('2026-10-16') }), entry({ date: date('2026-10-14') })],
      }),
      remote: payload({ dailyEntries: [entry({ date: date('2026-10-15') })] }),
    });

    expect(result.payload.dailyEntries.map((day) => day.date)).toEqual([
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
    ]);
  });
});

describe('what a restore would do to the recorded days', () => {
  it('counts a day the backup has and the phone does not as added', () => {
    const preview = buildCloudRestorePreviewV1(payload(), payload({ dailyEntries: [entry()] }));

    expect(preview.dailyEntries.added).toBe(1);
  });

  it('counts a day the phone has and the backup does not as removed', () => {
    const preview = buildCloudRestorePreviewV1(payload({ dailyEntries: [entry()] }), payload());

    expect(preview.dailyEntries.removed).toBe(1);
  });

  it('counts a day that differs as changed', () => {
    const preview = buildCloudRestorePreviewV1(
      payload({ dailyEntries: [entry({ moodId: 'good' })] }),
      payload({ dailyEntries: [entry({ moodId: 'bad' })] })
    );

    expect(preview.dailyEntries.changed).toBe(1);
  });

  it('counts a day that only reordered its symptoms as unchanged', () => {
    const preview = buildCloudRestorePreviewV1(
      payload({ dailyEntries: [entry({ symptomIds: ['acne', 'cramps'] })] }),
      payload({ dailyEntries: [entry({ symptomIds: ['cramps', 'acne'] })] })
    );

    expect(preview.dailyEntries.changed).toBe(0);
  });

  it('reports both totals so a screen can say how many there are', () => {
    const preview = buildCloudRestorePreviewV1(
      payload({ dailyEntries: [entry()] }),
      payload({ dailyEntries: [entry(), entry({ date: date('2026-10-15') })] })
    );

    expect(preview.dailyEntries.localCount).toBe(1);
    expect(preview.dailyEntries.remoteCount).toBe(2);
  });
});

describe('what the payload refuses to carry', () => {
  it('refuses two days on the same date', () => {
    expect(() =>
      validateCloudSyncPayloadV1(payload({ dailyEntries: [entry(), entry()] }))
    ).toThrow();
  });

  it('refuses a day holding nothing', () => {
    expect(() =>
      validateCloudSyncPayloadV1(
        payload({
          dailyEntries: [{ date: date('2026-10-14'), flowId: null, moodId: null, symptomIds: [] }],
        })
      )
    ).toThrow();
  });

  it('accepts an id no catalogue knows', () => {
    // A day written by a newer build, or naming an entry this one retired.
    // Refusing would throw away what somebody recorded.
    expect(() =>
      validateCloudSyncPayloadV1(
        payload({ dailyEntries: [entry({ symptomIds: ['from-a-newer-build'] })] })
      )
    ).not.toThrow();
  });
});
