import type { SQLiteDatabase } from 'expo-sqlite';

import type { CycleProfile, CycleSettings, PeriodRecord } from '../domain/types';
import {
  validateCycleProfile,
  validateCycleSettings,
  validatePeriodRecord,
} from '../domain/validation';

import { toISODate } from '@/utils/date';
import { describeValue } from '@/shared/logging';
import { notifyLocalDataChanged } from '@/shared/data-change/local-data-change';

/**
 * Persistence for `CycleProfile`.
 *
 * The only layer that knows SQL. It speaks domain types on both sides and never
 * lets a row shape escape upwards.
 *
 * Every value crossing into SQL goes through parameter binding; no domain value
 * is ever interpolated into a statement string.
 */

/** `cycle_settings` holds a single row, pinned by a CHECK constraint. */
const SETTINGS_ROW_ID = 1;

type SettingsRow = {
  readonly average_cycle_length_days: number;
  readonly average_period_length_days: number;
};

type PeriodRow = {
  readonly id: string;
  readonly start_date: string;
  readonly end_date: string | null;
  readonly is_ongoing: unknown;
};

/**
 * SQLite has no boolean, so the column stores 0 or 1.
 *
 * Anything else is corruption rather than something to coerce: `Boolean(2)` and
 * `Boolean("0")` would both quietly say a period is running.
 */
function toIsOngoing(id: string, value: unknown): boolean {
  if (value === 0) return false;
  if (value === 1) return true;

  throw new Error(
    `A stored period record has an invalid is_ongoing value: ${describeValue(value)}. ` +
      'Expected 0 or 1.'
  );
}

const UPSERT_SETTINGS = `
  INSERT INTO cycle_settings (id, average_cycle_length_days, average_period_length_days)
  VALUES (?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    average_cycle_length_days = excluded.average_cycle_length_days,
    average_period_length_days = excluded.average_period_length_days
`;

const DELETE_PERIOD_RECORDS = 'DELETE FROM period_records';

const DELETE_SETTINGS = 'DELETE FROM cycle_settings WHERE id = ?';

const INSERT_PERIOD_RECORD =
  'INSERT INTO period_records (id, start_date, end_date, is_ongoing) VALUES (?, ?, ?, ?)';

const SELECT_SETTINGS = `
  SELECT average_cycle_length_days, average_period_length_days
  FROM cycle_settings
  WHERE id = ?
`;

const SELECT_PERIOD_RECORDS = `
  SELECT id, start_date, end_date, is_ongoing
  FROM period_records
  ORDER BY start_date ASC
`;

/**
 * Writes the whole profile.
 *
 * Period records are stored as a full snapshot — cleared, then re-inserted —
 * rather than diffed. That is deliberately the simplest thing that is correct:
 * the profile is small, and a snapshot cannot drift out of sync with the domain
 * object the way a partial update can.
 *
 * The profile is validated first, so invalid data never reaches the database,
 * and the whole write shares one transaction.
 */
export async function saveCycleProfile(
  db: SQLiteDatabase,
  profile: CycleProfile
): Promise<void> {
  validateCycleProfile(profile);

  await db.withTransactionAsync(async () => {
    await writeCycleSettings(db, profile.settings);
    await replacePeriodRecords(db, profile.periodRecords);
  });

  notifyLocalDataChanged();
}

/**
 * Writes the settings, without a transaction of its own.
 *
 * For a caller that already owns one and has more to write inside it — a
 * restore, which has to leave the database either wholly replaced or wholly
 * untouched. `saveCycleProfile` is the one to reach for otherwise.
 */
export async function writeCycleSettings(
  db: SQLiteDatabase,
  settings: CycleSettings
): Promise<void> {
  validateCycleSettings(settings);

  await db.runAsync(
    UPSERT_SETTINGS,
    SETTINGS_ROW_ID,
    settings.averageCycleLengthDays,
    settings.averagePeriodLengthDays
  );

  notifyLocalDataChanged();
}

/**
 * Replaces every period record with the ones given, without a transaction of
 * its own.
 *
 * A snapshot rather than a diff, which is what the whole profile write does as
 * well: the list is small, and a snapshot cannot drift out of sync with the
 * domain object the way a partial update can.
 */
export async function replacePeriodRecords(
  db: SQLiteDatabase,
  records: readonly PeriodRecord[]
): Promise<void> {
  records.forEach((record) => {
    validatePeriodRecord(record);
  });

  await db.runAsync(DELETE_PERIOD_RECORDS);

  for (const record of records) {
    await db.runAsync(
      INSERT_PERIOD_RECORD,
      record.id,
      record.startDate,
      record.endDate ?? null,
      record.isOngoing ? 1 : 0
    );
  }

  notifyLocalDataChanged();
}

/**
 * Removes the stored settings, without a transaction of its own.
 *
 * Leaves the period records alone: they are a separate table and a separate
 * question, and a caller that wants both gone says so twice.
 */
export async function clearCycleSettings(db: SQLiteDatabase): Promise<void> {
  await db.runAsync(DELETE_SETTINGS, SETTINGS_ROW_ID);

  notifyLocalDataChanged();
}

/**
 * Reads the stored profile, or `null` when nothing has been saved yet.
 *
 * Stored dates are re-checked with `toISODate` and the assembled profile is run
 * through `validateCycleProfile`. Corrupt rows raise rather than being repaired
 * or skipped: silently "fixing" health data would hide the corruption and hand
 * the user a wrong prediction.
 *
 * Rows come back ordered by start date for stable reads; the domain does not
 * depend on that order.
 */
export async function loadCycleProfile(db: SQLiteDatabase): Promise<CycleProfile | null> {
  const settingsRow = await db.getFirstAsync<SettingsRow>(SELECT_SETTINGS, SETTINGS_ROW_ID);

  if (!settingsRow) {
    return null;
  }

  const periodRows = await db.getAllAsync<PeriodRow>(SELECT_PERIOD_RECORDS);

  const periodRecords: PeriodRecord[] = periodRows.map((row) => {
    const startDate = toISODate(row.start_date);
    const isOngoing = toIsOngoing(row.id, row.is_ongoing);

    return row.end_date === null || row.end_date === undefined
      ? { id: row.id, startDate, isOngoing }
      : { id: row.id, startDate, endDate: toISODate(row.end_date), isOngoing };
  });

  const profile: CycleProfile = {
    settings: {
      averageCycleLengthDays: settingsRow.average_cycle_length_days,
      averagePeriodLengthDays: settingsRow.average_period_length_days,
    },
    periodRecords,
  };

  validateCycleProfile(profile);

  return profile;
}
