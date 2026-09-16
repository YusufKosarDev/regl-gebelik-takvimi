import type { SQLiteDatabase } from 'expo-sqlite';

import type { CycleProfile, PeriodRecord } from '../domain/types';
import { validateCycleProfile } from '../domain/validation';

import { toISODate } from '@/utils/date';

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
};

const UPSERT_SETTINGS = `
  INSERT INTO cycle_settings (id, average_cycle_length_days, average_period_length_days)
  VALUES (?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    average_cycle_length_days = excluded.average_cycle_length_days,
    average_period_length_days = excluded.average_period_length_days
`;

const DELETE_PERIOD_RECORDS = 'DELETE FROM period_records';

const INSERT_PERIOD_RECORD =
  'INSERT INTO period_records (id, start_date, end_date) VALUES (?, ?, ?)';

const SELECT_SETTINGS = `
  SELECT average_cycle_length_days, average_period_length_days
  FROM cycle_settings
  WHERE id = ?
`;

const SELECT_PERIOD_RECORDS = `
  SELECT id, start_date, end_date
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
    await db.runAsync(
      UPSERT_SETTINGS,
      SETTINGS_ROW_ID,
      profile.settings.averageCycleLengthDays,
      profile.settings.averagePeriodLengthDays
    );

    await db.runAsync(DELETE_PERIOD_RECORDS);

    for (const record of profile.periodRecords) {
      await db.runAsync(
        INSERT_PERIOD_RECORD,
        record.id,
        record.startDate,
        record.endDate ?? null
      );
    }
  });
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

    return row.end_date === null || row.end_date === undefined
      ? { id: row.id, startDate }
      : { id: row.id, startDate, endDate: toISODate(row.end_date) };
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
