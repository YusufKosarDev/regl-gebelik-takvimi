import type { Messages } from '@/i18n';

/**
 * The words that belong to the app rather than to any one feature.
 *
 * Nine screens have a back button and five say the same thing while they read.
 * Those sentences have no feature to live in - putting "Geri" in the cycle
 * feature because the history screen also uses it would make every other
 * screen import from a feature it has nothing to do with.
 *
 * The bar for this file is high on purpose: a string belongs here only when no
 * single feature owns it. A word two screens of the same feature share belongs
 * to that feature, not here.
 *
 * ## The shape
 *
 * Turkish is written first and without `as const`, so its inferred type is the
 * contract rather than a set of string literals the English half could not
 * satisfy. `appMessagesEn` is annotated with that type, so a key missing from
 * either side is a compile error here rather than a blank label somebody finds
 * on a phone.
 *
 * The individual `SCREAMING_CASE` constants below are the Turkish values under
 * their original names. They are a transitional crutch, not the pattern: a few
 * hundred assertions across this suite name them, and rewriting those to reach
 * through the pair is the one thing this migration is built to avoid. Screens
 * read `useMessages(appMessages)` and never touch them.
 */

const appMessagesTr = {
  backLabel: 'Geri',

  /** Shown while a screen reads what it needs. */
  loadingMessage: 'Veriler yükleniyor',

  /**
   * The three words on every form.
   *
   * Five screens across four features have a save button, a busy state for it
   * and a way out. Features that own their own version of these - the period
   * card and the daily entry screen - keep theirs; these are for the screens
   * that have no feature to ask.
   */
  saveLabel: 'Kaydet',
  savingLabel: 'Kaydediliyor...',
  cancelLabel: 'Vazgeç',

  /**
   * When a screen fails to draw, and when a link points at nothing.
   *
   * Both belong to the app rather than to a feature by definition: the first is
   * shown *because* a feature stopped working, and the second is shown when no
   * feature matched at all.
   *
   * The first thing each says is that the records are still there. Somebody
   * whose period history is in this app and who is looking at a screen that
   * broke has one question, and it is not what went wrong.
   *
   * What did go wrong is deliberately not shown. The same reasoning as the
   * hydration error in `app/_layout.tsx`: the thrown text is written by
   * whatever failed, in whatever words it happened to use, and a screen is the
   * one place a person cannot choose not to look at it.
   */
  errorTitle: 'Bir şeyler ters gitti',
  errorBody: 'Kayıtların telefonunda duruyor, silinmedi.',
  errorRetryLabel: 'Yeniden dene',

  /**
   * The earliest failure there is: the app could not read its own saved state.
   *
   * Its own sentence rather than `errorTitle`, because this one happens before
   * any screen exists to have broken, and there is nothing to retry from - the
   * app has not started. Saying the records are still there is the whole
   * message.
   *
   * It lived in `app/_layout.tsx` as a hardcoded English string for as long as
   * that screen existed, on a Turkish-first app, and it is the one screen
   * somebody cannot navigate away from. Nothing stopped it being translated:
   * the language resolver falls back to the device's own language without
   * needing the store that just failed.
   */
  hydrationErrorMessage: 'Uygulama açılamadı. Kayıtların telefonunda duruyor, silinmedi.',

  notFoundTitle: 'Bu sayfa yok',
  notFoundBody:
    'Açmaya çalıştığın bağlantı uygulamadaki hiçbir ekrana gitmiyor. Kayıtların yerinde.',
  notFoundHomeLabel: 'Ana ekrana dön',

  /**
   * The language setting.
   *
   * App-wide by definition: it is the one setting that changes every other
   * screen, so it belongs to no feature.
   *
   * Only the word for "follow the phone" is translated. The two languages name
   * themselves - Türkçe and English - because somebody looking for their own
   * language should find it written the way they write it, not translated into
   * one they cannot read. That is also what makes the setting usable to
   * somebody who has landed in the wrong language by accident.
   */
  languageSectionTitle: 'Dil',
  languageSectionDescription:
    'Uygulamanın dili. Telefonunu takip edebilir ya da kendin seçebilirsin.',
  languageSystemLabel: 'Telefonun dili',

  /**
   * The two languages, named the way they name themselves.
   *
   * Identical in both halves, and here rather than written into the picker so
   * that the rule forbidding Turkish outside a catalogue stays absolute. A
   * component that may write 'Türkçe' inline is a component the next person
   * copies.
   */
  languageNameTurkish: 'Türkçe',
  languageNameEnglish: 'English',
};

export type AppMessages = typeof appMessagesTr;

const appMessagesEn: AppMessages = {
  backLabel: 'Back',

  loadingMessage: 'Loading your records',

  saveLabel: 'Save',
  savingLabel: 'Saving...',
  cancelLabel: 'Cancel',

  errorTitle: 'Something went wrong',
  errorBody: 'Your records are still on this phone. Nothing was deleted.',
  errorRetryLabel: 'Try again',

  hydrationErrorMessage:
    'The app could not start. Your records are still on this phone. Nothing was deleted.',

  notFoundTitle: 'This page does not exist',
  notFoundBody:
    'The link you followed does not lead to any screen in this app. Your records are where you left them.',
  notFoundHomeLabel: 'Back to the home screen',

  languageSectionTitle: 'Language',
  languageSectionDescription:
    'The language the app is in. It can follow your phone, or you can choose.',
  languageSystemLabel: 'Your phone’s language',

  languageNameTurkish: 'Türkçe',
  languageNameEnglish: 'English',
};

export const appMessages: Messages<AppMessages> = { tr: appMessagesTr, en: appMessagesEn };

/* ------------------------------------------------------------------------- */
/* The Turkish values under their original names, for the assertions that     */
/* already name them. Not for screens - see the note at the top of the file.  */
/* ------------------------------------------------------------------------- */

export const BACK_LABEL = appMessagesTr.backLabel;
export const LOADING_MESSAGE = appMessagesTr.loadingMessage;
export const SAVE_LABEL = appMessagesTr.saveLabel;
export const SAVING_LABEL = appMessagesTr.savingLabel;
export const CANCEL_LABEL = appMessagesTr.cancelLabel;
export const ERROR_TITLE = appMessagesTr.errorTitle;
export const ERROR_BODY = appMessagesTr.errorBody;
export const ERROR_RETRY_LABEL = appMessagesTr.errorRetryLabel;
export const NOT_FOUND_TITLE = appMessagesTr.notFoundTitle;
export const NOT_FOUND_BODY = appMessagesTr.notFoundBody;
export const NOT_FOUND_HOME_LABEL = appMessagesTr.notFoundHomeLabel;
export const LANGUAGE_SECTION_TITLE = appMessagesTr.languageSectionTitle;
export const LANGUAGE_SECTION_DESCRIPTION = appMessagesTr.languageSectionDescription;
export const LANGUAGE_SYSTEM_LABEL = appMessagesTr.languageSystemLabel;
