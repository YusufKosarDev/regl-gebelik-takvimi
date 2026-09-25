/**
 * Everything the daily log says, in Turkish.
 *
 * The rule the whole feature is built on: the app records and shows, and says
 * nothing back. There is no sentence here that interprets a day, compares it to
 * another one, or calls anything normal. What somebody writes down about their
 * own body is theirs, and an app that answered it would be guessing.
 */

/* ------------------------------------------------------ the card on home -- */

export const DAILY_CARD_EMPTY_TITLE = 'Bugünü kaydet';
export const DAILY_CARD_EMPTY_HINT = 'Akış, belirti ve ruh hali';
export const DAILY_CARD_ADD_LABEL = 'Ekle';

export const DAILY_CARD_FILLED_TITLE = 'Bugün';
export const DAILY_CARD_EDIT_LABEL = 'Düzenle';

/** The separator between the parts of a summary, as the card draws it. */
export const DAILY_SUMMARY_SEPARATOR = ' · ';

/** How many symptoms a day holds, for the summary line. */
export function symptomCountLabel(count: number): string {
  return `${count} belirti`;
}

/* -------------------------------------------------------- the entry screen -- */

export const DAILY_SCREEN_TITLE = 'Günlük kayıt';

export const FLOW_SECTION_TITLE = 'Akış';
export const SYMPTOMS_SECTION_TITLE = 'Belirtiler';
export const MOOD_SECTION_TITLE = 'Ruh hali';

export const DAILY_SAVE_LABEL = 'Kaydet';
export const DAILY_SAVING_LABEL = 'Kaydediliyor...';
export const DAILY_CLEAR_LABEL = 'Bu günü temizle';

export const DAILY_CLEARED_MESSAGE = 'Bu günün kaydı silindi.';
export const DAILY_SAVE_FAILED_MESSAGE = 'Kaydedilemedi. Tekrar dene.';
export const DAILY_LOAD_FAILED_MESSAGE = 'Bu günün kaydı okunamadı.';

/**
 * What the screen says when somebody presses save with nothing chosen.
 *
 * A refusal rather than a silent delete. Pressing save having chosen nothing is
 * more likely to be a mistake than a decision, and there is a button that says
 * "temizle" for the decision.
 */
export const DAILY_EMPTY_SELECTION_MESSAGE = 'Kaydetmek için en az bir şey seç.';

/* ------------------------------------------------------- the calendar day -- */

export const CALENDAR_DAY_ADD_LABEL = 'Bu güne ekle';
export const CALENDAR_DAY_EDIT_LABEL = 'Bu günü düzenle';

/* ------------------------------------------------------------ for readers -- */

/** What a chosen option is called to a screen reader, inside its section. */
export function choiceAccessibilityLabel(section: string, label: string): string {
  return `${section}: ${label}`;
}
