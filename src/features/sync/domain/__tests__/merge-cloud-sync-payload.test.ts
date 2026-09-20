import type { AvatarConfig } from '@/features/avatar/domain/avatar-config';
import type { CycleSettings, PeriodRecord } from '@/features/cycle/domain/types';
import type { NotificationPreferences } from '@/features/notifications/domain/notification-preferences';
import { calculateEstimatedDueDate } from '@/features/pregnancy/domain/due-date';
import type { PregnancyProfile } from '@/features/pregnancy/domain/types';
import type { CloudSyncPayloadV1 } from '@/features/privacy/domain/cloud-sync-payload-v1';
import type { ISODate } from '@/types/iso-date';

import { cloudSyncContentHash } from '../cloud-sync-hash';
import type { CloudSyncMergeResult } from '../merge-cloud-sync-payload';
import {
  cloudSyncConflictPaths,
  mergeCloudSyncPayload,
} from '../merge-cloud-sync-payload';

const date = (value: string) => value as ISODate;

function settings(cycle = 28, period = 5): CycleSettings {
  return { averageCycleLengthDays: cycle, averagePeriodLengthDays: period };
}

function preferences(period = false, pregnancy = false): NotificationPreferences {
  return { periodReminderEnabled: period, pregnancyWeeklyReminderEnabled: pregnancy };
}

function avatar(overrides: Partial<AvatarConfig> = {}): AvatarConfig {
  return {
    skinToneId: 'tone-1',
    hairStyleId: 'style-1',
    hairColorId: 'color-1',
    outfitId: 'outfit-1',
    ...overrides,
  };
}

/** A pregnancy dated the way the domain insists an `lmp` one must be. */
function pregnancy(lastPeriodStart = '2026-04-01'): PregnancyProfile {
  return {
    lastMenstrualPeriodStartDate: date(lastPeriodStart),
    estimatedDueDate: calculateEstimatedDueDate(date(lastPeriodStart)),
    dueDateSource: 'lmp',
  };
}

function record(
  id: string,
  startDate: string,
  overrides: Partial<PeriodRecord> = {}
): PeriodRecord {
  return { id, startDate: date(startDate), isOngoing: false, ...overrides };
}

function payload(overrides: Partial<CloudSyncPayloadV1> = {}): CloudSyncPayloadV1 {
  return {
    version: 1,
    cycleSettings: settings(),
    periodRecords: [],
    pregnancyProfile: null,
    avatarConfig: null,
    notificationPreferences: preferences(),
    ...overrides,
  };
}

/** A payload holding one history, for the record tests. */
function withRecords(...records: readonly PeriodRecord[]): CloudSyncPayloadV1 {
  return payload({ periodRecords: records });
}

function merge(
  base: CloudSyncPayloadV1,
  local: CloudSyncPayloadV1,
  remote: CloudSyncPayloadV1
): CloudSyncMergeResult {
  return mergeCloudSyncPayload({ base, local, remote });
}

/** Freezes a payload and everything in it, so a write anywhere throws. */
function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  Object.values(value as Record<string, unknown>).forEach(deepFreeze);

  return Object.freeze(value);
}

function ids(result: CloudSyncMergeResult): readonly string[] {
  return result.payload.periodRecords.map((one) => one.id);
}

/** Why each conflict was reported, in the order they were reported. */
function reasons(result: CloudSyncMergeResult): readonly string[] {
  return result.kind === 'conflict' ? result.conflicts.map((conflict) => conflict.reason) : [];
}

function recordById(result: CloudSyncMergeResult, id: string): PeriodRecord | undefined {
  return result.payload.periodRecords.find((one) => one.id === id);
}

// ---------------------------------------------------------------------------
// 1. Nothing changed
// ---------------------------------------------------------------------------

describe('when neither side changed anything', () => {
  it('merges, with nothing to report', () => {
    const base = payload({ cycleSettings: settings(30, 6), avatarConfig: avatar() });

    const result = merge(base, base, base);

    expect(result.kind).toBe('merged');
    expect(cloudSyncConflictPaths(result)).toEqual([]);
  });

  it('gives back what was already agreed', () => {
    const base = withRecords(record('a', '2026-01-05'), record('b', '2026-02-10'));

    const result = merge(base, base, base);

    expect(cloudSyncContentHash(result.payload)).toBe(cloudSyncContentHash(base));
  });

  it('merges two payloads that say the same thing in different orders', () => {
    const base = withRecords(record('a', '2026-01-05'), record('b', '2026-02-10'));
    const reordered = withRecords(record('b', '2026-02-10'), record('a', '2026-01-05'));

    const result = merge(base, reordered, base);

    expect(result.kind).toBe('merged');
    expect(ids(result)).toEqual(['a', 'b']);
  });
});

// ---------------------------------------------------------------------------
// 2-5. One side, both sides, and true conflicts
// ---------------------------------------------------------------------------

describe('a change only one side made', () => {
  it('keeps this phone’s change when the account did not move', () => {
    const result = merge(payload(), payload({ cycleSettings: settings(31) }), payload());

    expect(result.kind).toBe('merged');
    expect(result.payload.cycleSettings).toEqual(settings(31));
  });

  it('keeps the account’s change when this phone did not move', () => {
    const result = merge(payload(), payload(), payload({ cycleSettings: settings(31) }));

    expect(result.kind).toBe('merged');
    expect(result.payload.cycleSettings).toEqual(settings(31));
  });

  it('keeps a switch this phone turned on', () => {
    const result = merge(payload(), payload({ notificationPreferences: preferences(true) }), payload());

    expect(result.payload.notificationPreferences).toEqual(preferences(true));
  });

  it('keeps a switch the account turned on', () => {
    const result = merge(payload(), payload(), payload({ notificationPreferences: preferences(true) }));

    expect(result.payload.notificationPreferences).toEqual(preferences(true));
  });
});

describe('a change both sides made', () => {
  it('is no conflict when they made the same one', () => {
    const changed = payload({ cycleSettings: settings(31) });

    const result = merge(payload(), changed, changed);

    expect(result.kind).toBe('merged');
    expect(result.payload.cycleSettings).toEqual(settings(31));
  });

  it('is a conflict when they made different ones', () => {
    const result = merge(
      payload(),
      payload({ cycleSettings: settings(30) }),
      payload({ cycleSettings: settings(32) })
    );

    expect(result.kind).toBe('conflict');
    expect(cloudSyncConflictPaths(result)).toEqual(['cycleSettings.averageCycleLengthDays']);
  });

  it('leaves the contested value at what was agreed', () => {
    const result = merge(
      payload({ cycleSettings: settings(28) }),
      payload({ cycleSettings: settings(30) }),
      payload({ cycleSettings: settings(32) })
    );

    expect(result.payload.cycleSettings).toEqual(settings(28));
  });

  it('reports all three values, so a person can be asked', () => {
    const result = merge(
      payload({ cycleSettings: settings(28) }),
      payload({ cycleSettings: settings(30) }),
      payload({ cycleSettings: settings(32) })
    );

    expect(result.kind === 'conflict' && result.conflicts[0]).toMatchObject({
      reason: 'changed-on-both-sides',
      base: { present: true, value: 28 },
      local: { present: true, value: 30 },
      remote: { present: true, value: 32 },
    });
  });
});

// ---------------------------------------------------------------------------
// 6-7. Inside a settings object
// ---------------------------------------------------------------------------

describe('two settings in the same object', () => {
  it('keeps both when each side changed a different one', () => {
    const result = merge(
      payload({ cycleSettings: settings(28, 5) }),
      payload({ cycleSettings: settings(30, 5) }),
      payload({ cycleSettings: settings(28, 6) })
    );

    expect(result.kind).toBe('merged');
    expect(result.payload.cycleSettings).toEqual(settings(30, 6));
  });

  it('conflicts only about the one they both moved', () => {
    const result = merge(
      payload({ cycleSettings: settings(28, 5) }),
      payload({ cycleSettings: settings(30, 7) }),
      payload({ cycleSettings: settings(32, 5) })
    );

    expect(cloudSyncConflictPaths(result)).toEqual(['cycleSettings.averageCycleLengthDays']);
    // The uncontested one still carries this phone's change.
    expect(result.payload.cycleSettings).toEqual(settings(28, 7));
  });

  it('merges four of an avatar’s fields independently', () => {
    const result = merge(
      payload({ avatarConfig: avatar() }),
      payload({ avatarConfig: avatar({ hairStyleId: 'style-2' }) }),
      payload({ avatarConfig: avatar({ outfitId: 'outfit-2' }) })
    );

    expect(result.kind).toBe('merged');
    expect(result.payload.avatarConfig).toEqual(
      avatar({ hairStyleId: 'style-2', outfitId: 'outfit-2' })
    );
  });

  it('merges the two reminder switches independently', () => {
    const result = merge(
      payload({ notificationPreferences: preferences(false, false) }),
      payload({ notificationPreferences: preferences(true, false) }),
      payload({ notificationPreferences: preferences(false, true) })
    );

    expect(result.kind).toBe('merged');
    expect(result.payload.notificationPreferences).toEqual(preferences(true, true));
  });

  it('reports one conflict per contested field, in the order the fields are declared', () => {
    const result = merge(
      payload({ avatarConfig: avatar() }),
      payload({ avatarConfig: avatar({ skinToneId: 'tone-2', outfitId: 'outfit-2' }) }),
      payload({ avatarConfig: avatar({ skinToneId: 'tone-3', outfitId: 'outfit-3' }) })
    );

    expect(cloudSyncConflictPaths(result)).toEqual([
      'avatarConfig.skinToneId',
      'avatarConfig.outfitId',
    ]);
  });
});

describe('a field merge that would make something the domain refuses', () => {
  it('conflicts about the whole object rather than storing it', () => {
    // Each change is fine on its own; together the period is longer than the
    // cycle it sits in, which `validateCycleSettings` forbids.
    const result = merge(
      payload({ cycleSettings: settings(40, 5) }),
      payload({ cycleSettings: settings(15, 5) }),
      payload({ cycleSettings: settings(40, 20) })
    );

    expect(result.kind).toBe('conflict');
    expect(cloudSyncConflictPaths(result)).toEqual(['cycleSettings']);
  });

  it('says why, and leaves the settings at what was agreed', () => {
    const result = merge(
      payload({ cycleSettings: settings(40, 5) }),
      payload({ cycleSettings: settings(15, 5) }),
      payload({ cycleSettings: settings(40, 20) })
    );

    expect(result.kind === 'conflict' && result.conflicts[0]).toMatchObject({
      reason: 'invalid-combination',
      base: { present: true, value: settings(40, 5) },
      local: { present: true, value: settings(15, 5) },
      remote: { present: true, value: settings(40, 20) },
    });
    expect(result.payload.cycleSettings).toEqual(settings(40, 5));
  });
});

// ---------------------------------------------------------------------------
// A section appearing and disappearing
// ---------------------------------------------------------------------------

describe('a section one side started keeping', () => {
  it('takes it when the other side had none either', () => {
    const result = merge(payload(), payload({ avatarConfig: avatar() }), payload());

    expect(result.kind).toBe('merged');
    expect(result.payload.avatarConfig).toEqual(avatar());
  });

  it('takes it when only the account has it', () => {
    const result = merge(payload(), payload(), payload({ pregnancyProfile: pregnancy() }));

    expect(result.kind).toBe('merged');
    expect(result.payload.pregnancyProfile).toEqual(pregnancy());
  });

  it('is no conflict when both started the same one', () => {
    const started = payload({ pregnancyProfile: pregnancy('2026-05-01') });

    const result = merge(payload(), started, started);

    expect(result.kind).toBe('merged');
    expect(result.payload.pregnancyProfile).toEqual(pregnancy('2026-05-01'));
  });

  it('is a conflict when each started a different one', () => {
    const result = merge(
      payload(),
      payload({ pregnancyProfile: pregnancy('2026-05-01') }),
      payload({ pregnancyProfile: pregnancy('2026-06-01') })
    );

    expect(result.kind === 'conflict' && result.conflicts[0]).toMatchObject({
      path: 'pregnancyProfile',
      reason: 'added-on-both-sides',
      base: { present: false },
    });
    expect(result.payload.pregnancyProfile).toBeNull();
  });
});

describe('a section one side cleared', () => {
  it('clears it when the other side left it alone', () => {
    const base = payload({ pregnancyProfile: pregnancy() });

    const result = merge(base, payload(), base);

    expect(result.kind).toBe('merged');
    expect(result.payload.pregnancyProfile).toBeNull();
  });

  it('clears it when the account was the one that cleared it', () => {
    const base = payload({ avatarConfig: avatar() });

    const result = merge(base, base, payload());

    expect(result.kind).toBe('merged');
    expect(result.payload.avatarConfig).toBeNull();
  });

  it('clears it when both cleared it', () => {
    const base = payload({ avatarConfig: avatar() });

    const result = merge(base, payload(), payload());

    expect(result.kind).toBe('merged');
    expect(result.payload.avatarConfig).toBeNull();
  });

  it('will not decide between clearing it and editing it', () => {
    const base = payload({ pregnancyProfile: pregnancy('2026-04-01') });

    const result = merge(base, payload(), payload({ pregnancyProfile: pregnancy('2026-05-01') }));

    expect(result.kind === 'conflict' && result.conflicts[0]).toMatchObject({
      path: 'pregnancyProfile',
      reason: 'removed-and-changed',
      local: { present: false },
      remote: { present: true },
    });
    expect(result.payload.pregnancyProfile).toEqual(pregnancy('2026-04-01'));
  });
});

describe('a pregnancy, which is merged whole', () => {
  it('does not mix one side’s last period with the other’s due date', () => {
    // A date counted from the last period has to be that count. Taking a field
    // from each side would produce a pregnancy neither of them is tracking.
    const result = merge(
      payload({ pregnancyProfile: pregnancy('2026-04-01') }),
      payload({ pregnancyProfile: pregnancy('2026-04-10') }),
      payload({
        pregnancyProfile: {
          lastMenstrualPeriodStartDate: date('2026-04-01'),
          estimatedDueDate: date('2027-01-20'),
          dueDateSource: 'adjusted',
        },
      })
    );

    expect(cloudSyncConflictPaths(result)).toEqual(['pregnancyProfile']);
    expect(result.payload.pregnancyProfile).toEqual(pregnancy('2026-04-01'));
  });

  it('takes a whole edit from the one side that made it', () => {
    const base = payload({ pregnancyProfile: pregnancy('2026-04-01') });
    const adjusted = payload({
      pregnancyProfile: {
        lastMenstrualPeriodStartDate: date('2026-04-01'),
        estimatedDueDate: date('2027-01-20'),
        dueDateSource: 'adjusted',
      },
    });

    const result = merge(base, adjusted, base);

    expect(result.kind).toBe('merged');
    expect(result.payload.pregnancyProfile).toEqual(adjusted.pregnancyProfile);
  });
});

// ---------------------------------------------------------------------------
// 8-17. Period records
// ---------------------------------------------------------------------------

describe('a period only one side wrote down', () => {
  it('keeps one this phone added', () => {
    const base = withRecords(record('a', '2026-01-05'));
    const local = withRecords(record('a', '2026-01-05'), record('b', '2026-02-02'));

    const result = merge(base, local, base);

    expect(result.kind).toBe('merged');
    expect(ids(result)).toEqual(['a', 'b']);
  });

  it('keeps one the account added', () => {
    const base = withRecords(record('a', '2026-01-05'));
    const remote = withRecords(record('a', '2026-01-05'), record('c', '2026-03-02'));

    const result = merge(base, base, remote);

    expect(result.kind).toBe('merged');
    expect(ids(result)).toEqual(['a', 'c']);
  });

  it('keeps both when each side added one of its own', () => {
    const base = withRecords(record('a', '2026-01-05'));

    const result = merge(
      base,
      withRecords(record('a', '2026-01-05'), record('b', '2026-02-02')),
      withRecords(record('a', '2026-01-05'), record('c', '2026-03-02'))
    );

    expect(result.kind).toBe('merged');
    expect(ids(result)).toEqual(['a', 'b', 'c']);
  });
});

describe('a period both sides already had', () => {
  it('leaves it alone when neither touched it', () => {
    const base = withRecords(record('a', '2026-01-05'));

    const result = merge(base, base, base);

    expect(recordById(result, 'a')).toEqual(record('a', '2026-01-05'));
  });

  it('takes this phone’s correction when the account did not touch it', () => {
    const base = withRecords(record('a', '2026-01-05'));
    const corrected = withRecords(record('a', '2026-01-05', { endDate: date('2026-01-10') }));

    const result = merge(base, corrected, base);

    expect(result.kind).toBe('merged');
    expect(recordById(result, 'a')?.endDate).toBe('2026-01-10');
  });

  it('takes the account’s correction when this phone did not touch it', () => {
    const base = withRecords(record('a', '2026-01-05'));
    const corrected = withRecords(record('a', '2026-01-05', { endDate: date('2026-01-09') }));

    const result = merge(base, base, corrected);

    expect(result.kind).toBe('merged');
    expect(recordById(result, 'a')?.endDate).toBe('2026-01-09');
  });

  it('is no conflict when both corrected it the same way', () => {
    const base = withRecords(record('a', '2026-01-05'));
    const corrected = withRecords(record('a', '2026-01-05', { endDate: date('2026-01-10') }));

    const result = merge(base, corrected, corrected);

    expect(result.kind).toBe('merged');
    expect(recordById(result, 'a')?.endDate).toBe('2026-01-10');
  });

  it('is a conflict when they corrected it differently', () => {
    const base = withRecords(record('a', '2026-01-05'));

    const result = merge(
      base,
      withRecords(record('a', '2026-01-05', { endDate: date('2026-01-10') })),
      withRecords(record('a', '2026-01-05', { endDate: date('2026-01-12') }))
    );

    expect(result.kind === 'conflict' && result.conflicts[0]).toMatchObject({
      path: 'periodRecords/a',
      reason: 'changed-on-both-sides',
    });
  });

  it('leaves a contested record at what was agreed', () => {
    const base = withRecords(record('a', '2026-01-05'));

    const result = merge(
      base,
      withRecords(record('a', '2026-01-05', { endDate: date('2026-01-10') })),
      withRecords(record('a', '2026-01-05', { endDate: date('2026-01-12') }))
    );

    expect(recordById(result, 'a')).toEqual(record('a', '2026-01-05'));
  });
});

describe('a period one side deleted', () => {
  it('deletes it when this phone did and the account left it alone', () => {
    const base = withRecords(record('a', '2026-01-05'), record('b', '2026-02-02'));

    const result = merge(base, withRecords(record('a', '2026-01-05')), base);

    expect(result.kind).toBe('merged');
    expect(ids(result)).toEqual(['a']);
  });

  it('deletes it when the account did and this phone left it alone', () => {
    const base = withRecords(record('a', '2026-01-05'), record('b', '2026-02-02'));

    const result = merge(base, base, withRecords(record('a', '2026-01-05')));

    expect(result.kind).toBe('merged');
    expect(ids(result)).toEqual(['a']);
  });

  it('deletes it once when both deleted it', () => {
    const base = withRecords(record('a', '2026-01-05'), record('b', '2026-02-02'));
    const without = withRecords(record('a', '2026-01-05'));

    const result = merge(base, without, without);

    expect(result.kind).toBe('merged');
    expect(ids(result)).toEqual(['a']);
  });

  it('does not bring it back because the other side happened to add records', () => {
    const base = withRecords(record('a', '2026-01-05'), record('b', '2026-02-02'));

    const result = merge(
      base,
      withRecords(record('a', '2026-01-05')),
      withRecords(record('a', '2026-01-05'), record('b', '2026-02-02'), record('c', '2026-03-02'))
    );

    expect(result.kind).toBe('merged');
    expect(ids(result)).toEqual(['a', 'c']);
  });
});

describe('a period one side deleted and the other changed', () => {
  it('is a conflict rather than a decision', () => {
    const base = withRecords(record('a', '2026-01-05'), record('b', '2026-02-02'));

    const result = merge(
      base,
      withRecords(record('a', '2026-01-05')),
      withRecords(record('a', '2026-01-05'), record('b', '2026-02-02', { endDate: date('2026-02-07') }))
    );

    expect(result.kind).toBe('conflict');
    expect(cloudSyncConflictPaths(result)).toEqual(['periodRecords/b']);
  });

  it('says which side had nothing', () => {
    const base = withRecords(record('b', '2026-02-02'));

    const result = merge(
      base,
      payload(),
      withRecords(record('b', '2026-02-02', { endDate: date('2026-02-07') }))
    );

    expect(result.kind === 'conflict' && result.conflicts[0]).toMatchObject({
      reason: 'removed-and-changed',
      base: { present: true },
      local: { present: false },
      remote: { present: true },
    });
  });

  it('is a conflict the other way round too', () => {
    const base = withRecords(record('b', '2026-02-02'));

    const result = merge(
      base,
      withRecords(record('b', '2026-02-02', { endDate: date('2026-02-07') })),
      payload()
    );

    expect(result.kind === 'conflict' && result.conflicts[0]).toMatchObject({
      reason: 'removed-and-changed',
      local: { present: true },
      remote: { present: false },
    });
  });

  it('keeps the record as it was agreed, neither deleted nor changed', () => {
    const base = withRecords(record('b', '2026-02-02'));

    const result = merge(
      base,
      payload(),
      withRecords(record('b', '2026-02-02', { endDate: date('2026-02-07') }))
    );

    expect(recordById(result, 'b')).toEqual(record('b', '2026-02-02'));
  });
});

describe('the same id used for two different new periods', () => {
  it('is a conflict, because neither of them is the other', () => {
    const result = merge(
      payload(),
      withRecords(record('a', '2026-01-05')),
      withRecords(record('a', '2026-03-05'))
    );

    expect(result.kind === 'conflict' && result.conflicts[0]).toMatchObject({
      path: 'periodRecords/a',
      reason: 'added-on-both-sides',
      base: { present: false },
    });
  });

  it('holds neither of them while the question is open', () => {
    const result = merge(
      payload(),
      withRecords(record('a', '2026-01-05')),
      withRecords(record('a', '2026-03-05'))
    );

    expect(ids(result)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Rules about the history as a whole
// ---------------------------------------------------------------------------

describe('two periods that would start on the same day', () => {
  it('is a conflict, although each change was unambiguous', () => {
    const base = withRecords(record('a', '2026-01-05'));

    const result = merge(
      base,
      withRecords(record('a', '2026-01-05'), record('b', '2026-02-02')),
      withRecords(record('a', '2026-01-05'), record('c', '2026-02-02'))
    );

    expect(result.kind).toBe('conflict');
    expect(reasons(result)).toEqual(['same-day', 'same-day']);
  });

  it('names both records, in id order', () => {
    const base = withRecords(record('a', '2026-01-05'));

    const result = merge(
      base,
      withRecords(record('a', '2026-01-05'), record('b', '2026-02-02')),
      withRecords(record('a', '2026-01-05'), record('c', '2026-02-02'))
    );

    expect(cloudSyncConflictPaths(result)).toEqual(['periodRecords/b', 'periodRecords/c']);
  });

  it('keeps the history the two sides did agree on', () => {
    const base = withRecords(record('a', '2026-01-05'));

    const result = merge(
      base,
      withRecords(record('a', '2026-01-05'), record('b', '2026-02-02')),
      withRecords(record('a', '2026-01-05'), record('c', '2026-02-02'))
    );

    expect(ids(result)).toEqual(['a']);
  });

  it('catches one side moving a record onto a day the other side filled', () => {
    // Neither side could see the other: this phone moved `c` to the second of
    // April, the account wrote `d` down on the same day. Each payload is fine
    // on its own and the pair of them is not.
    const base = withRecords(record('b', '2026-02-02'), record('c', '2026-03-02'));

    const result = merge(
      base,
      withRecords(record('b', '2026-02-02'), record('c', '2026-04-02')),
      withRecords(record('b', '2026-02-02'), record('c', '2026-03-02'), record('d', '2026-04-02'))
    );

    expect(cloudSyncConflictPaths(result)).toEqual(['periodRecords/c', 'periodRecords/d']);
  });

  it('puts back what collided and leaves the rest of the history alone', () => {
    const base = withRecords(record('b', '2026-02-02'), record('c', '2026-03-02'));

    const result = merge(
      base,
      withRecords(record('b', '2026-02-02'), record('c', '2026-04-02')),
      withRecords(record('b', '2026-02-02'), record('c', '2026-03-02'), record('d', '2026-04-02'))
    );

    // `b` was never in question; `c` goes back to the day both sides agreed on;
    // `d` has no agreed day to go back to, so it waits for an answer.
    expect(recordById(result, 'b')).toEqual(record('b', '2026-02-02'));
    expect(recordById(result, 'c')).toEqual(record('c', '2026-03-02'));
    expect(ids(result)).toEqual(['b', 'c']);
  });
});

describe('two periods that would both be ongoing', () => {
  it('is a conflict rather than a payload the app would refuse', () => {
    const base = withRecords(record('a', '2026-01-05'), record('b', '2026-02-02'));

    const result = merge(
      base,
      withRecords(record('a', '2026-01-05', { isOngoing: true }), record('b', '2026-02-02')),
      withRecords(record('a', '2026-01-05'), record('b', '2026-02-02', { isOngoing: true }))
    );

    expect(result.kind).toBe('conflict');
    expect(reasons(result)).toEqual(['two-ongoing', 'two-ongoing']);
  });

  it('leaves both records as they were agreed', () => {
    const base = withRecords(record('a', '2026-01-05'), record('b', '2026-02-02'));

    const result = merge(
      base,
      withRecords(record('a', '2026-01-05', { isOngoing: true }), record('b', '2026-02-02')),
      withRecords(record('a', '2026-01-05'), record('b', '2026-02-02', { isOngoing: true }))
    );

    expect(result.payload.periodRecords).toEqual(base.periodRecords);
  });

  it('is fine when only one side started a period', () => {
    const base = withRecords(record('a', '2026-01-05'), record('b', '2026-02-02'));

    const result = merge(
      base,
      withRecords(record('a', '2026-01-05'), record('b', '2026-02-02', { isOngoing: true })),
      base
    );

    expect(result.kind).toBe('merged');
    expect(recordById(result, 'b')?.isOngoing).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 18, 22. Order
// ---------------------------------------------------------------------------

describe('the order of what comes back', () => {
  it('sorts records by id, whatever order they arrived in', () => {
    const base = payload();

    const result = merge(
      base,
      withRecords(record('m', '2026-03-02'), record('a', '2026-01-05')),
      withRecords(record('z', '2026-05-02'), record('b', '2026-02-02'))
    );

    expect(ids(result)).toEqual(['a', 'b', 'm', 'z']);
  });

  it('sorts by code unit, not by the device’s language', () => {
    const base = payload();

    const result = merge(
      base,
      withRecords(record('Z-record', '2026-01-05'), record('a-record', '2026-02-02')),
      base
    );

    // 'Z' is before 'a' by code unit; a Turkish collation would disagree.
    expect(ids(result)).toEqual(['Z-record', 'a-record']);
  });

  it('reports conflicts in the payload’s own field order', () => {
    const base = withRecords(record('a', '2026-01-05'));

    const result = merge(
      {
        ...base,
        cycleSettings: settings(28),
        avatarConfig: avatar(),
        notificationPreferences: preferences(),
      },
      {
        ...withRecords(record('a', '2026-01-05', { endDate: date('2026-01-10') })),
        cycleSettings: settings(30),
        avatarConfig: avatar({ outfitId: 'outfit-2' }),
        notificationPreferences: preferences(true),
      },
      {
        ...withRecords(record('a', '2026-01-05', { endDate: date('2026-01-12') })),
        cycleSettings: settings(32),
        avatarConfig: avatar({ outfitId: 'outfit-3' }),
        notificationPreferences: preferences(false, true),
      }
    );

    expect(cloudSyncConflictPaths(result)).toEqual([
      'cycleSettings.averageCycleLengthDays',
      'periodRecords/a',
      'avatarConfig.outfitId',
    ]);
  });

  it('gives the same answer every time it is asked', () => {
    const base = withRecords(record('b', '2026-02-02'), record('c', '2026-03-02'));
    const local = withRecords(
      record('b', '2026-02-02', { endDate: date('2026-02-07') }),
      record('a', '2026-01-05')
    );
    const remote = withRecords(
      record('b', '2026-02-02', { endDate: date('2026-02-09') }),
      record('d', '2026-04-02')
    );

    const first = merge(base, local, remote);
    const again = merge(base, local, remote);

    expect(again).toEqual(first);
    expect(cloudSyncContentHash(again.payload)).toBe(cloudSyncContentHash(first.payload));
  });
});

// ---------------------------------------------------------------------------
// Neither side is preferred
// ---------------------------------------------------------------------------

describe('neither side is preferred', () => {
  const base = withRecords(record('a', '2026-01-05'), record('b', '2026-02-02'));
  const local = payload({
    cycleSettings: settings(30, 5),
    periodRecords: [record('a', '2026-01-05', { endDate: date('2026-01-10') }), record('c', '2026-03-02')],
    avatarConfig: avatar(),
  });
  const remote = payload({
    cycleSettings: settings(28, 6),
    periodRecords: [record('a', '2026-01-05'), record('b', '2026-02-02'), record('d', '2026-04-02')],
  });

  it('merges to the same payload whichever side is called which', () => {
    const oneWay = merge(base, local, remote);
    const other = merge(base, remote, local);

    expect(cloudSyncContentHash(other.payload)).toBe(cloudSyncContentHash(oneWay.payload));
  });

  it('finds the same conflicts either way round', () => {
    const oneWay = merge(base, local, remote);
    const other = merge(base, remote, local);

    expect(cloudSyncConflictPaths(other)).toEqual(cloudSyncConflictPaths(oneWay));
  });

  it('swaps the two sides of a conflict rather than reordering it', () => {
    const contested = merge(
      payload({ cycleSettings: settings(28) }),
      payload({ cycleSettings: settings(30) }),
      payload({ cycleSettings: settings(32) })
    );
    const swapped = merge(
      payload({ cycleSettings: settings(28) }),
      payload({ cycleSettings: settings(32) }),
      payload({ cycleSettings: settings(30) })
    );

    expect(contested.kind === 'conflict' && contested.conflicts[0].local).toEqual({
      present: true,
      value: 30,
    });
    expect(swapped.kind === 'conflict' && swapped.conflicts[0].local).toEqual({
      present: true,
      value: 32,
    });
  });
});

// ---------------------------------------------------------------------------
// 19-20. Several things at once
// ---------------------------------------------------------------------------

describe('a week apart', () => {
  const base = payload({
    cycleSettings: settings(28, 5),
    periodRecords: [record('a', '2026-01-05'), record('b', '2026-02-02')],
    avatarConfig: avatar(),
  });

  it('carries every change when the two sides touched different things', () => {
    const result = merge(
      base,
      {
        ...base,
        cycleSettings: settings(30, 5),
        periodRecords: [record('a', '2026-01-05'), record('b', '2026-02-02'), record('c', '2026-03-02')],
      },
      {
        ...base,
        notificationPreferences: preferences(true),
        avatarConfig: avatar({ hairColorId: 'color-2' }),
      }
    );

    expect(result.kind).toBe('merged');
    expect(result.payload).toMatchObject({
      cycleSettings: settings(30, 5),
      notificationPreferences: preferences(true),
      avatarConfig: avatar({ hairColorId: 'color-2' }),
    });
    expect(ids(result)).toEqual(['a', 'b', 'c']);
  });

  it('keeps everything it could settle while reporting the one thing it could not', () => {
    const result = merge(
      base,
      {
        ...base,
        cycleSettings: settings(30, 5),
        periodRecords: [record('a', '2026-01-05', { endDate: date('2026-01-10') }), record('b', '2026-02-02')],
      },
      {
        ...base,
        notificationPreferences: preferences(true),
        periodRecords: [record('a', '2026-01-05', { endDate: date('2026-01-12') }), record('b', '2026-02-02')],
      }
    );

    expect(cloudSyncConflictPaths(result)).toEqual(['periodRecords/a']);
    expect(result.payload.cycleSettings).toEqual(settings(30, 5));
    expect(result.payload.notificationPreferences).toEqual(preferences(true));
    expect(recordById(result, 'a')).toEqual(record('a', '2026-01-05'));
  });

  it('reports several conflicts at once', () => {
    const result = merge(
      base,
      {
        ...base,
        cycleSettings: settings(30, 5),
        avatarConfig: avatar({ skinToneId: 'tone-2' }),
        periodRecords: [record('a', '2026-01-05', { endDate: date('2026-01-10') }), record('b', '2026-02-02')],
      },
      {
        ...base,
        cycleSettings: settings(32, 5),
        avatarConfig: avatar({ skinToneId: 'tone-3' }),
        periodRecords: [record('a', '2026-01-05', { endDate: date('2026-01-12') }), record('b', '2026-02-02')],
      }
    );

    expect(cloudSyncConflictPaths(result)).toEqual([
      'cycleSettings.averageCycleLengthDays',
      'periodRecords/a',
      'avatarConfig.skinToneId',
    ]);
  });
});

// ---------------------------------------------------------------------------
// 21. Nothing is touched
// ---------------------------------------------------------------------------

describe('what it does to what it was given', () => {
  it('changes nothing about three frozen payloads', () => {
    const base = deepFreeze(withRecords(record('a', '2026-01-05'), record('b', '2026-02-02')));
    const local = deepFreeze(
      payload({
        cycleSettings: settings(30),
        periodRecords: [record('a', '2026-01-05', { endDate: date('2026-01-10') })],
        avatarConfig: avatar(),
      })
    );
    const remote = deepFreeze(
      payload({
        periodRecords: [record('a', '2026-01-05'), record('b', '2026-02-02'), record('c', '2026-03-02')],
        notificationPreferences: preferences(true),
      })
    );

    expect(() => merge(base, local, remote)).not.toThrow();
  });

  it('leaves the record lists in the order they were handed over', () => {
    const local = withRecords(record('m', '2026-03-02'), record('a', '2026-01-05'));
    const before = local.periodRecords.map((one) => one.id);

    merge(payload(), local, payload());

    expect(local.periodRecords.map((one) => one.id)).toEqual(before);
  });

  it('builds a new list rather than handing back one of theirs', () => {
    const local = withRecords(record('a', '2026-01-05'));

    const result = merge(payload(), local, payload());

    expect(result.payload.periodRecords).not.toBe(local.periodRecords);
    expect(result.payload).not.toBe(local);
  });

  it('gives the same answer for frozen inputs as for ordinary ones', () => {
    const base = withRecords(record('a', '2026-01-05'));
    const local = withRecords(record('a', '2026-01-05', { endDate: date('2026-01-10') }));
    const remote = withRecords(record('a', '2026-01-05'), record('b', '2026-02-02'));

    const ordinary = merge(base, local, remote);
    const frozen = merge(deepFreeze(base), deepFreeze(local), deepFreeze(remote));

    expect(frozen).toEqual(ordinary);
  });
});

// ---------------------------------------------------------------------------
// 23. Absent is not null, and not a value
// ---------------------------------------------------------------------------

describe('a value that is simply not there', () => {
  it('takes an accessory one side added', () => {
    const result = merge(
      payload({ avatarConfig: avatar() }),
      payload({ avatarConfig: avatar({ accessoryId: 'glasses' }) }),
      payload({ avatarConfig: avatar() })
    );

    expect(result.kind).toBe('merged');
    expect(result.payload.avatarConfig).toEqual(avatar({ accessoryId: 'glasses' }));
  });

  it('takes an accessory one side removed', () => {
    const base = payload({ avatarConfig: avatar({ accessoryId: 'glasses' }) });

    const result = merge(base, payload({ avatarConfig: avatar() }), base);

    expect(result.kind).toBe('merged');
    expect(result.payload.avatarConfig).toEqual(avatar());
  });

  it('leaves the key out rather than setting it to undefined', () => {
    const base = payload({ avatarConfig: avatar({ accessoryId: 'glasses' }) });

    const result = merge(base, payload({ avatarConfig: avatar() }), base);

    expect(Object.keys(result.payload.avatarConfig ?? {})).not.toContain('accessoryId');
  });

  it('will not decide between removing an accessory and changing it', () => {
    const base = payload({ avatarConfig: avatar({ accessoryId: 'glasses' }) });

    const result = merge(
      base,
      payload({ avatarConfig: avatar() }),
      payload({ avatarConfig: avatar({ accessoryId: 'hat' }) })
    );

    expect(result.kind === 'conflict' && result.conflicts[0]).toMatchObject({
      path: 'avatarConfig.accessoryId',
      reason: 'removed-and-changed',
      local: { present: false },
      remote: { present: true, value: 'hat' },
    });
  });

  it('tells a record with no end date apart from one that ends', () => {
    const base = withRecords(record('a', '2026-01-05'));

    const result = merge(
      base,
      withRecords(record('a', '2026-01-05', { endDate: date('2026-01-10') })),
      base
    );

    expect(result.kind).toBe('merged');
    expect(recordById(result, 'a')).toHaveProperty('endDate', '2026-01-10');
  });

  it('keeps a cleared section as null rather than as a missing key', () => {
    const base = payload({ avatarConfig: avatar() });

    const result = merge(base, payload(), base);

    expect(result.payload.avatarConfig).toBeNull();
    expect(Object.keys(result.payload)).toContain('avatarConfig');
  });
});

// ---------------------------------------------------------------------------
// 24-26. Empty, identical, and many
// ---------------------------------------------------------------------------

describe('an account with nothing in it yet', () => {
  it('merges three empty histories to an empty one', () => {
    const result = merge(payload(), payload(), payload());

    expect(result.kind).toBe('merged');
    expect(result.payload.periodRecords).toEqual([]);
  });

  it('keeps the first records either side writes down', () => {
    const result = merge(
      payload(),
      withRecords(record('a', '2026-01-05')),
      withRecords(record('b', '2026-02-02'))
    );

    expect(result.kind).toBe('merged');
    expect(ids(result)).toEqual(['a', 'b']);
  });

  it('empties the history when both sides did', () => {
    const base = withRecords(record('a', '2026-01-05'));

    const result = merge(base, payload(), payload());

    expect(result.kind).toBe('merged');
    expect(result.payload.periodRecords).toEqual([]);
  });

  it('is the same payload when all three are identical', () => {
    const same = payload({
      cycleSettings: settings(30, 6),
      periodRecords: [record('a', '2026-01-05'), record('b', '2026-02-02')],
      pregnancyProfile: pregnancy(),
      avatarConfig: avatar({ accessoryId: 'glasses' }),
      notificationPreferences: preferences(true, true),
    });

    const result = merge(same, same, same);

    expect(result.kind).toBe('merged');
    expect(cloudSyncContentHash(result.payload)).toBe(cloudSyncContentHash(same));
  });
});

describe('a long history', () => {
  const many = Array.from({ length: 12 }, (_, index) =>
    record(`period-${String(index).padStart(2, '0')}`, `2026-${String(index + 1).padStart(2, '0')}-03`)
  );

  it('merges an addition at each end without touching the middle', () => {
    const base = withRecords(...many);

    const result = merge(
      base,
      withRecords(...many, record('period-zz', '2027-02-03')),
      withRecords(record('period-aa', '2025-12-03'), ...many)
    );

    expect(result.kind).toBe('merged');
    expect(ids(result)).toHaveLength(14);
    expect(ids(result)[0]).toBe('period-00');
    expect(ids(result)[13]).toBe('period-zz');
  });

  it('reports one conflict per contested record, in id order', () => {
    const base = withRecords(...many);
    const changeOne = (id: string, endDate: string) =>
      many.map((one) => (one.id === id ? { ...one, endDate: date(endDate) } : one));

    const result = merge(
      base,
      withRecords(...changeOne('period-03', '2026-04-08')),
      withRecords(...changeOne('period-03', '2026-04-09'))
    );

    expect(cloudSyncConflictPaths(result)).toEqual(['periodRecords/period-03']);
  });

  it('settles ten one-sided changes at once', () => {
    const base = withRecords(...many);
    const local = many.map((one, index) =>
      index < 5 ? { ...one, endDate: date(`2026-${String(index + 1).padStart(2, '0')}-08`) } : one
    );
    const remote = many.map((one, index) =>
      index >= 7 ? { ...one, endDate: date(`2026-${String(index + 1).padStart(2, '0')}-09`) } : one
    );

    const result = merge(base, withRecords(...local), withRecords(...remote));

    expect(result.kind).toBe('merged');
    expect(recordById(result, 'period-00')?.endDate).toBe('2026-01-08');
    expect(recordById(result, 'period-08')?.endDate).toBe('2026-09-09');
    expect(recordById(result, 'period-06')?.endDate).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// The result itself
// ---------------------------------------------------------------------------

describe('what the result promises', () => {
  it('always comes back as a payload the app would store', () => {
    const base = withRecords(record('a', '2026-01-05'));

    const result = merge(
      base,
      withRecords(record('a', '2026-01-05'), record('b', '2026-02-02')),
      withRecords(record('a', '2026-01-05'), record('c', '2026-02-02'))
    );

    expect(result.payload.version).toBe(1);
    expect(() => merge(result.payload, result.payload, result.payload)).not.toThrow();
  });

  it('carries no conflict list at all when there is nothing to report', () => {
    const result = merge(payload(), payload(), payload());

    expect(result.kind).toBe('merged');
    expect(result).not.toHaveProperty('conflicts');
  });

  it('carries both a payload and the conflicts when there is something to report', () => {
    const result = merge(
      payload(),
      payload({ cycleSettings: settings(30) }),
      payload({ cycleSettings: settings(32) })
    );

    expect(result.kind).toBe('conflict');
    expect(result).toHaveProperty('payload');
    expect(result.kind === 'conflict' && result.conflicts).toHaveLength(1);
  });

  it('refuses a payload the app itself would refuse', () => {
    expect(() =>
      merge(payload(), payload({ version: 2 as 1 }), payload())
    ).toThrow(/expects version 1/);
  });

  it('refuses a history the app itself would refuse', () => {
    expect(() =>
      merge(
        payload(),
        withRecords(record('a', '2026-01-05'), record('b', '2026-01-05')),
        payload()
      )
    ).toThrow(/same day/);
  });

  it('names no value when it refuses', () => {
    const thrown = (() => {
      try {
        merge(payload(), payload({ version: 2 as 1 }), payload());
      } catch (error) {
        return error as Error;
      }

      return new Error('expected a throw');
    })();

    expect(thrown.message).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('has no paths to report when nothing conflicted', () => {
    expect(cloudSyncConflictPaths(merge(payload(), payload(), payload()))).toEqual([]);
  });
});
