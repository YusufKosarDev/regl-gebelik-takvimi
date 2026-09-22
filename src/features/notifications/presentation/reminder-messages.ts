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
