import type { SQLiteDatabase } from 'expo-sqlite';

import { clearAvatarConfig, saveAvatarConfig } from '@/features/avatar/data/avatar-repository';
import {
  clearCycleSettings,
  replacePeriodRecords,
  writeCycleSettings,
} from '@/features/cycle/data/cycle-repository';
import { replaceDailyEntries } from '@/features/daily-log/data/daily-log-repository';
import { saveNotificationPreferences } from '@/features/notifications/data/notification-preferences-repository';
import {
  clearPregnancyProfile,
  savePregnancyProfile,
} from '@/features/pregnancy/data/pregnancy-repository';
import type { CloudSyncPayloadV1 } from '@/features/privacy/domain/cloud-sync-payload-v1';
import { validateCloudSyncPayloadV1 } from '@/features/privacy/domain/cloud-sync-payload-v1';
import {
  notifyLocalDataChanged,
  withLocalDataChangeSuppressed,
} from '@/shared/data-change/local-data-change';
import { withLocalDbWriteLock } from '@/storage/local-db-write-lock';

/**
 * Writes a backup over what is on the phone.
 *
 * Everything the payload holds replaces its local counterpart, and a field the
 * payload does not hold clears it: a backup taken when there was no pregnancy
 * restores to no pregnancy, because otherwise restoring would be a merge that
 * nobody asked for and that no screen described.
 *
 * The period history is replaced exactly. Records only the phone has are gone
 * afterwards — which is what the preview says will happen, in the count it
 * shows next to "silinecek".
 *
 * One transaction, and one turn of the write queue. A restore that stopped
 * halfway would leave someone with one person's settings and another moment's
 * history, which is worse than either, and worse than having failed. Every
 * write here is a statement rather than a transaction of its own, so they share
 * this one — and the lock is what stops a write from somewhere else sharing it
 * too, which a bare transaction on this app's single connection does not.
 *
 * Validated before any of it: the whole payload goes through the same validator
 * the app uses everywhere, so a corrupt backup is refused before the first
 * write rather than discovered between two of them.
 *
 * Nothing here syncs the widget or the reminders. Those are the caller's to do
 * afterwards, best effort, because a copy that could not be refreshed is not a
 * reason to put someone's data back the way it was.
 */
/**
 * The restore's precondition said no, so nothing was written.
 *
 * Its own class because the caller's answer is different in kind: a failed
 * write is a fault to report, a failed precondition is a fact to act on — the
 * phone is no longer what the caller's decision was made from, and the right
 * move is to look again.
 */
export class RestorePreconditionError extends Error {
  constructor() {
    super('The restore was refused by its precondition.');

    this.name = 'RestorePreconditionError';
  }
}

export type RestoreCloudBackupOptions = {
  /**
   * A last look before the first write, asked inside the restore's own
   * transaction. `false` rolls the (empty) transaction back and throws
   * `RestorePreconditionError`.
   *
   * It exists for the sync orchestrator, whose pull/merge decision was made
   * from a snapshot taken before its network reads: a record saved in that
   * window must refuse this write rather than be erased by it.
   */
  readonly precondition?: () => Promise<boolean>;
};

export async function restoreCloudBackup(
  db: SQLiteDatabase,
  payload: CloudSyncPayloadV1,
  options?: RestoreCloudBackupOptions
): Promise<void> {
  // Outside the lock: it is pure, and a payload the domain refuses should not
  // cost anybody else their turn in the queue.
  validateCloudSyncPayloadV1(payload);

  // ## The lock is outermost, and the order is the point
  //
  // One connection means one transaction state, and `withTransactionAsync` is
  // a bare `BEGIN`/`COMMIT` that the library documents as interruptible. A
  // write that landed between two statements below used to issue its own
  // `BEGIN` into this open transaction, fail, and `ROLLBACK` *this* work on
  // its way out — leaving half a payload on disk under a restore that reported
  // failure. See `storage/local-db-write-lock.ts`.
  //
  // The suppression goes *inside* it, never outside. It is a global counter,
  // not an async-scoped one, so a wider suppression swallows the announcement
  // of any other write that finishes during it: that write lands, nothing
  // hears about it, and it is never synced. Contained in an exclusive span it
  // can only ever suppress the writes below.
  //
  // It also makes `options.precondition` sound for the first time. It is the
  // first statement of the span now, so nothing can slip between the check and
  // the writes it is there to guard.
  await withLocalDbWriteLock(() =>
    // Every repository below would announce a `local` change of its own: a
    // dozen announcements for one event, each of them wrong about where the
    // data came from, and each one scheduling a sync of what was just
    // received. They are suppressed, and one `remote` announcement is made
    // afterwards instead.
    withLocalDataChangeSuppressed(async () => {
      await db.withTransactionAsync(async () => {
        if (options?.precondition && !(await options.precondition())) {
          throw new RestorePreconditionError();
        }

        if (payload.cycleSettings === null) {
          await clearCycleSettings(db);
        } else {
          await writeCycleSettings(db, payload.cycleSettings);
        }

        await replacePeriodRecords(db, payload.periodRecords);
        // Absent in a backup written before the field existed. That is an
        // older backup, not an instruction to delete every recorded day, so it
        // reads as an empty list.
        await replaceDailyEntries(db, payload.dailyEntries ?? []);

        if (payload.pregnancyProfile === null) {
          await clearPregnancyProfile(db);
        } else {
          await savePregnancyProfile(db, payload.pregnancyProfile);
        }

        if (payload.avatarConfig === null) {
          await clearAvatarConfig(db);
        } else {
          await saveAvatarConfig(db, payload.avatarConfig);
        }

        // Always present: "nothing chosen" is the defaults rather than an
        // absence, so there is nothing to clear and always something to write.
        await saveNotificationPreferences(db, payload.notificationPreferences);
      });
    })
  );

  // After the transaction *and* after the lock is released, so a screen that
  // re-reads on hearing this sees the whole restore rather than part of it, and
  // so no listener's work runs while the queue is still held. `remote`, because
  // whoever is holding the phone did not do this — which is exactly why the
  // screens need telling.
  notifyLocalDataChanged('remote');
}
