import type { Messages } from '@/i18n';

/**
 * Everything the daily log says.
 *
 * The rule the whole feature is built on: the app records and shows, and says
 * nothing back. There is no sentence here that interprets a day, compares it to
 * another one, or calls anything normal. What somebody writes down about their
 * own body is theirs, and an app that answered it would be guessing.
 *
 * Turkish is the source language and the English is typed against it, so a key
 * in one and not the other is a compile error here rather than a blank on
 * somebody's screen.
 *
 * The individual constants below are exported as well as bundled. Screens read
 * the bundle through `useMessages`; the exports exist because roughly two
 * thousand assertions across this suite name them, and because a screen that
 * genuinely has one language — there are none yet — would import directly.
 */

const dailyLogMessagesTr = {
  /* ---------------------------------------------------- the card on home -- */

  cardEmptyTitle: 'Bugünü kaydet',
  cardEmptyHint: 'Akış, belirti ve ruh hali',
  cardAddLabel: 'Ekle',

  cardFilledTitle: 'Bugün',
  cardEditLabel: 'Düzenle',

  /** The separator between the parts of a summary, as the card draws it. */
  summarySeparator: ' · ',

  /** How many symptoms a day holds, for the summary line. */
  symptomCountLabel: (count: number): string => `${count} belirti`,

  /* ------------------------------------------------------ the entry screen -- */

  screenTitle: 'Günlük kayıt',

  flowSectionTitle: 'Akış',
  symptomsSectionTitle: 'Belirtiler',
  moodSectionTitle: 'Ruh hali',

  saveLabel: 'Kaydet',
  savingLabel: 'Kaydediliyor...',
  clearLabel: 'Bu günü temizle',

  clearedMessage: 'Bu günün kaydı silindi.',
  saveFailedMessage: 'Kaydedilemedi. Tekrar dene.',
  loadFailedMessage: 'Bu günün kaydı okunamadı.',

  /**
   * What the screen says when somebody presses save with nothing chosen.
   *
   * A refusal rather than a silent delete. Pressing save having chosen nothing
   * is more likely to be a mistake than a decision, and there is a button that
   * says "temizle" for the decision.
   */
  emptySelectionMessage: 'Kaydetmek için en az bir şey seç.',

  /* ----------------------------------------------------- the calendar day -- */

  calendarDayAddLabel: 'Bu güne ekle',
  calendarDayEditLabel: 'Bu günü düzenle',

  /* ---------------------------------------------------------- for readers -- */

  /** What a chosen option is called to a screen reader, inside its section. */
  choiceAccessibilityLabel: (section: string, label: string): string =>
    `${section}: ${label}`,
};

/**
 * The shape both catalogues share.
 *
 * Deliberately **not** `as const`. That would give every Turkish value a
 * literal type — `'Ekle'` rather than `string` — and the English catalogue
 * would then fail to compile for saying "Add" instead of "Ekle". What is wanted
 * from Turkish is the set of keys and the shape of each function, not the words.
 */
export type DailyLogMessages = typeof dailyLogMessagesTr;

const dailyLogMessagesEn: DailyLogMessages = {
  cardEmptyTitle: 'Record today',
  cardEmptyHint: 'Flow, symptoms and mood',
  cardAddLabel: 'Add',

  cardFilledTitle: 'Today',
  cardEditLabel: 'Edit',

  summarySeparator: ' · ',

  /**
   * English needs a plural where Turkish does not: `3 belirti`, but
   * "3 symptoms". This is the shape the whole catalogue design exists for — the
   * English function is free to differ from the Turkish one rather than being
   * forced through the same placeholder.
   */
  symptomCountLabel: (count: number): string =>
    count === 1 ? '1 symptom' : `${count} symptoms`,

  screenTitle: 'Daily record',

  flowSectionTitle: 'Flow',
  symptomsSectionTitle: 'Symptoms',
  moodSectionTitle: 'Mood',

  saveLabel: 'Save',
  savingLabel: 'Saving...',
  clearLabel: 'Clear this day',

  clearedMessage: 'This day’s record has been deleted.',
  saveFailedMessage: 'Could not save. Try again.',
  loadFailedMessage: 'Could not read this day’s record.',

  /** Matches the Turkish in being a refusal, not a warning about deleting. */
  emptySelectionMessage: 'Choose at least one thing to save.',

  calendarDayAddLabel: 'Add to this day',
  calendarDayEditLabel: 'Edit this day',

  choiceAccessibilityLabel: (section: string, label: string): string =>
    `${section}: ${label}`,
};

export const dailyLogMessages: Messages<DailyLogMessages> = {
  tr: dailyLogMessagesTr,
  en: dailyLogMessagesEn,
};

/* ------------------------------------------------------------------------- */
/* The Turkish constants, under the names the rest of the app already uses.   */
/* ------------------------------------------------------------------------- */

export const DAILY_CARD_EMPTY_TITLE = dailyLogMessagesTr.cardEmptyTitle;
export const DAILY_CARD_EMPTY_HINT = dailyLogMessagesTr.cardEmptyHint;
export const DAILY_CARD_ADD_LABEL = dailyLogMessagesTr.cardAddLabel;

export const DAILY_CARD_FILLED_TITLE = dailyLogMessagesTr.cardFilledTitle;
export const DAILY_CARD_EDIT_LABEL = dailyLogMessagesTr.cardEditLabel;

export const DAILY_SUMMARY_SEPARATOR = dailyLogMessagesTr.summarySeparator;

export const symptomCountLabel = dailyLogMessagesTr.symptomCountLabel;

export const DAILY_SCREEN_TITLE = dailyLogMessagesTr.screenTitle;

export const FLOW_SECTION_TITLE = dailyLogMessagesTr.flowSectionTitle;
export const SYMPTOMS_SECTION_TITLE = dailyLogMessagesTr.symptomsSectionTitle;
export const MOOD_SECTION_TITLE = dailyLogMessagesTr.moodSectionTitle;

export const DAILY_SAVE_LABEL = dailyLogMessagesTr.saveLabel;
export const DAILY_SAVING_LABEL = dailyLogMessagesTr.savingLabel;
export const DAILY_CLEAR_LABEL = dailyLogMessagesTr.clearLabel;

export const DAILY_CLEARED_MESSAGE = dailyLogMessagesTr.clearedMessage;
export const DAILY_SAVE_FAILED_MESSAGE = dailyLogMessagesTr.saveFailedMessage;
export const DAILY_LOAD_FAILED_MESSAGE = dailyLogMessagesTr.loadFailedMessage;

export const DAILY_EMPTY_SELECTION_MESSAGE = dailyLogMessagesTr.emptySelectionMessage;

export const CALENDAR_DAY_ADD_LABEL = dailyLogMessagesTr.calendarDayAddLabel;
export const CALENDAR_DAY_EDIT_LABEL = dailyLogMessagesTr.calendarDayEditLabel;

export const choiceAccessibilityLabel = dailyLogMessagesTr.choiceAccessibilityLabel;
