/**
 * What the settings screen says about reminders.
 *
 * Kept apart from the screen for the same reason every other feature's copy is:
 * these are the sentences somebody reads when a reminder did not arrive, and
 * they should be findable without reading a component.
 *
 * Two different situations, two different sentences. Being asked and saying no
 * is not the same as never having been asked, and the app must not imply the
 * person did something they did not.
 */

/** The section's standing explanation, shown whatever the permission is. */
export const REMINDERS_INTRO =
  'Hatırlatıcılar kapalı gelir. Açtığın anda telefonun bildirim izni isteyebilir.';

/**
 * Shown right after a switch failed to turn on because the system refused.
 *
 * Transient, tied to the press. The standing notice below is what remains.
 */
export const PERMISSION_REFUSED_MESSAGE =
  'Bildirim izni verilmedi. Hatırlatıcıyı açmak için bildirim izni gerekiyor.';

/**
 * Shown for as long as notifications are off for this app.
 *
 * It says what the consequence is rather than what the setting is called: "izin
 * kapalı" is a fact about a toggle somewhere, and "hatırlatıcılar sana
 * ulaşamaz" is what that fact means for the person reading it.
 */
export const NOTIFICATIONS_BLOCKED_NOTICE =
  'Bu uygulamanın bildirimleri kapalı. Hatırlatıcıları açsan bile sana ulaşamaz. ' +
  'Telefon ayarlarından bildirimlere izin verdikten sonra tekrar dene.';

/** The way out of it, and the only one Android leaves once it has been refused. */
export const OPEN_SYSTEM_SETTINGS_LABEL = 'Bildirim ayarlarını aç';

/** When the system settings screen refuses to open, which is rare and not fatal. */
export const OPEN_SYSTEM_SETTINGS_FAILED_MESSAGE =
  'Telefon ayarları açılamadı. Ayarlar > Uygulamalar > Regl & Gebelik Takvimi > ' +
  'Bildirimler yolunu elle açabilirsin.';

export const REMINDER_SAVE_FAILED_MESSAGE = 'Hatırlatıcı ayarı kaydedilemedi.';

/* ------------------------------------------ what a reminder says -- */

/**
 * The words the two reminders are delivered with.
 *
 * They sat in `domain/` beside the rules about when a reminder fires, which is
 * where they were written and not where they belong: a channel name and a body
 * are Turkish somebody reads, on a lock screen and in Android's own settings.
 * The domain keeps the day, the hour and the type that identifies a queued
 * notification - the things a rewording must never disturb.
 *
 * Moved verbatim, with the reasoning they were written with.
 */

/**
 * The Android channel the period reminders are delivered on.
 *
 * The name and the description are what somebody reads in the system's own
 * notification settings, where this app's words sit beside every other app's.
 * The description says what arrives and when, because that screen is where a
 * person decides whether to keep it — and "Regl hatırlatıcıları" alone does not
 * tell them whether it is one a month or one a day.
 */
export const PERIOD_REMINDER_CHANNEL_NAME = 'Regl hatırlatıcıları';
export const PERIOD_REMINDER_CHANNEL_DESCRIPTION =
  'Tahmini regl tarihinden bir gün önce, sabah saatlerinde tek bir hatırlatma.';

/**
 * What it says.
 *
 * "Yaklaşıyor" and "tahminine göre": the app is working from an average, and it
 * does not know when anyone's period will start. A notification saying it begins
 * today would be stating something the prediction cannot support, on a day
 * someone may well be somewhere they would rather not be surprised.
 */
export const PERIOD_REMINDER_TITLE = 'Regl hatırlatıcısı';
export const PERIOD_REMINDER_BODY = 'Tahminine göre regl dönemin yaklaşıyor.';

/**
 * The Android channel the weekly pregnancy notes are delivered on.
 *
 * Separate so that switching one off in system settings leaves the other alone:
 * somebody tracking a pregnancy may well want the weekly note and nothing else.
 */
export const PREGNANCY_WEEKLY_REMINDER_CHANNEL_NAME = 'Gebelik hatırlatıcıları';
export const PREGNANCY_WEEKLY_REMINDER_CHANNEL_DESCRIPTION =
  'Gebelik takibi açıkken her pazartesi sabah saatlerinde haftalık bilgilendirme.';

/**
 * What it says.
 *
 * An invitation rather than a claim. "Göz atabilirsin" — you can have a look —
 * because the app does not know how this week is going for anyone, and a
 * notification is the wrong place to say anything about a pregnancy that would
 * matter if it were wrong.
 */
export const PREGNANCY_WEEKLY_REMINDER_TITLE = 'Gebelik takibi';
export const PREGNANCY_WEEKLY_REMINDER_BODY =
  'Bu haftaki gebelik gelişim bilgilerine göz atabilirsin.';
