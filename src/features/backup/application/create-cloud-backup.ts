import type { SQLiteDatabase } from 'expo-sqlite';

import type { AuthUser } from '@/features/auth/domain/auth-user';
import { isAccountDeletionPending } from '@/features/deletion/infrastructure/pending-account-deletion';
import { buildCloudSyncPayloadV1 } from '@/features/privacy/application/build-cloud-sync-payload-v1';

import { saveCloudBackup } from '../data/cloud-backup-repository';

/**
 * "Yedek oluştur", with the one thing the repository must not decide.
 *
 * The repository writes; whether a write is allowed to happen at all is a rule,
 * and rules do not live in `data/`. There is exactly one such rule here and it
 * exists because of account deletion: between the moment the cloud backup is
 * deleted and the moment the account is, the session is still perfectly valid,
 * and a backup created in that window would survive the deletion that was
 * already under way.
 *
 * Refusing is a `false` rather than a throw. Nothing failed — the app declined
 * to do something that would have undone what somebody asked for — and a screen
 * that treated that as an error would say "yedek oluşturulamadı" about a
 * decision rather than a fault.
 */

export type CreateCloudBackupInput = {
  readonly db: SQLiteDatabase;
  readonly user: AuthUser;
};

export type CreateCloudBackupOutcome =
  | { readonly kind: 'saved' }
  /** A deletion of this account is part-way through; nothing was written. */
  | { readonly kind: 'refused-deletion-pending' };

export async function createCloudBackup(
  input: CreateCloudBackupInput
): Promise<CreateCloudBackupOutcome> {
  const { db, user } = input;

  if (await isAccountDeletionPending(user.uid)) {
    return { kind: 'refused-deletion-pending' };
  }

  await saveCloudBackup(user, await buildCloudSyncPayloadV1(db));

  return { kind: 'saved' };
}
