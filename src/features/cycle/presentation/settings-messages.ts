import type { Messages } from '@/i18n';
import { plural } from '@/i18n';

/**
 * Everything the cycle settings screen says.
 *
 * Moved out of `app/(app)/settings.tsx` verbatim. Its own file rather than
 * home-messages or history-messages for the same reason those two are separate:
 * all three are the cycle feature, and none of them is the others' screen.
 *
 * The two field notes read the same as the onboarding questions they repeat.
 * They are left as two strings, in two features, because that is what they were
 * - onboarding asks once and this screen corrects it afterwards, and a shared
 * sentence would make an edit to one an edit to both. The English halves repeat
 * each other in the same way and for the same reason.
 */

const settingsMessagesTr = {
  settingsTitle: 'Döngü ayarları',
  settingsDescription: 'Döngü ve regl süresi tahminlerini buradan güncelleyebilirsin.',

  settingsLoadFailedMessage: 'Ayarlar yüklenemedi.',
  settingsSaveFailedMessage: 'Ayarlar kaydedilemedi.',
  settingsEmptyMessage: 'Döngü bilgisi bulunamadı.',

  /* --------------------------------------------------------- the two fields -- */

  cycleLengthFieldLabel: 'Ortalama döngü süresi',
  cycleLengthFieldNote:
    'Bir regl döneminin ilk gününden, sonraki regl döneminin ilk gününe kadar geçen süre.',
  cycleLengthDecreaseLabel: 'Ortalama döngü süresini azalt',
  cycleLengthIncreaseLabel: 'Ortalama döngü süresini artır',

  periodLengthFieldLabel: 'Ortalama regl süresi',
  periodLengthFieldNote:
    'Kanamanın başladığı ilk günden tamamen bittiği güne kadar geçen ortalama süre.',
  periodLengthDecreaseLabel: 'Ortalama regl süresini azalt',
  periodLengthIncreaseLabel: 'Ortalama regl süresini artır',

  /**
   * The unit under both steppers, which draw the number on its own line above.
   *
   * Takes the count that Turkish ignores, for the reason onboarding's does:
   * the word is 'gün' whatever the number and 'day' or 'days' depending on it.
   */
  daysUnit: (_days: number) => 'gün',

  settingsSaveLabel: 'Döngü ayarlarını kaydet',

  /** A stepper's current value, read as the field it belongs to. */
  lengthValueLabel: (label: string, value: number) => `${label}: ${value} gün`,

  /* ------------------------------------------------------- the two sections -- */

  notificationsSectionTitle: 'Bildirimler',

  accountSectionTitle: 'Hesap',
  accountSectionDescription: 'Hesap açmak isteğe bağlı. Verilerin telefonunda kalır.',
  accountOpenLabel: 'Hesabı aç',
};

export type SettingsMessages = typeof settingsMessagesTr;

const settingsMessagesEn: SettingsMessages = {
  settingsTitle: 'Cycle settings',
  settingsDescription: 'Update what your cycle and period lengths are estimated from.',

  settingsLoadFailedMessage: 'Those settings could not be loaded.',
  settingsSaveFailedMessage: 'Those settings could not be saved.',
  settingsEmptyMessage: 'No cycle information found.',

  cycleLengthFieldLabel: 'Average cycle length',
  cycleLengthFieldNote:
    'The time from the first day of one period to the first day of the next.',
  cycleLengthDecreaseLabel: 'Decrease the average cycle length',
  cycleLengthIncreaseLabel: 'Increase the average cycle length',

  periodLengthFieldLabel: 'Average period length',
  periodLengthFieldNote:
    'The average time from the first day of bleeding to the day it stops completely.',
  periodLengthDecreaseLabel: 'Decrease the average period length',
  periodLengthIncreaseLabel: 'Increase the average period length',

  daysUnit: (days: number) => plural(days, 'day', 'days'),

  settingsSaveLabel: 'Save cycle settings',

  lengthValueLabel: (label: string, value: number) =>
    `${label}: ${plural(value, `${value} day`, `${value} days`)}`,

  notificationsSectionTitle: 'Notifications',

  accountSectionTitle: 'Account',
  accountSectionDescription:
    'An account is optional. Your records stay on your phone either way.',
  accountOpenLabel: 'Open an account',
};

export const settingsMessages: Messages<SettingsMessages> = {
  tr: settingsMessagesTr,
  en: settingsMessagesEn,
};

/* ------------------------------------------------------------------------- */
/* The Turkish values under their original names, for the assertions that     */
/* already name them. Not for screens - see the note at the top of the file.  */
/* ------------------------------------------------------------------------- */

export const SETTINGS_TITLE = settingsMessagesTr.settingsTitle;
export const SETTINGS_DESCRIPTION = settingsMessagesTr.settingsDescription;
export const SETTINGS_LOAD_FAILED_MESSAGE = settingsMessagesTr.settingsLoadFailedMessage;
export const SETTINGS_SAVE_FAILED_MESSAGE = settingsMessagesTr.settingsSaveFailedMessage;
export const SETTINGS_EMPTY_MESSAGE = settingsMessagesTr.settingsEmptyMessage;
export const CYCLE_LENGTH_FIELD_LABEL = settingsMessagesTr.cycleLengthFieldLabel;
export const CYCLE_LENGTH_FIELD_NOTE = settingsMessagesTr.cycleLengthFieldNote;
export const CYCLE_LENGTH_DECREASE_LABEL = settingsMessagesTr.cycleLengthDecreaseLabel;
export const CYCLE_LENGTH_INCREASE_LABEL = settingsMessagesTr.cycleLengthIncreaseLabel;
export const PERIOD_LENGTH_FIELD_LABEL = settingsMessagesTr.periodLengthFieldLabel;
export const PERIOD_LENGTH_FIELD_NOTE = settingsMessagesTr.periodLengthFieldNote;
export const PERIOD_LENGTH_DECREASE_LABEL = settingsMessagesTr.periodLengthDecreaseLabel;
export const PERIOD_LENGTH_INCREASE_LABEL = settingsMessagesTr.periodLengthIncreaseLabel;
export const SETTINGS_SAVE_LABEL = settingsMessagesTr.settingsSaveLabel;
export const NOTIFICATIONS_SECTION_TITLE = settingsMessagesTr.notificationsSectionTitle;
export const ACCOUNT_SECTION_TITLE = settingsMessagesTr.accountSectionTitle;
export const ACCOUNT_SECTION_DESCRIPTION = settingsMessagesTr.accountSectionDescription;
export const ACCOUNT_OPEN_LABEL = settingsMessagesTr.accountOpenLabel;

/** Kept as a bare unit for the assertions that name it; screens call `daysUnit`. */
export const DAYS_UNIT = settingsMessagesTr.daysUnit(0);

export const lengthValueLabel = settingsMessagesTr.lengthValueLabel;
