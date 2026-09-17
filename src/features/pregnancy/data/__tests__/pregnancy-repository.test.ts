import type { SQLiteDatabase } from 'expo-sqlite';

import { calculateEstimatedDueDate } from '../../domain/due-date';
import type { PregnancyDueDateSource, PregnancyProfile } from '../../domain/types';
import { loadPregnancyProfile, savePregnancyProfile } from '../pregnancy-repository';

import type { ISODate } from '@/types/iso-date';

type DatabaseSpy = {
  readonly db: SQLiteDatabase;
  readonly runAsync: jest.Mock;
  readonly getFirstAsync: jest.Mock;
  readonly getAllAsync: jest.Mock;
  readonly execAsync: jest.Mock;
  readonly withTransactionAsync: jest.Mock;
};

function createDatabaseSpy(row: unknown = null, runError?: Error): DatabaseSpy {
  const runAsync = runError
    ? jest.fn().mockRejectedValue(runError)
    : jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
  const getFirstAsync = jest.fn().mockResolvedValue(row);
  const getAllAsync = jest.fn().mockResolvedValue([]);
  const execAsync = jest.fn().mockResolvedValue(undefined);
  const withTransactionAsync = jest.fn(async (task: () => Promise<void>) => {
    await task();
  });

  const db = {
    runAsync,
    getFirstAsync,
    getAllAsync,
    execAsync,
    withTransactionAsync,
  } as unknown as SQLiteDatabase;

  return { db, runAsync, getFirstAsync, getAllAsync, execAsync, withTransactionAsync };
}

/** Collapses whitespace so assertions do not depend on SQL formatting. */
function normalize(sql: unknown): string {
  return String(sql).replace(/\s+/g, ' ').trim();
}

const date = (value: string) => value as ISODate;

const LMP = '2026-09-02';
const CALCULATED_DUE_DATE = calculateEstimatedDueDate(date(LMP));

function fromLmp(): PregnancyProfile {
  return {
    lastMenstrualPeriodStartDate: date(LMP),
    estimatedDueDate: CALCULATED_DUE_DATE,
    dueDateSource: 'lmp',
  };
}

function adjusted(dueDate = '2027-06-04'): PregnancyProfile {
  return {
    lastMenstrualPeriodStartDate: date(LMP),
    estimatedDueDate: date(dueDate),
    dueDateSource: 'adjusted',
  };
}

function row(
  overrides: Partial<{
    last_menstrual_period_start_date: unknown;
    estimated_due_date: unknown;
    due_date_source: unknown;
  }> = {}
) {
  return {
    last_menstrual_period_start_date: LMP,
    estimated_due_date: CALCULATED_DUE_DATE,
    due_date_source: 'lmp',
    ...overrides,
  };
}

describe('savePregnancyProfile', () => {
  it('writes through a single upsert', async () => {
    const spy = createDatabaseSpy();

    await savePregnancyProfile(spy.db, fromLmp());

    expect(spy.runAsync).toHaveBeenCalledTimes(1);
  });

  it('targets the pregnancy table', async () => {
    const spy = createDatabaseSpy();

    await savePregnancyProfile(spy.db, fromLmp());

    expect(normalize(spy.runAsync.mock.calls[0][0])).toMatch(
      /^INSERT INTO pregnancy_profile \(/i
    );
  });

  it('upserts rather than failing on the pinned row', async () => {
    const spy = createDatabaseSpy();

    await savePregnancyProfile(spy.db, fromLmp());

    expect(normalize(spy.runAsync.mock.calls[0][0])).toMatch(/ON CONFLICT\(id\) DO UPDATE SET/i);
  });

  it('binds every value rather than interpolating it', async () => {
    const spy = createDatabaseSpy();

    await savePregnancyProfile(spy.db, fromLmp());

    const [sql, ...bindings] = spy.runAsync.mock.calls[0];

    expect(normalize(sql)).toMatch(/VALUES \(\?, \?, \?, \?\)/i);
    expect(bindings).toEqual([1, LMP, CALCULATED_DUE_DATE, 'lmp']);
  });

  it('never puts a stored value into the statement text', async () => {
    const spy = createDatabaseSpy();

    await savePregnancyProfile(spy.db, adjusted());

    const sql = normalize(spy.runAsync.mock.calls[0][0]);

    expect(sql).not.toContain(LMP);
    expect(sql).not.toContain('2027-06-04');
    expect(sql).not.toContain('adjusted');
  });

  it('stores the row under id 1', async () => {
    const spy = createDatabaseSpy();

    await savePregnancyProfile(spy.db, fromLmp());

    expect(spy.runAsync.mock.calls[0][1]).toBe(1);
  });

  it('stores an adjusted due date and its source', async () => {
    const spy = createDatabaseSpy();

    await savePregnancyProfile(spy.db, adjusted());

    expect(spy.runAsync.mock.calls[0].slice(1)).toEqual([1, LMP, '2027-06-04', 'adjusted']);
  });

  it('runs no other statements', async () => {
    const spy = createDatabaseSpy();

    await savePregnancyProfile(spy.db, fromLmp());

    expect(spy.execAsync).not.toHaveBeenCalled();
    expect(spy.getAllAsync).not.toHaveBeenCalled();
  });

  it('passes a write failure on', async () => {
    const spy = createDatabaseSpy(null, new Error('disk is full'));

    await expect(savePregnancyProfile(spy.db, fromLmp())).rejects.toThrow('disk is full');
  });
});

describe('savePregnancyProfile validation', () => {
  it('refuses a calculated due date that does not match the formula', async () => {
    const spy = createDatabaseSpy();

    await expect(
      savePregnancyProfile(spy.db, {
        lastMenstrualPeriodStartDate: date(LMP),
        estimatedDueDate: date('2027-06-10'),
        dueDateSource: 'lmp',
      })
    ).rejects.toThrow(/counted from the last menstrual period/);

    expect(spy.runAsync).not.toHaveBeenCalled();
  });

  it('refuses an adjusted due date before the pregnancy began', async () => {
    const spy = createDatabaseSpy();

    await expect(savePregnancyProfile(spy.db, adjusted('2026-09-01'))).rejects.toThrow(
      /before the pregnancy began/
    );

    expect(spy.runAsync).not.toHaveBeenCalled();
  });

  it('refuses an invalid date', async () => {
    const spy = createDatabaseSpy();

    await expect(savePregnancyProfile(spy.db, adjusted('2027-02-30'))).rejects.toThrow(
      /invalid estimatedDueDate/
    );

    expect(spy.runAsync).not.toHaveBeenCalled();
  });

  it('refuses an unknown source', async () => {
    const spy = createDatabaseSpy();

    await expect(
      savePregnancyProfile(spy.db, {
        lastMenstrualPeriodStartDate: date(LMP),
        estimatedDueDate: CALCULATED_DUE_DATE,
        dueDateSource: 'scan' as PregnancyDueDateSource,
      })
    ).rejects.toThrow(/invalid dueDateSource/);

    expect(spy.runAsync).not.toHaveBeenCalled();
  });

  it('leaves the profile it was given alone', async () => {
    const spy = createDatabaseSpy();
    const profile = adjusted();
    const before = JSON.stringify(profile);

    await savePregnancyProfile(spy.db, profile);

    expect(JSON.stringify(profile)).toBe(before);
  });
});

describe('loadPregnancyProfile', () => {
  it('returns null when no pregnancy has been saved', async () => {
    const spy = createDatabaseSpy(null);

    await expect(loadPregnancyProfile(spy.db)).resolves.toBeNull();
  });

  it('returns null for an undefined row', async () => {
    const spy = createDatabaseSpy(undefined);

    await expect(loadPregnancyProfile(spy.db)).resolves.toBeNull();
  });

  it('reads the pinned row by id', async () => {
    const spy = createDatabaseSpy(row());

    await loadPregnancyProfile(spy.db);

    const [sql, ...bindings] = spy.getFirstAsync.mock.calls[0];

    expect(normalize(sql)).toMatch(/FROM pregnancy_profile WHERE id = \?/i);
    expect(bindings).toEqual([1]);
  });

  it('rebuilds a profile whose due date came from the LMP', async () => {
    const spy = createDatabaseSpy(row());

    await expect(loadPregnancyProfile(spy.db)).resolves.toEqual({
      lastMenstrualPeriodStartDate: LMP,
      estimatedDueDate: CALCULATED_DUE_DATE,
      dueDateSource: 'lmp',
    });
  });

  it('rebuilds a profile whose due date was adjusted', async () => {
    const spy = createDatabaseSpy(
      row({ estimated_due_date: '2027-06-04', due_date_source: 'adjusted' })
    );

    await expect(loadPregnancyProfile(spy.db)).resolves.toEqual({
      lastMenstrualPeriodStartDate: LMP,
      estimatedDueDate: '2027-06-04',
      dueDateSource: 'adjusted',
    });
  });

  it('writes nothing while reading', async () => {
    const spy = createDatabaseSpy(row());

    await loadPregnancyProfile(spy.db);

    expect(spy.runAsync).not.toHaveBeenCalled();
    expect(spy.execAsync).not.toHaveBeenCalled();
  });

  it('passes a read failure on', async () => {
    const spy = createDatabaseSpy(row());
    spy.getFirstAsync.mockRejectedValue(new Error('database is locked'));

    await expect(loadPregnancyProfile(spy.db)).rejects.toThrow('database is locked');
  });
});

describe('loadPregnancyProfile with a corrupt row', () => {
  it('refuses an unknown due date source', async () => {
    const spy = createDatabaseSpy(row({ due_date_source: 'scan' }));

    await expect(loadPregnancyProfile(spy.db)).rejects.toThrow(
      /invalid due_date_source: "scan"/
    );
  });

  it('refuses a null due date source', async () => {
    const spy = createDatabaseSpy(row({ due_date_source: null }));

    await expect(loadPregnancyProfile(spy.db)).rejects.toThrow(/invalid due_date_source/);
  });

  it('refuses a source with the wrong casing', async () => {
    const spy = createDatabaseSpy(row({ due_date_source: 'LMP' }));

    await expect(loadPregnancyProfile(spy.db)).rejects.toThrow(/invalid due_date_source/);
  });

  it('refuses a last menstrual period date that is not a date', async () => {
    const spy = createDatabaseSpy(row({ last_menstrual_period_start_date: 'dün' }));

    await expect(loadPregnancyProfile(spy.db)).rejects.toThrow(/Invalid ISO date/);
  });

  it('refuses a due date that is not a real calendar day', async () => {
    const spy = createDatabaseSpy(
      row({ estimated_due_date: '2027-02-30', due_date_source: 'adjusted' })
    );

    await expect(loadPregnancyProfile(spy.db)).rejects.toThrow(/Invalid ISO date/);
  });

  it('refuses a non-text date', async () => {
    const spy = createDatabaseSpy(row({ last_menstrual_period_start_date: 20260902 }));

    await expect(loadPregnancyProfile(spy.db)).rejects.toThrow(
      /non-text last_menstrual_period_start_date/
    );
  });

  it('refuses a null date', async () => {
    const spy = createDatabaseSpy(row({ estimated_due_date: null }));

    await expect(loadPregnancyProfile(spy.db)).rejects.toThrow(/non-text estimated_due_date/);
  });

  it('refuses a due date that disagrees with the source it claims', async () => {
    // Stored as counted from the LMP, but it is not what the formula gives.
    const spy = createDatabaseSpy(row({ estimated_due_date: '2027-06-10' }));

    await expect(loadPregnancyProfile(spy.db)).rejects.toThrow(
      /counted from the last menstrual period/
    );
  });

  it('refuses an adjusted due date before the pregnancy began', async () => {
    const spy = createDatabaseSpy(
      row({ estimated_due_date: '2026-08-01', due_date_source: 'adjusted' })
    );

    await expect(loadPregnancyProfile(spy.db)).rejects.toThrow(/before the pregnancy began/);
  });

  it('never repairs a corrupt row by writing to it', async () => {
    const spy = createDatabaseSpy(row({ due_date_source: 'scan' }));

    await expect(loadPregnancyProfile(spy.db)).rejects.toThrow();

    expect(spy.runAsync).not.toHaveBeenCalled();
    expect(spy.execAsync).not.toHaveBeenCalled();
  });
});

describe('pregnancy profile round trip', () => {
  /** Saves through one spy, then reads back what the row would hold. */
  async function roundTrip(profile: PregnancyProfile): Promise<PregnancyProfile | null> {
    const writer = createDatabaseSpy();

    await savePregnancyProfile(writer.db, profile);

    const [, , lmp, dueDate, source] = writer.runAsync.mock.calls[0];

    const reader = createDatabaseSpy({
      last_menstrual_period_start_date: lmp,
      estimated_due_date: dueDate,
      due_date_source: source,
    });

    return loadPregnancyProfile(reader.db);
  }

  it('brings a calculated profile back unchanged', async () => {
    const profile = fromLmp();

    await expect(roundTrip(profile)).resolves.toEqual(profile);
  });

  it('brings an adjusted profile back unchanged', async () => {
    const profile = adjusted();

    await expect(roundTrip(profile)).resolves.toEqual(profile);
  });

  it('keeps an adjusted date that happens to match the formula adjusted', async () => {
    const profile = adjusted(CALCULATED_DUE_DATE);

    await expect(roundTrip(profile)).resolves.toEqual({
      lastMenstrualPeriodStartDate: LMP,
      estimatedDueDate: CALCULATED_DUE_DATE,
      dueDateSource: 'adjusted',
    });
  });

  it('survives a due date across a leap year', async () => {
    const lmp = date('2028-02-20');
    const profile: PregnancyProfile = {
      lastMenstrualPeriodStartDate: lmp,
      estimatedDueDate: calculateEstimatedDueDate(lmp),
      dueDateSource: 'lmp',
    };

    await expect(roundTrip(profile)).resolves.toEqual(profile);
  });
});
