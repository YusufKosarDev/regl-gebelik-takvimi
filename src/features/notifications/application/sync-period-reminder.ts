import { currentLanguage } from '@/i18n';
import type { SQLiteDatabase } from 'expo-sqlite';

import {
  loadDiscreetNotifications,
  loadNotificationPreferences,
} from '../data/notification-preferences-repository';
import { periodReminderDate } from '../domain/period-reminder';
import { getNotificationPermissionStatus } from '../infrastructure/notification-permission';
import {
  cancelPeriodReminders,
  schedulePeriodReminder,
} from '../infrastructure/period-reminder-scheduler';

import { buildCycleOutlook } from '@/features/cycle/application/build-cycle-outlook';
import { buildCycleDashboard } from '@/features/cycle/application/get-cycle-dashboard';
import { loadCycleProfile } from '@/features/cycle/data/cycle-repository';
import type { ISODate } from '@/types/iso-date';
import { logEvent } from '@/shared/logging';

/**
 * What the queue holds afterwards.
 *
 * `scheduled` is the date a reminder now sits on, or `null` when there is none —
 * which covers the reminder being off, there being no prediction to be early
 * about, and the moment having already passed.
 */
export type PeriodReminderSyncResult = {
  readonly scheduled: ISODate | null;
  readonly cancelled: number;
};

/**
 * Brings the queued period reminder in line with the database.
 *
 * Rebuilt rather than patched: everything of this type is cancelled and at most
 * one is scheduled again. A queue is not something this app owns — the system
 * can empty it, a restore can refill it, and another build may have left
 * something behind — so the only reliable way to end up with exactly one is to
 * stop counting on what was there before.
 *
 * Only this app's period reminders are touched. They are found by the type in
 * their payload, so a pregnancy reminder or anything else scheduled later is
 * neither cancelled nor counted.
 *
 * Nothing is recalculated: the predicted start comes back from
 * `getCycleDashboard`, which is the one place that decides it, so a reminder and
 * the screen cannot end up disagreeing about when a period is expected.
 *
 * Permission is checked as well as the preference. A preference can only be
 * turned on with permission, but permission can be taken away afterwards in
 * system settings, and scheduling into a queue the system will not deliver from
 * would leave someone waiting for a reminder that cannot arrive.
 */
export async function syncPeriodReminder(
  db: SQLiteDatabase,
  today: ISODate
): Promise<PeriodReminderSyncResult> {
  const preferences = await loadNotificationPreferences(db);

  if (!preferences.periodReminderEnabled) {
    return { scheduled: null, cancelled: await cancelPeriodReminders() };
  }

  if ((await getNotificationPermissionStatus()) !== 'granted') {
    return { scheduled: null, cancelled: await cancelPeriodReminders() };
  }

  // ## A silenced channel is deliberately not treated like this, and the
  // ## difference is worth keeping
  //
  // Somebody can switch off "Regl hatırlatıcıları" in Android's own settings
  // while leaving notifications on for the app. `areNotificationsEnabled()`
  // stays true, so the check above reads 'granted' and this function queues a
  // reminder Android will discard. The screen says so - see
  // `infrastructure/blocked-reminder-channels.ts` - and nothing here changes.
  //
  // Cancelling would look consistent with the branch above and would make
  // things worse. This is a one-shot trigger on a date: left in the queue it
  // fires correctly if the person unsilences the channel before that day, with
  // the app never opened. Cancelled, nothing arrives even after they fix it,
  // because nothing re-queues it until the app is next opened - and for the
  // period reminder that is a date that has by then gone past.
  //
  // The branch above can afford to cancel because the preference rebuilds the
  // queue on the next sync whatever happens. A date that has been and gone
  // cannot be rebuilt. So the apparent inconsistency is the point: do not tidy
  // it away.

  // One read for both answers. `getCycleDashboard` would load the profile too
  // and then throw it away, and the outlook needs it - two reads of the same
  // rows could also land either side of a write.
  const profile = await loadCycleProfile(db);
  const dashboard = profile === null ? null : buildCycleDashboard(profile, today);

  // A prediction counted forward from a record older than the longest possible
  // cycle is not a prediction, and this says so where the decision is made.
  //
  // ## It is not what prevents the reminder, and it used to claim it was
  //
  // This comment said that without the gate somebody who stopped logging would
  // get a reminder queued for a date in the past. They would not.
  // `STALE_PREDICTION_DAYS` is `MAX_CYCLE_LENGTH_DAYS`, and
  // `averageCycleLengthDays` is validated into [15, 90] - so a record old
  // enough to be stale predicts a day that has already gone, and
  // `schedulePeriodReminder` refuses a moment in the past. There is no profile
  // for which this gate is the thing that stops anything: it changes the route,
  // never the outcome.
  //
  // The test beside it believed the claim because it replaced the scheduler
  // with a mock, which reported a reminder scheduled for February on a `today`
  // in April. `sync-period-reminder-staleness.test.ts` now runs the real one
  // and pins the refusal where it lives.
  //
  // ## So why keep it
  //
  // Because the reason is worth stating at the point the decision is taken,
  // rather than leaving the next person to derive it from two constants and a
  // validator. The home screen already withholds a stale date; a notification
  // built from one would be the app contradicting itself somewhere the person
  // cannot see the reasoning, and that is a rule about predictions, not an
  // accident of how far in the past the arithmetic happens to land. It also
  // skips a read of the discreet setting there is no point making.
  //
  // If the bounds ever change - a longer cycle than the staleness window -
  // this stops being redundant and starts being the only thing standing there.
  const isStale =
    profile !== null && buildCycleOutlook(profile, today).predictionConfidence === 'stale';

  const reminderDate = isStale
    ? null
    : periodReminderDate(dashboard?.nextPeriodStart ?? null);

  if (reminderDate === null) {
    return { scheduled: null, cancelled: await cancelPeriodReminders() };
  }

  // The wording travels with the schedule. A queued notification carries the
  // words it was created with, so this call is the only moment the discreet
  // setting can reach the reminder that will actually arrive.
  //
  // Read here rather than beside the preferences above, because it is not one
  // of them: it is this device's answer and cloud sync does not carry it.
  //
  // ## Read before the cancel, which is the whole reason this sits here
  //
  // Between cancelling and scheduling, the queue holds nothing. If this
  // process dies in that gap - swiped away, or killed by the system - the
  // reminder is gone until the app is next opened, and for somebody who logs a
  // period and then closes the app for a month that is the reminder they
  // needed. This read used to be inside that gap, so the gap contained a
  // SQLite round trip as well as a bridge call. Moving it out is the widest
  // part of the window removed at no cost.
  //
  // The gap is narrower, not closed. #38 stays open as that residual: a kill
  // between the cancel below and the schedule after it still loses the
  // reminder, and the recovery is the next app open.
  //
  // The order of the two calls after this is deliberate and documented at the
  // top of this file. Scheduling first and then cancelling the others would
  // close the gap and open a worse one: a cancel that failed would leave a
  // second reminder queued for a date the prediction has since moved off,
  // which is the app stating something it no longer believes. A reminder that
  // does not arrive is a silence; one that arrives on the wrong day is a
  // claim. Do not swap them.
  const discreet = await loadDiscreetNotifications(db);

  const cancelled = await cancelPeriodReminders();

  // `null` back means the moment has already gone. Nothing is scheduled and no
  // hour is invented to replace it; the next cycle change looks again.
  // Resolved here rather than passed in from a screen. Two of the callers are
  // not screens - the automatic sync scheduler and the background flush - and a
  // notification is queued with whatever the language is at that moment, which
  // is exactly what this reads.
  const identifier = await schedulePeriodReminder(reminderDate, discreet, currentLanguage());

  return { scheduled: identifier === null ? null : reminderDate, cancelled };
}

/**
 * The same sync, for callers whose own work must not fail because of it.
 *
 * Every screen that changes something the reminder is derived from calls this
 * after its write has already succeeded. The write is what the person asked for
 * and it is already durable; refusing it because a notification could not be
 * queued would throw away real data over a reminder about it.
 */
export async function syncPeriodReminderQuietly(
  db: SQLiteDatabase,
  today: ISODate
): Promise<PeriodReminderSyncResult | null> {
  try {
    return await syncPeriodReminder(db, today);
  } catch (error) {
    logEvent('notification sync failed', error);

    return null;
  }
}
