import type { SQLiteDatabase } from 'expo-sqlite';

import {
  loadDiscreetNotifications,
  saveDiscreetNotifications,
} from '../data/notification-preferences-repository';

import { syncPeriodReminderQuietly } from './sync-period-reminder';
import { syncPregnancyWeeklyReminderQuietly } from './sync-pregnancy-weekly-reminder';

import { withLocalDbWriteLock } from '@/storage/local-db-write-lock';
import type { ISODate } from '@/types/iso-date';

/**
 * Turns the discreet wording on or off, and rebuilds what is already queued.
 *
 * ## Why this one schedules, when `setReminderEnabled` deliberately does not
 *
 * Switching a reminder on or off is a record of what somebody wants, and acting
 * on it can wait: the queue is rebuilt from the preference on the next sync, and
 * the worst case in the meantime is a reminder that arrives when it need not
 * have.
 *
 * This switch is not like that. A queued notification carries the words it was
 * scheduled with, so somebody who turns this on and closes the app still has
 * "Tahminine göre regl dönemin yaklaşıyor" sitting in the system queue, waiting
 * to print itself on their lock screen. The stored answer is not the
 * protection — the rebuilt queue is. Leaving that to a later caller would mean
 * the setting appeared to work and did nothing until something unrelated
 * happened to trigger a sync.
 *
 * Both reminders are rebuilt, not just the one the person is thinking about.
 * There is one switch and it governs both, and a version that only reached the
 * period reminder would be a setting that is true on the screen and false on the
 * phone.
 *
 * Rebuilt quietly: the answer is written and durable by then, and failing the
 * whole call because a queue could not be rewritten would throw away what the
 * person said over the thing it exists to fix. A failed rebuild leaves the old
 * wording queued — the state they were already in — and the next sync tries
 * again.
 *
 * Asks for no permission. This changes what a notification says, not whether one
 * is sent, and a system dialog here would be the app bargaining over being told
 * to say less.
 *
 * ## Only the write takes a turn of the write queue
 *
 * The two rebuilds below reach the notification queue over the bridge and take
 * as long as that takes. Holding `withLocalDbWriteLock` across them would put
 * every other write in the app behind a pair of native calls that have nothing
 * to do with the database — so the span is the one statement that touches it.
 * The read afterwards needs no turn: it is what the screen shows, and a stale
 * answer there is a repaint, not a lost write.
 */
export async function setDiscreetNotifications(
  db: SQLiteDatabase,
  enabled: boolean,
  today: ISODate
): Promise<boolean> {
  await withLocalDbWriteLock(() => saveDiscreetNotifications(db, enabled));

  await syncPeriodReminderQuietly(db, today);
  await syncPregnancyWeeklyReminderQuietly(db);

  return loadDiscreetNotifications(db);
}
