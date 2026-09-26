import type { SQLiteDatabase } from 'expo-sqlite';
import { describeValue } from '@/shared/logging';

/**
 * Schema versioning.
 *
 * The version lives in SQLite's own `user_version` pragma rather than a table of
 * our own, so there is nothing to bootstrap: a brand new database reports 0.
 */

export const LATEST_SCHEMA_VERSION = 8;

type UserVersionRow = {
  readonly user_version: number;
};

/**
 * Schema for version 1: the two tables behind `CycleProfile`.
 *
 * Constraints mirror the domain rules so a corrupt write is rejected by the
 * database as well as by validation. Date *format* is not checked here — that
 * stays in the domain layer, which owns the `YYYY-MM-DD` contract.
 */
const MIGRATION_V1 = `
  CREATE TABLE cycle_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    average_cycle_length_days INTEGER NOT NULL
      CHECK (average_cycle_length_days BETWEEN 15 AND 90),
    average_period_length_days INTEGER NOT NULL
      CHECK (average_period_length_days BETWEEN 1 AND 20),
    CHECK (average_period_length_days <= average_cycle_length_days)
  );

  CREATE TABLE period_records (
    id TEXT PRIMARY KEY NOT NULL,
    start_date TEXT NOT NULL UNIQUE CHECK (length(start_date) > 0),
    end_date TEXT NULL CHECK (end_date IS NULL OR length(end_date) > 0)
  );
`;

/**
 * Creates the version 1 schema.
 *
 * The DDL and the version bump share one transaction, so a failure part-way
 * leaves the database untouched and still reporting its old version rather than
 * a half-built schema that claims to be current.
 */
async function migrateToVersion1(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync(MIGRATION_V1);
    await db.execAsync('PRAGMA user_version = 1');
  });
}

/**
 * Schema for version 2: says outright whether a period is still running.
 *
 * A missing `end_date` alone could not tell "still bleeding" from "history, end
 * never recorded", so the column carries that instead of it being guessed.
 *
 * Existing rows default to 0. This is a pre-release app, and reading an old
 * development row as ongoing would be a guess about someone's body rather than a
 * fact, so the safe reading wins.
 */
const MIGRATION_V2 = `
  ALTER TABLE period_records
  ADD COLUMN is_ongoing INTEGER NOT NULL DEFAULT 0 CHECK (is_ongoing IN (0, 1));
`;

/**
 * Adds the ongoing flag.
 *
 * Same bargain as version 1: the column and the version bump share one
 * transaction, so a failure leaves the database still reporting version 1 rather
 * than claiming a column it does not have.
 */
async function migrateToVersion2(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync(MIGRATION_V2);
    await db.execAsync('PRAGMA user_version = 2');
  });
}

/**
 * Schema for version 3: the pregnancy being tracked.
 *
 * One row, pinned the same way `cycle_settings` is: a person tracks one
 * pregnancy at a time, and a table that could hold two would need a rule for
 * choosing between them.
 *
 * `due_date_source` is constrained to the two values the domain knows, so a
 * write that would leave the row unreadable is refused by the database as well
 * as by validation. Date *format* is not checked here — that stays in the domain
 * layer, which owns the `YYYY-MM-DD` contract.
 */
const MIGRATION_V3 = `
  CREATE TABLE pregnancy_profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    last_menstrual_period_start_date TEXT NOT NULL
      CHECK (length(last_menstrual_period_start_date) > 0),
    estimated_due_date TEXT NOT NULL CHECK (length(estimated_due_date) > 0),
    due_date_source TEXT NOT NULL CHECK (due_date_source IN ('lmp', 'adjusted'))
  );
`;

/**
 * Adds the pregnancy table.
 *
 * Nothing is backfilled: an existing database has no pregnancy to record, and
 * inventing one from the cycle records would be a guess about someone's body.
 * The table simply starts empty, which reads as "not tracking a pregnancy".
 *
 * Same bargain as the earlier steps: the DDL and the version bump share one
 * transaction, so a failure leaves the database still reporting version 2 rather
 * than claiming a table it does not have.
 */
async function migrateToVersion3(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync(MIGRATION_V3);
    await db.execAsync('PRAGMA user_version = 3');
  });
}

/**
 * Schema for version 4: the avatar a person built.
 *
 * One row, pinned like `cycle_settings` and `pregnancy_profile`: a person has
 * one avatar, and a table that could hold two would need a rule for choosing
 * between them.
 *
 * The ids are stored as opaque text and checked only for being non-blank, using
 * `trim` so the database refuses what the domain refuses — an id of spaces names
 * nothing. No CHECK lists the catalogue values: a constraint that knew them would
 * have to be migrated every time a hair style is added, and it would lock a saved
 * avatar out of the app the moment an option is dropped.
 *
 * `accessory_id` is the one nullable column, because wearing no accessory is a
 * choice rather than missing data. NULL is that choice; a blank string is not,
 * and is refused.
 */
const MIGRATION_V4 = `
  CREATE TABLE avatar_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    skin_tone_id TEXT NOT NULL CHECK (length(trim(skin_tone_id)) > 0),
    hair_style_id TEXT NOT NULL CHECK (length(trim(hair_style_id)) > 0),
    hair_color_id TEXT NOT NULL CHECK (length(trim(hair_color_id)) > 0),
    outfit_id TEXT NOT NULL CHECK (length(trim(outfit_id)) > 0),
    accessory_id TEXT NULL CHECK (accessory_id IS NULL OR length(trim(accessory_id)) > 0)
  );
`;

/**
 * Adds the avatar table.
 *
 * Nothing is backfilled and no default avatar is written: an existing database
 * has no avatar, and picking one for someone is the choice the feature exists to
 * let them make. The table starts empty, which reads as "no avatar yet".
 *
 * Same bargain as the earlier steps: the DDL and the version bump share one
 * transaction, so a failure leaves the database still reporting version 3 rather
 * than claiming a table it does not have.
 */
async function migrateToVersion4(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync(MIGRATION_V4);
    await db.execAsync('PRAGMA user_version = 4');
  });
}

/**
 * Schema for version 5: which reminders a person has asked for.
 *
 * One row, pinned like the others: these are one person's choices, and a table
 * that could hold two sets would need a rule for picking between them.
 *
 * Each switch is an INTEGER constrained to 0 or 1, because SQLite has no boolean
 * and an unconstrained column would happily store a 2 that nothing above it
 * could read. They default to 0: an app that starts sending notifications
 * because it was installed has decided something that was never its to decide.
 */
const MIGRATION_V5 = `
  CREATE TABLE notification_preferences (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    period_reminder_enabled INTEGER NOT NULL DEFAULT 0
      CHECK (period_reminder_enabled IN (0, 1)),
    pregnancy_weekly_reminder_enabled INTEGER NOT NULL DEFAULT 0
      CHECK (pregnancy_weekly_reminder_enabled IN (0, 1))
  );
`;

/**
 * Adds the reminder table.
 *
 * Nothing is backfilled and no row is written: an absent row and a row of zeroes
 * mean the same thing, and the repository answers both with the defaults. The
 * row appears the first time someone actually chooses something.
 *
 * Same bargain as the earlier steps: the DDL and the version bump share one
 * transaction, so a failure leaves the database still reporting version 4 rather
 * than claiming a table it does not have.
 */
async function migrateToVersion5(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync(MIGRATION_V5);
    await db.execAsync('PRAGMA user_version = 5');
  });
}

/**
 * Schema for version 6: what this device last synced, per account.
 *
 * One row per account rather than one row pinned to 1, which is what every
 * other table here does. Two accounts can be used on one phone, and their sync
 * states have nothing to do with each other: the uid is the key so that reading
 * one can never answer with the other's.
 *
 * `base_payload` is the copy that was last agreed with the account, as the JSON
 * of a `CloudSyncPayloadV1`. It is what makes a three-way merge possible: with
 * it, a device that has been offline can tell what it changed from what the
 * other device changed, and only ask about the parts that truly collide.
 *
 * `content_hash` is that payload's hash, stored rather than recomputed so the
 * question "has this phone changed since?" is one string comparison.
 *
 * No row means no base: an account this device has never synced has nothing to
 * measure against, which is a state the decision engine already knows how to
 * answer for. Nothing is backfilled and no row is written here.
 *
 * Holding a copy of the payload is holding health data — the same health data
 * already in the tables beside it, in the same app-private database, and not a
 * line of it leaves the device by being here.
 */
const MIGRATION_V6 = `
  CREATE TABLE sync_state (
    uid TEXT PRIMARY KEY NOT NULL CHECK (length(uid) > 0),
    revision INTEGER NOT NULL CHECK (revision >= 0),
    content_hash TEXT NOT NULL CHECK (length(content_hash) > 0),
    base_payload TEXT NOT NULL CHECK (length(base_payload) > 0),
    updated_at TEXT NOT NULL CHECK (length(updated_at) > 0)
  );
`;

/**
 * Adds the sync state table.
 *
 * Touches nothing that is already there: the cycle, pregnancy, avatar and
 * reminder tables are not read, rewritten or migrated, so an upgrade cannot
 * cost somebody a period record.
 *
 * Same bargain as every step before it: the DDL and the version bump share one
 * transaction, so a failure leaves the database still reporting version 5
 * rather than claiming a table it does not have.
 */
async function migrateToVersion6(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync(MIGRATION_V6);
    await db.execAsync('PRAGMA user_version = 6');
  });
}

/**
 * Schema for version 7: what a person noticed on a day.
 *
 * Two tables rather than one. `daily_entries` holds the parts there is at
 * most one of — how heavy the bleeding was, how the day felt — and
 * `daily_entry_symptoms` holds the parts there can be several of. A JSON
 * column would have made the second one opaque to every query and to the
 * merge; a bitmask would have made adding a symptom easy and removing one a
 * trap.
 *
 * The date is the key. A day is the unit a person thinks in, and it is also
 * the unit two devices can disagree about, so it is what the merge works on.
 *
 * No CHECK lists the catalogue values, for the same reason the avatar table
 * has none: a constraint that knew them would need a migration every time a
 * symptom is added, and would lock a recorded day out of the app the moment
 * one is dropped. Which ids are meaningful is the catalogue’s business, and
 * the catalogue rule is that entries are hidden rather than removed.
 *
 * Flow is here rather than on `period_records`, and that is a decision rather
 * than a convenience. A period record is a span; how heavy the bleeding was
 * varies day to day inside it, and spotting happens on days that belong to no
 * span at all. Putting flow on the record would have meant either inventing a
 * period to hold a spot or losing it.
 *
 * `ON DELETE CASCADE` with `PRAGMA foreign_keys` left as the connection finds
 * it: the repository deletes the symptoms itself in the same transaction, so
 * the rows go whether or not the pragma is on. The clause states the
 * relationship for anyone reading the schema.
 */
const MIGRATION_V7 = `
  CREATE TABLE daily_entries (
    entry_date TEXT PRIMARY KEY NOT NULL CHECK (length(entry_date) = 10),
    flow_id TEXT NULL CHECK (flow_id IS NULL OR length(trim(flow_id)) > 0),
    mood_id TEXT NULL CHECK (mood_id IS NULL OR length(trim(mood_id)) > 0)
  );

  CREATE TABLE daily_entry_symptoms (
    entry_date TEXT NOT NULL
      REFERENCES daily_entries(entry_date) ON DELETE CASCADE,
    symptom_id TEXT NOT NULL CHECK (length(trim(symptom_id)) > 0),
    PRIMARY KEY (entry_date, symptom_id)
  );
`;

/**
 * Adds the daily log tables.
 *
 * Touches nothing that is already there. No period record is read, rewritten
 * or reinterpreted, and no day is invented from one: a person who has been
 * using the app has recorded periods, not symptoms, and filling the new
 * tables from the old ones would be the app putting words in their mouth.
 *
 * Same bargain as every step before it: the DDL and the version bump share
 * one transaction, so a failure leaves the database still reporting version 6
 * rather than claiming tables it does not have.
 */
async function migrateToVersion7(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync(MIGRATION_V7);
    await db.execAsync('PRAGMA user_version = 7');
  });
}

/**
 * Schema for version 8: how much a reminder is allowed to say.
 *
 * Android prints a notification's title and body on the lock screen and does
 * not let an app opt out, so the only thing left to decide is the wording. This
 * column is that decision.
 *
 * It sits with the reminder switches rather than in a table of its own because
 * it is the same kind of thing — one person's answer about notifications — and
 * a second single-row table would need the same pinned id and the same care for
 * no gain.
 *
 * Defaults to 0, which is the wording the app already had. An upgrade must not
 * quietly change what somebody's existing reminders say; the app lock turns
 * this on when it is set up, and otherwise it is the person's to turn on.
 */
const MIGRATION_V8 = `
  ALTER TABLE notification_preferences
  ADD COLUMN discreet_notifications INTEGER NOT NULL DEFAULT 0
    CHECK (discreet_notifications IN (0, 1));
`;

/**
 * Adds the discreet-wording column.
 *
 * Same bargain as every step before it: the column and the version bump share
 * one transaction, so a failure leaves the database still reporting version 7
 * rather than claiming a column it does not have.
 */
async function migrateToVersion8(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync(MIGRATION_V8);
    await db.execAsync('PRAGMA user_version = 8');
  });
}

/**
 * Brings the database schema up to `LATEST_SCHEMA_VERSION`.
 *
 * Refuses to run against a database written by a newer build: silently
 * continuing there risks reading columns that have changed meaning, so it throws
 * instead.
 */
export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<UserVersionRow>('PRAGMA user_version');
  const currentVersion = row?.user_version;

  if (typeof currentVersion !== 'number' || !Number.isInteger(currentVersion) || currentVersion < 0) {
    throw new Error(
      `Could not read a schema version from PRAGMA user_version (received ${describeValue(
        row?.user_version
      )}).`
    );
  }

  if (currentVersion > LATEST_SCHEMA_VERSION) {
    throw new Error(
      `Database schema version ${currentVersion} is newer than supported version ` +
        `${LATEST_SCHEMA_VERSION}.`
    );
  }

  if (currentVersion === LATEST_SCHEMA_VERSION) {
    return;
  }

  // Each step commits its own version, so an interrupted upgrade resumes from
  // where it stopped rather than replaying a migration that already ran.
  if (currentVersion < 1) {
    await migrateToVersion1(db);
  }

  if (currentVersion < 2) {
    await migrateToVersion2(db);
  }

  if (currentVersion < 3) {
    await migrateToVersion3(db);
  }

  if (currentVersion < 4) {
    await migrateToVersion4(db);
  }

  if (currentVersion < 5) {
    await migrateToVersion5(db);
  }

  if (currentVersion < 6) {
    await migrateToVersion6(db);
  }

  if (currentVersion < 7) {
    await migrateToVersion7(db);
  }

  if (currentVersion < 8) {
    await migrateToVersion8(db);
  }
}
