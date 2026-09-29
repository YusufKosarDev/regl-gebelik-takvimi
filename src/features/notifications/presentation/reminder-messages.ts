import type { Messages } from '@/i18n';

/**
 * What the settings screen says about reminders, and what a reminder says.
 *
 * Kept apart from the screen for the same reason every other feature's copy is:
 * these are the sentences somebody reads when a reminder did not arrive, and
 * they should be findable without reading a component.
 *
 * Two different situations, two different sentences. Being asked and saying no
 * is not the same as never having been asked, and the app must not imply the
 * person did something they did not.
 *
 * ## The reminder bodies are the most careful strings in this file
 *
 * They are delivered to a lock screen, where somebody else may be looking. The
 * English halves keep every hedge the Turkish ones have - "yaklaşıyor" and
 * "tahminine göre" become "expected" and "based on your average", not "starts
 * tomorrow" - because the app is working from an average and does not know when
 * anybody's period will begin.
 */

const reminderMessagesTr = {
  /** The section's standing explanation, shown whatever the permission is. */
  remindersIntro:
    'Hatırlatıcılar kapalı gelir. Açtığın anda telefonun bildirim izni isteyebilir.',

  /**
   * Shown right after a switch failed to turn on because the system refused.
   *
   * Transient, tied to the press. The standing notice below is what remains.
   */
  permissionRefusedMessage:
    'Bildirim izni verilmedi. Hatırlatıcıyı açmak için bildirim izni gerekiyor.',

  /**
   * Shown for as long as notifications are off for this app.
   *
   * It says what the consequence is rather than what the setting is called:
   * "izin kapalı" is a fact about a toggle somewhere, and "hatırlatıcılar sana
   * ulaşamaz" is what that fact means for the person reading it.
   */
  notificationsBlockedNotice:
    'Bu uygulamanın bildirimleri kapalı. Hatırlatıcıları açsan bile sana ulaşamaz. ' +
    'Telefon ayarlarından bildirimlere izin verdikten sonra tekrar dene.',

  /** The way out of it, and the only one Android leaves once it has been refused. */
  openSystemSettingsLabel: 'Bildirim ayarlarını aç',

  /** When the system settings screen refuses to open, which is rare and not fatal. */
  openSystemSettingsFailedMessage:
    'Telefon ayarları açılamadı. Ayarlar > Uygulamalar > Regl & Gebelik Takvimi > ' +
    'Bildirimler yolunu elle açabilirsin.',

  reminderSaveFailedMessage: 'Hatırlatıcı ayarı kaydedilemedi.',

  /* ---------------------------------------- what a reminder says -- */

  /**
   * The Android channel the period reminders are delivered on.
   *
   * The name and the description are what somebody reads in the system's own
   * notification settings, where this app's words sit beside every other app's.
   * The description says what arrives and when, because that screen is where a
   * person decides whether to keep it — and "Regl hatırlatıcıları" alone does
   * not tell them whether it is one a month or one a day.
   */
  periodReminderChannelName: 'Regl hatırlatıcıları',
  periodReminderChannelDescription:
    'Tahmini regl tarihinden bir gün önce, sabah saatlerinde tek bir hatırlatma.',

  /**
   * What it says.
   *
   * "Yaklaşıyor" and "tahminine göre": the app is working from an average, and
   * it does not know when anyone's period will start. A notification saying it
   * begins today would be stating something the prediction cannot support, on a
   * day someone may well be somewhere they would rather not be surprised.
   */
  periodReminderTitle: 'Regl hatırlatıcısı',
  periodReminderBody: 'Tahminine göre regl dönemin yaklaşıyor.',

  /**
   * The Android channel the weekly pregnancy notes are delivered on.
   *
   * Separate so that switching one off in system settings leaves the other
   * alone: somebody tracking a pregnancy may well want the weekly note and
   * nothing else.
   */
  pregnancyWeeklyReminderChannelName: 'Gebelik hatırlatıcıları',
  pregnancyWeeklyReminderChannelDescription:
    'Gebelik takibi açıkken her pazartesi sabah saatlerinde haftalık bilgilendirme.',

  /**
   * What it says.
   *
   * An invitation rather than a claim. "Göz atabilirsin" — you can have a look —
   * because the app does not know how this week is going for anyone, and a
   * notification is the wrong place to say anything about a pregnancy that would
   * matter if it were wrong.
   */
  pregnancyWeeklyReminderTitle: 'Gebelik takibi',
  pregnancyWeeklyReminderBody: 'Bu haftaki gebelik gelişim bilgilerine göz atabilirsin.',

  /* ----------------------------------------- what a discreet reminder says -- */

  /**
   * The wording both reminders use when the discreet switch is on.
   *
   * ## Why there is only one of these
   *
   * Two different neutral texts would be a code. Somebody reading the lock
   * screen over a shoulder would learn from "haftalık" that this is the
   * pregnancy one, which is most of what the original sentence told them
   * anyway. One text for both reminders is the only version that gives nothing
   * away, and two identical notifications stacking is a fair price.
   *
   * It says a reminder exists and where to read it. Not "yeni bir şey var",
   * which would be a claim about content the app has not checked, and not a
   * question, which invites a tap on a lock screen somebody else is holding.
   *
   * ## What this does not hide
   *
   * The app's icon is on the notification, and the icon is a moon. Somebody who
   * already knows what this app is will know what the reminder is for. This
   * removes the sentence, not the app from the phone, and the setting's own
   * description does not claim otherwise.
   */
  discreetReminderTitle: 'Hatırlatıcı',
  discreetReminderBody: 'Uygulamayı açtığında hatırlatmanı görebilirsin.',

  /* ------------------------------------------ the rows in settings -- */

  /**
   * What each reminder is called where it is switched on and off.
   *
   * "Regl hatırlatıcısı" is also what the notification itself is titled, above.
   * They are two strings that happen to match: one names a row in settings, the
   * other is the heading on a notification, and a change to one is not a change
   * to the other.
   */
  periodReminderToggleLabel: 'Regl hatırlatıcısı',
  pregnancyWeeklyReminderToggleLabel: 'Haftalık gebelik hatırlatıcısı',

  /**
   * The switch that decides how much a reminder says.
   *
   * ## The label
   *
   * "Gösterme" is the negative imperative here — *do not show* — which is how
   * the rest of this app talks to somebody ("PIN'ini gir", "kayıtların").
   * Turkish lets the same six letters be read as a verbal noun, "the showing
   * of", which would point the switch the other way, so the description
   * underneath opens by saying what happens when it is on rather than leaving
   * the label to carry it alone.
   *
   * English has no such ambiguity, so its label can say the thing plainly. Both
   * descriptions still open with what happens when it is on, because that is
   * the useful sentence either way.
   *
   * ## The description
   *
   * It names the constraint rather than the feature. Somebody deciding this
   * needs to know one thing first: the lock screen shows the words whatever
   * this app would prefer, and this switch is the only part of that the app can
   * change. Saying "gizleyemez" out loud is the same honesty the app lock's own
   * note is built on — a promise not made is a promise not broken.
   */
  discreetNotificationsToggleLabel: 'Bildirimlerde ayrıntı gösterme',

  discreetNotificationsDescription:
    'Açıkken hatırlatıcılar regl ya da gebelikten söz etmez, yalnızca uygulamayı ' +
    'açmanı söyler. Android bildirim metnini kilit ekranında gösterir ve uygulama ' +
    'bunu gizleyemez; değiştirebildiği tek şey metnin kendisidir.',
};

export type ReminderMessages = typeof reminderMessagesTr;

const reminderMessagesEn: ReminderMessages = {
  remindersIntro:
    'Reminders start switched off. Your phone may ask for notification permission ' +
    'the moment you turn one on.',

  permissionRefusedMessage:
    'Notification permission was not given. A reminder needs it to be switched on.',

  notificationsBlockedNotice:
    'Notifications are off for this app. Even with a reminder switched on, it cannot ' +
    'reach you. Allow notifications in your phone settings and try again.',

  openSystemSettingsLabel: 'Open notification settings',

  openSystemSettingsFailedMessage:
    'Your phone settings would not open. You can go there yourself: Settings > Apps > ' +
    'Regl & Gebelik Takvimi > Notifications.',

  reminderSaveFailedMessage: 'That reminder setting could not be saved.',

  periodReminderChannelName: 'Period reminders',
  periodReminderChannelDescription:
    'One reminder in the morning, the day before your period is expected.',

  periodReminderTitle: 'Period reminder',
  periodReminderBody: 'Based on your average, your period is expected soon.',

  pregnancyWeeklyReminderChannelName: 'Pregnancy reminders',
  pregnancyWeeklyReminderChannelDescription:
    'A weekly note on Monday mornings, while you are following a pregnancy.',

  pregnancyWeeklyReminderTitle: 'Pregnancy tracking',
  pregnancyWeeklyReminderBody: 'You can have a look at this week’s development notes.',

  discreetReminderTitle: 'Reminder',
  discreetReminderBody: 'Open the app to see your reminder.',

  periodReminderToggleLabel: 'Period reminder',
  pregnancyWeeklyReminderToggleLabel: 'Weekly pregnancy reminder',

  discreetNotificationsToggleLabel: 'Keep details out of notifications',

  discreetNotificationsDescription:
    'When this is on, reminders do not mention periods or pregnancy — they only tell ' +
    'you to open the app. Android shows notification text on the lock screen and this ' +
    'app cannot hide it; the only part it can change is the text itself.',
};

export const reminderMessages: Messages<ReminderMessages> = {
  tr: reminderMessagesTr,
  en: reminderMessagesEn,
};

/* ------------------------------------------------------------------------- */
/* The Turkish values under their original names, for the assertions that     */
/* already name them. Not for screens - see the note at the top of the file.  */
/* ------------------------------------------------------------------------- */

export const REMINDERS_INTRO = reminderMessagesTr.remindersIntro;
export const PERMISSION_REFUSED_MESSAGE = reminderMessagesTr.permissionRefusedMessage;
export const NOTIFICATIONS_BLOCKED_NOTICE = reminderMessagesTr.notificationsBlockedNotice;
export const OPEN_SYSTEM_SETTINGS_LABEL = reminderMessagesTr.openSystemSettingsLabel;
export const OPEN_SYSTEM_SETTINGS_FAILED_MESSAGE =
  reminderMessagesTr.openSystemSettingsFailedMessage;
export const REMINDER_SAVE_FAILED_MESSAGE = reminderMessagesTr.reminderSaveFailedMessage;
export const PERIOD_REMINDER_CHANNEL_NAME = reminderMessagesTr.periodReminderChannelName;
export const PERIOD_REMINDER_CHANNEL_DESCRIPTION =
  reminderMessagesTr.periodReminderChannelDescription;
export const PERIOD_REMINDER_TITLE = reminderMessagesTr.periodReminderTitle;
export const PERIOD_REMINDER_BODY = reminderMessagesTr.periodReminderBody;
export const PREGNANCY_WEEKLY_REMINDER_CHANNEL_NAME =
  reminderMessagesTr.pregnancyWeeklyReminderChannelName;
export const PREGNANCY_WEEKLY_REMINDER_CHANNEL_DESCRIPTION =
  reminderMessagesTr.pregnancyWeeklyReminderChannelDescription;
export const PREGNANCY_WEEKLY_REMINDER_TITLE = reminderMessagesTr.pregnancyWeeklyReminderTitle;
export const PREGNANCY_WEEKLY_REMINDER_BODY = reminderMessagesTr.pregnancyWeeklyReminderBody;
export const DISCREET_REMINDER_TITLE = reminderMessagesTr.discreetReminderTitle;
export const DISCREET_REMINDER_BODY = reminderMessagesTr.discreetReminderBody;
export const PERIOD_REMINDER_TOGGLE_LABEL = reminderMessagesTr.periodReminderToggleLabel;
export const PREGNANCY_WEEKLY_REMINDER_TOGGLE_LABEL =
  reminderMessagesTr.pregnancyWeeklyReminderToggleLabel;
export const DISCREET_NOTIFICATIONS_TOGGLE_LABEL =
  reminderMessagesTr.discreetNotificationsToggleLabel;
export const DISCREET_NOTIFICATIONS_DESCRIPTION =
  reminderMessagesTr.discreetNotificationsDescription;
