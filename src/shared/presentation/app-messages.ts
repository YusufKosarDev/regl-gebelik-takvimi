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
