import type { SQLiteDatabase } from 'expo-sqlite';

import type { SyncState } from '../domain/sync-state';
import { validateSyncState } from '../domain/sync-state';

import {
  parseCloudSyncPayloadV1,
  serializeCloudSyncPayloadV1,
} from '@/features/privacy/domain/cloud-sync-payload-v1';
import { describeValue } from '@/shared/logging';

/**
 * Persistence for `SyncState`.
 *
 * The only sync layer that knows SQL. It speaks domain types on both sides and
 * never lets a row shape escape upwards.
 *
 * Every value crossing into SQL goes through parameter binding; no stored value
 * is ever interpolated into a statement string.
 *
 * The account is always an argument. This module holds no idea of a "current
 * user" and cannot be asked for "the" sync state: every call names the uid it
 * means, so a state belonging to one account cannot be handed out for another
 * by a caller that forgot to check.
 *
 * It persists and nothing else. It does not decide what to sync — that is
 * `decideSync`, which reads no database — and it does not compute the hash it
 * stores. Both would be rules hidden inside storage, where they could not be
 * tested without one.
 */

const UPSERT_SYNC_STATE = `
  INSERT INTO sync_state (uid, revision, content_hash, base_payload, updated_at)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(uid) DO UPDATE SET
    revision = excluded.revision,
    content_hash = excluded.content_hash,
    base_payload = excluded.base_payload,
    updated_at = excluded.updated_at
`;

const SELECT_SYNC_STATE = `
  SELECT uid, revision, content_hash, base_payload, updated_at
  FROM sync_state
  WHERE uid = ?
`;

const DELETE_SYNC_STATE = 'DELETE FROM sync_state WHERE uid = ?';

type SyncStateRow = {
  readonly uid: unknown;
  readonly revision: unknown;
  readonly content_hash: unknown;
  readonly base_payload: unknown;
  readonly updated_at: unknown;
};

/** The column stores text; anything else means the row is not what it claims. */
function toStoredText(column: string, value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error(`Stored sync state has a non-text ${column}: ${describeValue(value)}.`);
  }

  return value;
}

/** The column stores a whole number; a fractional revision means nothing. */
function toStoredRevision(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(
      `Stored sync state has a revision that is not a whole number: ${describeValue(value)}.`
    );
  }

  return value;
}

/**
 * Writes one account's sync state, replacing whatever was there.
 *
 * Validated before anything is bound, so a base the domain would refuse never
 * reaches the database — and the payload is serialised by the same function
 * that writes it to the cloud, which validates it again on the way out.
 *
 * An upsert keyed on the uid: a device syncs one account many times and keeps
 * one base for it, while a second account gets a row of its own.
 *
 * No transaction of its own. It is one statement, so a caller that is writing
 * a base as part of a larger change — a restore, which must either happen
 * wholly or not at all — can put it inside theirs.
 */
export async function saveSyncState(db: SQLiteDatabase, state: SyncState): Promise<void> {
  validateSyncState(state);

  await db.runAsync(
    UPSERT_SYNC_STATE,
    state.uid,
    state.revision,
    state.contentHash,
    serializeCloudSyncPayloadV1(state.basePayload),
    state.updatedAt
  );
}

/**
 * Reads one account's sync state, or `null` when there is none.
 *
 * `null` is the ordinary answer for an account this device has not synced, and
 * it is not an error: it is what "no base" looks like, and the decision engine
 * expects it.
 *
 * A row that is there but unreadable is an error. Quietly treating a corrupt
 * base as "no base" would turn every later difference into a conflict, or worse,
 * let a merge run against a payload that is not what it claims.
 *
 * The uid is bound, never interpolated, and the row that comes back is checked
 * to belong to the account that was asked for.
 */
export async function loadSyncState(
  db: SQLiteDatabase,
  uid: string
): Promise<SyncState | null> {
  const row = await db.getFirstAsync<SyncStateRow>(SELECT_SYNC_STATE, uid);

  if (!row) {
    return null;
  }

  const state: SyncState = {
    uid: toStoredText('uid', row.uid),
    revision: toStoredRevision(row.revision),
    contentHash: toStoredText('content_hash', row.content_hash),
    basePayload: parseCloudSyncPayloadV1(toStoredText('base_payload', row.base_payload)),
    updatedAt: toStoredText('updated_at', row.updated_at),
  };

  // The query asks for one uid, so a row for another one means the query and
  // the answer have come apart. Refusing beats handing one account's history to
  // another.
  if (state.uid !== uid) {
    throw new Error('Stored sync state belongs to a different account than the one asked for.');
  }

  validateSyncState(state);

  return state;
}

/**
 * Removes one account's sync state.
 *
 * One statement against one uid, so signing out of one account leaves another
 * account's base exactly where it was.
 *
 * Deleting a state that is not there is not an error here: the caller decides
 * whether there had to be one.
 */
export async function clearSyncState(db: SQLiteDatabase, uid: string): Promise<void> {
  await db.runAsync(DELETE_SYNC_STATE, uid);
}
