import type { SQLiteDatabase } from 'expo-sqlite';

import type { DailyEntry } from '../domain/catalogues';
import { emptyDailyEntry, hasAnything } from '../domain/catalogues';
import { sortDailyEntries, validateDailyEntry } from '../domain/validation';

import { notifyLocalDataChanged } from '@/shared/data-change/local-data-change';
import type { ISODate } from '@/types/iso-date';

/**
 * Reading and writing what a person noticed on a day.
 *
 * Two tables behind one shape. Callers pass and receive a whole `DailyEntry`;
 * that the symptoms live in a second table is this file's problem.
 *
 * A day with nothing in it is deleted rather than stored, so that "I cleared
 * this" and "I never opened this" stay the same answer. Anything else would
 * grow the backup with rows nobody asked for and make an empty day something a
 * merge had to have an opinion about.
 */

const SELECT_ENTRY = 'SELECT entry_date, flow_id, mood_id FROM daily_entries WHERE entry_date = ?';

const SELECT_SYMPTOMS =
  'SELECT symptom_id FROM daily_entry_symptoms WHERE entry_date = ? ORDER BY symptom_id';

const SELECT_ALL_ENTRIES =
  'SELECT entry_date, flow_id, mood_id FROM daily_entries ORDER BY entry_date';

const SELECT_ALL_SYMPTOMS =
  'SELECT entry_date, symptom_id FROM daily_entry_symptoms ORDER BY entry_date, symptom_id';

const UPSERT_ENTRY = `
  INSERT INTO daily_entries (entry_date, flow_id, mood_id)
  VALUES (?, ?, ?)
  ON CONFLICT(entry_date) DO UPDATE SET flow_id = excluded.flow_id, mood_id = excluded.mood_id
`;

const DELETE_ENTRY = 'DELETE FROM daily_entries WHERE entry_date = ?';
const DELETE_SYMPTOMS = 'DELETE FROM daily_entry_symptoms WHERE entry_date = ?';
const INSERT_SYMPTOM =
  'INSERT INTO daily_entry_symptoms (entry_date, symptom_id) VALUES (?, ?)';

const DELETE_ALL_ENTRIES = 'DELETE FROM daily_entries';
const DELETE_ALL_SYMPTOMS = 'DELETE FROM daily_entry_symptoms';

type EntryRow = {
  readonly entry_date: string;
  readonly flow_id: string | null;
  readonly mood_id: string | null;
};

type SymptomRow = {
  readonly entry_date: string;
  readonly symptom_id: string;
};

/**
 * One day, or an empty one when nothing was recorded.
 *
 * An absent row is not an error and not `null`: "nothing recorded on the 14th"
 * is a real answer and the screen draws it the same way it draws a day somebody
 * cleared.
 */
export async function loadDailyEntry(db: SQLiteDatabase, date: ISODate): Promise<DailyEntry> {
  const row = await db.getFirstAsync<EntryRow>(SELECT_ENTRY, date);

  if (row === null || row === undefined) {
    return emptyDailyEntry(date);
  }

  const symptoms = await db.getAllAsync<{ readonly symptom_id: string }>(SELECT_SYMPTOMS, date);

  return {
    date: row.entry_date as ISODate,
    flowId: row.flow_id,
    moodId: row.mood_id,
    symptomIds: symptoms.map((symptom) => symptom.symptom_id),
  };
}

/**
 * Every recorded day, for a backup or a hash.
 *
 * Two reads and a join done here rather than a SQL join: a join would return
 * one row per symptom and the caller would have to regroup them anyway, and a
 * day with no symptoms would need an outer join to survive it.
 */
export async function loadAllDailyEntries(db: SQLiteDatabase): Promise<readonly DailyEntry[]> {
  const [rows, symptoms] = await Promise.all([
    db.getAllAsync<EntryRow>(SELECT_ALL_ENTRIES),
    db.getAllAsync<SymptomRow>(SELECT_ALL_SYMPTOMS),
  ]);

  const byDate = new Map<string, string[]>();

  for (const symptom of symptoms) {
    const existing = byDate.get(symptom.entry_date);

    if (existing === undefined) {
      byDate.set(symptom.entry_date, [symptom.symptom_id]);
    } else {
      existing.push(symptom.symptom_id);
    }
  }

  return sortDailyEntries(
    rows.map((row) => ({
      date: row.entry_date as ISODate,
      flowId: row.flow_id,
      moodId: row.mood_id,
      symptomIds: byDate.get(row.entry_date) ?? [],
    }))
  );
}

/**
 * Stores one day, or deletes it when there is nothing left in it.
 *
 * One transaction. The symptoms are replaced wholesale rather than diffed:
 * there are at most a handful, and a snapshot cannot drift out of step with
 * what the caller passed the way a partial update can.
 */
export async function saveDailyEntry(db: SQLiteDatabase, entry: DailyEntry): Promise<void> {
  validateDailyEntry(entry);

  await db.withTransactionAsync(async () => {
    if (!hasAnything(entry)) {
      await db.runAsync(DELETE_SYMPTOMS, entry.date);
      await db.runAsync(DELETE_ENTRY, entry.date);

      return;
    }

    await db.runAsync(UPSERT_ENTRY, entry.date, entry.flowId, entry.moodId);
    await db.runAsync(DELETE_SYMPTOMS, entry.date);

    for (const symptomId of entry.symptomIds) {
      await db.runAsync(INSERT_SYMPTOM, entry.date, symptomId);
    }
  });

  notifyLocalDataChanged();
}

/** Removes a day entirely. The same thing as saving an empty one, said plainly. */
export async function clearDailyEntry(db: SQLiteDatabase, date: ISODate): Promise<void> {
  await saveDailyEntry(db, emptyDailyEntry(date));
}

/**
 * Replaces every recorded day with the ones given, without a transaction of its
 * own.
 *
 * For a restore, which owns the transaction and has more to write inside it.
 * A snapshot rather than a diff, like the period history: days the phone has
 * and the backup does not are gone, because that is what restoring a backup
 * means.
 */
export async function replaceDailyEntries(
  db: SQLiteDatabase,
  entries: readonly DailyEntry[]
): Promise<void> {
  entries.forEach((entry) => {
    validateDailyEntry(entry);
  });

  await db.runAsync(DELETE_ALL_SYMPTOMS);
  await db.runAsync(DELETE_ALL_ENTRIES);

  for (const entry of entries) {
    if (!hasAnything(entry)) {
      continue;
    }

    await db.runAsync(UPSERT_ENTRY, entry.date, entry.flowId, entry.moodId);

    for (const symptomId of entry.symptomIds) {
      await db.runAsync(INSERT_SYMPTOM, entry.date, symptomId);
    }
  }
}
