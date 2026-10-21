import type { SQLiteDatabase } from 'expo-sqlite';

import {
  loadNotificationPreferences,
  saveNotificationPreferences,
} from '../data/notification-preferences-repository';
import type { NotificationPreferences } from '../domain/notification-preferences';
import { withReminder } from '../domain/notification-preferences';
import type { NotificationPermissionStatus } from '../infrastructure/notification-permission';
import { ensureNotificationPermission } from '../infrastructure/notification-permission';

import { withLocalDbWriteLock } from '@/storage/local-db-write-lock';

/**
 * What happened when a reminder was switched.
 *
 * `preferences` is what is now stored, which is not always what was asked for:
 * turning one on without permission leaves it off. `permission` says why, so
 * the screen can explain rather than just springing back.
 */
export type SetReminderResult = {
  readonly preferences: NotificationPreferences;
  readonly permission: NotificationPermissionStatus | null;
};

/**
 * Turns one reminder on or off.
 *
 * Switching on asks for permission first, and a refusal stops there: nothing is
 * written, and the switch stays off. A preference that says "yes" while the
 * system says "no" is a promise the app cannot keep, and someone would be left
 * waiting for a reminder that can never arrive.
 *
 * Switching off asks for nothing. There is nothing to permit, and a dialog on
 * the way out would be the app negotiating over being told to stop.
 *
 * The current preferences are read rather than passed in, so two switches
 * changed in quick succession cannot overwrite each other with a stale copy.
 *
 * ## The read and the write share one turn of the write queue, and the dialog
 * ## sits outside it
 *
 * The sentence above used to be false on the way *on*. The read happened, then
 * a system permission dialog opened, and only then did the write — so the copy
 * this wrote back was as old as however long somebody left that dialog sitting
 * there, and the other switch changed in the meantime was overwritten. That is
 * the same lost update `storage/local-db-write-lock.ts` exists for.
 *
 * It cannot be fixed by putting the whole function in the lock: a dialog nobody
 * answers would hold every other write in the app behind it for as long as it
 * stayed open. So the permission is resolved first, with nothing held, and the
 * read and the write are locked together afterwards.
 *
 * One consequence worth stating, because it is a behaviour change: on a refusal
 * the preferences come back as they are *after* the dialog rather than before
 * it. That is the more truthful answer — it is what is stored when the screen
 * is told — and the refusal still writes nothing.
 *
 * Nothing is scheduled here. This is the record of what someone wants; acting
 * on it comes later.
 */
export async function setReminderEnabled(
  db: SQLiteDatabase,
  field: keyof NotificationPreferences,
  enabled: boolean
): Promise<SetReminderResult> {
  if (!enabled) {
    // Nothing to permit on the way out, so read and write are one turn.
    return withLocalDbWriteLock(async () => {
      const next = withReminder(await loadNotificationPreferences(db), field, false);

      await saveNotificationPreferences(db, next);

      return { preferences: next, permission: null };
    });
  }

  // Outside the lock on purpose. This can open a dialog, and a dialog can stay
  // open for as long as somebody leaves it open.
  const permission = await ensureNotificationPermission();

  if (permission !== 'granted') {
    // Deliberately no write: the stored answer stays whatever it was, which for
    // a switch being turned on is off. No lock either — nothing is written, and
    // this read is only for what the screen shows.
    return { preferences: await loadNotificationPreferences(db), permission };
  }

  return withLocalDbWriteLock(async () => {
    const next = withReminder(await loadNotificationPreferences(db), field, true);

    await saveNotificationPreferences(db, next);

    return { preferences: next, permission };
  });
}
