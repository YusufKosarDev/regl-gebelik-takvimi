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

  notFoundTitle: 'Bu sayfa yok',
  notFoundBody:
    'Açmaya çalıştığın bağlantı uygulamadaki hiçbir ekrana gitmiyor. Kayıtların yerinde.',
  notFoundHomeLabel: 'Ana ekrana dön',
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

  notFoundTitle: 'This page does not exist',
  notFoundBody:
    'The link you followed does not lead to any screen in this app. Your records are where you left them.',
  notFoundHomeLabel: 'Back to the home screen',
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
