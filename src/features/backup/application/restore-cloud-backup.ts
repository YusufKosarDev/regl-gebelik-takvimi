import type { SQLiteDatabase } from 'expo-sqlite';

import { clearAvatarConfig, saveAvatarConfig } from '@/features/avatar/data/avatar-repository';
import {
  clearCycleSettings,
  replacePeriodRecords,
  writeCycleSettings,
} from '@/features/cycle/data/cycle-repository';
import { saveNotificationPreferences } from '@/features/notifications/data/notification-preferences-repository';
import {
  clearPregnancyProfile,
  savePregnancyProfile,
} from '@/features/pregnancy/data/pregnancy-repository';
import type { CloudSyncPayloadV1 } from '@/features/privacy/domain/cloud-sync-payload-v1';
import { validateCloudSyncPayloadV1 } from '@/features/privacy/domain/cloud-sync-payload-v1';
import { withLocalDataChangeSuppressed } from '@/shared/data-change/local-data-change';

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
 * One transaction. A restore that stopped halfway would leave someone with one
 * person's settings and another moment's history, which is worse than either,
 * and worse than having failed. Every write here is a statement rather than a
 * transaction of its own, so they share this one.
 *
 * Validated before any of it: the whole payload goes through the same validator
 * the app uses everywhere, so a corrupt backup is refused before the first
 * write rather than discovered between two of them.
 *
 * Nothing here syncs the widget or the reminders. Those are the caller's to do
 * afterwards, best effort, because a copy that could not be refreshed is not a
 * reason to put someone's data back the way it was.
 */
export async function restoreCloudBackup(
  db: SQLiteDatabase,
  payload: CloudSyncPayloadV1
): Promise<void> {
  validateCloudSyncPayloadV1(payload);

  // A restore is the *result* of a sync, not somebody editing. Announcing it
  // would schedule a sync of what was just received.
  await withLocalDataChangeSuppressed(async () => {
    await db.withTransactionAsync(async () => {
      if (payload.cycleSettings === null) {
        await clearCycleSettings(db);
      } else {
        await writeCycleSettings(db, payload.cycleSettings);
      }

      await replacePeriodRecords(db, payload.periodRecords);

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

      // Always present: "nothing chosen" is the defaults rather than an absence,
      // so there is nothing to clear and always something to write.
      await saveNotificationPreferences(db, payload.notificationPreferences);
    });
  });
}
