import type { SQLiteDatabase } from 'expo-sqlite';

import { emptyDailyEntry } from '../../domain/catalogues';
import {
  clearDailyEntry,
  loadAllDailyEntries,
  loadDailyEntry,
  replaceDailyEntries,
  saveDailyEntry,
} from '../daily-log-repository';

import type { ISODate } from '@/types/iso-date';

jest.mock('@/shared/data-change/local-data-change', () => ({
  notifyLocalDataChanged: jest.fn(),
}));

const changes = jest.requireMock('@/shared/data-change/local-data-change') as {
  notifyLocalDataChanged: jest.Mock;
};

const date = (value: string) => value as ISODate;

type Spy = {
  readonly db: SQLiteDatabase;
  readonly runAsync: jest.Mock;
  readonly getFirstAsync: jest.Mock;
  readonly getAllAsync: jest.Mock;
  readonly withTransactionAsync: jest.Mock;
};

/** A stand-in database that records every statement, so nothing slips through. */
function createSpy(): Spy {
  const runAsync = jest.fn().mockResolvedValue(undefined);
  const getFirstAsync = jest.fn().mockResolvedValue(null);
  const getAllAsync = jest.fn().mockResolvedValue([]);
  const withTransactionAsync = jest.fn(async (task: () => Promise<void>) => {
    await task();
  });

  return {
    db: { runAsync, getFirstAsync, getAllAsync, withTransactionAsync } as unknown as SQLiteDatabase,
    runAsync,
    getFirstAsync,
    getAllAsync,
    withTransactionAsync,
  };
}

/** Every statement the spy was asked to run, in order. */
const statements = (spy: Spy) => spy.runAsync.mock.calls.map((call) => String(call[0]));

beforeEach(() => {
  changes.notifyLocalDataChanged.mockReset();
});

describe('reading one day', () => {
  it('answers with an empty day when nothing was recorded', async () => {
    // Not null and not an error: "nothing on the 14th" is a real answer, and
    // the screen draws it the same way it draws a day somebody cleared.
    const spy = createSpy();

    await expect(loadDailyEntry(spy.db, date('2026-10-14'))).resolves.toEqual(
      emptyDailyEntry(date('2026-10-14'))
    );
  });

  it('does not go looking for symptoms when there is no day', async () => {
    const spy = createSpy();

    await loadDailyEntry(spy.db, date('2026-10-14'));

    expect(spy.getAllAsync).not.toHaveBeenCalled();
  });

  it('puts the row and its symptoms back together', async () => {
    const spy = createSpy();
    spy.getFirstAsync.mockResolvedValue({
      entry_date: '2026-10-14',
      flow_id: 'medium',
      mood_id: 'good',
    });
    spy.getAllAsync.mockResolvedValue([{ symptom_id: 'cramps' }, { symptom_id: 'fatigue' }]);

    await expect(loadDailyEntry(spy.db, date('2026-10-14'))).resolves.toEqual({
      date: '2026-10-14',
      flowId: 'medium',
      moodId: 'good',
      symptomIds: ['cramps', 'fatigue'],
    });
  });

  it('keeps a null flow and mood as null rather than inventing one', async () => {
    const spy = createSpy();
    spy.getFirstAsync.mockResolvedValue({
      entry_date: '2026-10-14',
      flow_id: null,
      mood_id: null,
    });
    spy.getAllAsync.mockResolvedValue([{ symptom_id: 'cramps' }]);

    const entry = await loadDailyEntry(spy.db, date('2026-10-14'));

    expect(entry.flowId).toBeNull();
    expect(entry.moodId).toBeNull();
  });

  it('asks only about the day it was given', async () => {
    const spy = createSpy();

    await loadDailyEntry(spy.db, date('2026-10-14'));

    expect(spy.getFirstAsync.mock.calls[0][1]).toBe('2026-10-14');
  });
});

describe('saving a day', () => {
  it('writes the row and its symptoms in one transaction', async () => {
    const spy = createSpy();

    await saveDailyEntry(spy.db, {
      date: date('2026-10-14'),
      flowId: 'medium',
      moodId: 'good',
      symptomIds: ['cramps'],
    });

    expect(spy.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(statements(spy).some((sql) => sql.includes('INSERT INTO daily_entries'))).toBe(true);
    expect(statements(spy).some((sql) => sql.includes('INSERT INTO daily_entry_symptoms'))).toBe(
      true
    );
  });

  it('replaces the symptoms rather than adding to them', async () => {
    // A snapshot cannot drift out of step with what the caller passed the way
    // a partial update can.
    const spy = createSpy();

    await saveDailyEntry(spy.db, {
      date: date('2026-10-14'),
      flowId: null,
      moodId: null,
      symptomIds: ['cramps'],
    });

    const deletes = statements(spy).filter((sql) => sql.includes('DELETE FROM daily_entry_symptoms'));

    expect(deletes).toHaveLength(1);
  });

  it('deletes the day when there is nothing left in it', async () => {
    // "I cleared this" and "I never opened this" have to stay the same answer.
    const spy = createSpy();

    await saveDailyEntry(spy.db, emptyDailyEntry(date('2026-10-14')));

    expect(statements(spy)).toEqual([
      expect.stringContaining('DELETE FROM daily_entry_symptoms'),
      expect.stringContaining('DELETE FROM daily_entries'),
    ]);
  });

  it('writes no row at all for an empty day', async () => {
    const spy = createSpy();

    await saveDailyEntry(spy.db, emptyDailyEntry(date('2026-10-14')));

    expect(statements(spy).some((sql) => sql.includes('INSERT'))).toBe(false);
  });

  it('refuses a day the domain refuses, before touching the database', async () => {
    const spy = createSpy();

    await expect(
      saveDailyEntry(spy.db, {
        date: date('2026-10-14'),
        flowId: null,
        moodId: null,
        symptomIds: ['cramps', 'cramps'],
      })
    ).rejects.toThrow();

    expect(spy.withTransactionAsync).not.toHaveBeenCalled();
  });

  it('announces the change, so every open screen re-reads', async () => {
    const spy = createSpy();

    await saveDailyEntry(spy.db, {
      date: date('2026-10-14'),
      flowId: 'light',
      moodId: null,
      symptomIds: [],
    });

    expect(changes.notifyLocalDataChanged).toHaveBeenCalledTimes(1);
  });

  it('announces a clear too', async () => {
    const spy = createSpy();

    await clearDailyEntry(spy.db, date('2026-10-14'));

    expect(changes.notifyLocalDataChanged).toHaveBeenCalledTimes(1);
  });
});

describe('reading every day', () => {
  it('groups the symptoms onto their days', async () => {
    const spy = createSpy();
    spy.getAllAsync
      .mockResolvedValueOnce([
        { entry_date: '2026-10-14', flow_id: 'medium', mood_id: null },
        { entry_date: '2026-10-15', flow_id: null, mood_id: 'good' },
      ])
      .mockResolvedValueOnce([
        { entry_date: '2026-10-14', symptom_id: 'cramps' },
        { entry_date: '2026-10-14', symptom_id: 'fatigue' },
        { entry_date: '2026-10-15', symptom_id: 'acne' },
      ]);

    await expect(loadAllDailyEntries(spy.db)).resolves.toEqual([
      { date: '2026-10-14', flowId: 'medium', moodId: null, symptomIds: ['cramps', 'fatigue'] },
      { date: '2026-10-15', flowId: null, moodId: 'good', symptomIds: ['acne'] },
    ]);
  });

  it('gives a day with no symptoms an empty list', async () => {
    const spy = createSpy();
    spy.getAllAsync
      .mockResolvedValueOnce([{ entry_date: '2026-10-14', flow_id: 'light', mood_id: null }])
      .mockResolvedValueOnce([]);

    const entries = await loadAllDailyEntries(spy.db);

    expect(entries[0].symptomIds).toEqual([]);
  });

  it('comes back in an order two devices will agree on', async () => {
    // A fingerprint has to reduce the same data to the same text wherever it
    // is computed, and SQLite promises nothing about order without ORDER BY.
    const spy = createSpy();
    spy.getAllAsync
      .mockResolvedValueOnce([
        { entry_date: '2026-10-15', flow_id: 'light', mood_id: null },
        { entry_date: '2026-10-13', flow_id: 'light', mood_id: null },
      ])
      .mockResolvedValueOnce([
        { entry_date: '2026-10-13', symptom_id: 'fatigue' },
        { entry_date: '2026-10-13', symptom_id: 'acne' },
      ]);

    const entries = await loadAllDailyEntries(spy.db);

    expect(entries.map((entry) => entry.date)).toEqual(['2026-10-13', '2026-10-15']);
    expect(entries[0].symptomIds).toEqual(['acne', 'fatigue']);
  });

  it('answers with nothing when no day was ever recorded', async () => {
    const spy = createSpy();

    await expect(loadAllDailyEntries(spy.db)).resolves.toEqual([]);
  });
});

describe('replacing every day, as a restore does', () => {
  it('empties both tables first', async () => {
    const spy = createSpy();

    await replaceDailyEntries(spy.db, []);

    expect(statements(spy)).toEqual([
      'DELETE FROM daily_entry_symptoms',
      'DELETE FROM daily_entries',
    ]);
  });

  it('opens no transaction of its own', async () => {
    // The restore owns the transaction and has more to write inside it.
    const spy = createSpy();

    await replaceDailyEntries(spy.db, []);

    expect(spy.withTransactionAsync).not.toHaveBeenCalled();
  });

  it('writes the days it was given', async () => {
    const spy = createSpy();

    await replaceDailyEntries(spy.db, [
      { date: date('2026-10-14'), flowId: 'medium', moodId: null, symptomIds: ['cramps'] },
    ]);

    expect(statements(spy).filter((sql) => sql.includes('INSERT INTO daily_entries'))).toHaveLength(
      1
    );
  });

  it('skips an empty day rather than storing one', async () => {
    const spy = createSpy();

    await replaceDailyEntries(spy.db, [emptyDailyEntry(date('2026-10-14'))]);

    expect(statements(spy).some((sql) => sql.includes('INSERT'))).toBe(false);
  });

  it('refuses the whole list when one day is invalid, before writing', async () => {
    const spy = createSpy();

    await expect(
      replaceDailyEntries(spy.db, [
        { date: date('nope'), flowId: 'light', moodId: null, symptomIds: [] },
      ])
    ).rejects.toThrow();

    expect(spy.runAsync).not.toHaveBeenCalled();
  });

  it('announces nothing by itself', async () => {
    // The restore announces once, for everything it wrote.
    const spy = createSpy();

    await replaceDailyEntries(spy.db, []);

    expect(changes.notifyLocalDataChanged).not.toHaveBeenCalled();
  });
});
