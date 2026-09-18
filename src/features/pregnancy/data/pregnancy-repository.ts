import type { SQLiteDatabase } from 'expo-sqlite';

import type { PregnancyDueDateSource, PregnancyProfile } from '../domain/types';
import { validatePregnancyProfile } from '../domain/validation';

import { toISODate } from '@/utils/date';

/**
 * Persistence for `PregnancyProfile`.
 *
 * The only pregnancy layer that knows SQL. It speaks domain types on both sides
 * and never lets a row shape escape upwards.
 *
 * Every value crossing into SQL goes through parameter binding; no domain value
 * is ever interpolated into a statement string.
 */

/** `pregnancy_profile` holds a single row, pinned by a CHECK constraint. */
const PROFILE_ROW_ID = 1;

type ProfileRow = {
  readonly last_menstrual_period_start_date: unknown;
  readonly estimated_due_date: unknown;
  readonly due_date_source: unknown;
};

const UPSERT_PROFILE = `
  INSERT INTO pregnancy_profile (
    id,
    last_menstrual_period_start_date,
    estimated_due_date,
    due_date_source
  )
  VALUES (?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    last_menstrual_period_start_date = excluded.last_menstrual_period_start_date,
    estimated_due_date = excluded.estimated_due_date,
    due_date_source = excluded.due_date_source
`;

const DELETE_PROFILE = 'DELETE FROM pregnancy_profile WHERE id = ?';

const SELECT_PROFILE = `
  SELECT last_menstrual_period_start_date, estimated_due_date, due_date_source
  FROM pregnancy_profile
  WHERE id = ?
`;

/**
 * The column stores text, and only two values mean anything to the domain.
 *
 * The database has a CHECK for the same thing, but a row can predate a
 * constraint or arrive from a restored file, so the value is checked again on
 * the way out rather than cast.
 */
function toDueDateSource(value: unknown): PregnancyDueDateSource {
  if (value === 'lmp' || value === 'adjusted') {
    return value;
  }

  throw new Error(
    `Stored pregnancy profile has an invalid due_date_source: ${JSON.stringify(value)}. ` +
      'Expected "lmp" or "adjusted".'
  );
}

/** The column stores text; anything else means the row is not what it claims. */
function toStoredDate(column: string, value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error(
      `Stored pregnancy profile has a non-text ${column}: ${JSON.stringify(value)}.`
    );
  }

  return value;
}

/**
 * Writes the pregnancy.
 *
 * Validated before anything is bound, so a profile the domain would refuse never
 * reaches the database — including one whose due date does not match the source
 * it claims.
 *
 * A single upsert on the pinned row: there is one pregnancy, so saving replaces
 * it rather than adding to a list.
 */
export async function savePregnancyProfile(
  db: SQLiteDatabase,
  profile: PregnancyProfile
): Promise<void> {
  validatePregnancyProfile(profile);

  await db.runAsync(
    UPSERT_PROFILE,
    PROFILE_ROW_ID,
    profile.lastMenstrualPeriodStartDate,
    profile.estimatedDueDate,
    profile.dueDateSource
  );
}

/**
 * Reads the stored pregnancy, or `null` when none has been saved.
 *
 * Stored dates are re-checked with `toISODate` and the assembled profile is run
 * through `validatePregnancyProfile`. A corrupt row raises rather than being
 * repaired or skipped: silently "fixing" health data would hide the corruption
 * and hand the user a wrong due date.
 */
export async function loadPregnancyProfile(
  db: SQLiteDatabase
): Promise<PregnancyProfile | null> {
  const row = await db.getFirstAsync<ProfileRow>(SELECT_PROFILE, PROFILE_ROW_ID);

  if (!row) {
    return null;
  }

  const profile: PregnancyProfile = {
    lastMenstrualPeriodStartDate: toISODate(
      toStoredDate('last_menstrual_period_start_date', row.last_menstrual_period_start_date)
    ),
    estimatedDueDate: toISODate(toStoredDate('estimated_due_date', row.estimated_due_date)),
    dueDateSource: toDueDateSource(row.due_date_source),
  };

  validatePregnancyProfile(profile);

  return profile;
}

/**
 * Removes the tracked pregnancy.
 *
 * One statement against the pinned row, so nothing else in the database is
 * touched — the cycle tables are a separate record of a separate thing and are
 * not this function's to clear.
 *
 * Deleting a row that is not there is not an error here: the caller decides
 * whether there had to be one, and says so before asking.
 */
export async function clearPregnancyProfile(db: SQLiteDatabase): Promise<void> {
  await db.runAsync(DELETE_PROFILE, PROFILE_ROW_ID);
}
