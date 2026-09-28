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
 */

export const BACK_LABEL = 'Geri';

/** Shown while a screen reads what it needs. */
export const LOADING_MESSAGE = 'Veriler yükleniyor';

/**
 * The three words on every form.
 *
 * Five screens across four features have a save button, a busy state for it and
 * a way out. Features that own their own version of these - the period card and
 * the daily entry screen - keep theirs; these are for the screens that have no
 * feature to ask.
 */
export const SAVE_LABEL = 'Kaydet';
export const SAVING_LABEL = 'Kaydediliyor...';
export const CANCEL_LABEL = 'Vazgeç';

/**
 * When a screen fails to draw, and when a link points at nothing.
 *
 * Both belong to the app rather than to a feature by definition: the first is
 * shown *because* a feature stopped working, and the second is shown when no
 * feature matched at all.
 *
 * The first thing each says is that the records are still there. Somebody whose
 * period history is in this app and who is looking at a screen that broke has
 * one question, and it is not what went wrong.
 *
 * What did go wrong is deliberately not shown. The same reasoning as the
 * hydration error in `app/_layout.tsx`: the thrown text is written by whatever
 * failed, in whatever words it happened to use, and a screen is the one place
 * a person cannot choose not to look at it.
 */
export const ERROR_TITLE = 'Bir şeyler ters gitti';
export const ERROR_BODY = 'Kayıtların telefonunda duruyor, silinmedi.';
export const ERROR_RETRY_LABEL = 'Yeniden dene';

export const NOT_FOUND_TITLE = 'Bu sayfa yok';
export const NOT_FOUND_BODY =
  'Açmaya çalıştığın bağlantı uygulamadaki hiçbir ekrana gitmiyor. Kayıtların yerinde.';
export const NOT_FOUND_HOME_LABEL = 'Ana ekrana dön';
