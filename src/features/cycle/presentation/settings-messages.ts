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
  /**
   * The tab, not one of its sections.
   *
   * This used to say "Döngü ayarları", which named the first block on a
   * screen that also holds reminders, language, the lock, export, about and
   * the way to delete everything. That heading moved down to the block it
   * was describing.
   */
  settingsTitle: 'Profil',
  cycleSectionTitle: 'Döngü ayarları',
  settingsDescription: 'Hesabın, döngü ayarların, hatırlatıcıların ve verilerin.',

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

  /**
   * Why a step button at the end of its range will not take a press.
   *
   * A disabled control announces itself as disabled and stops there, and
   * "disabled" is not a reason. Nothing on screen says where the range ends,
   * so the numbers are in the hint rather than a sentence saying there is a
   * limit - "you are at the limit" leaves somebody to find the other end by
   * pressing.
   *
   * On the button that refuses, and only that one: a hint on a working button
   * is read out on every pass for nothing, and on Android a hint cannot be
   * turned off.
   */
  lengthLimitHint: (minDays: number, maxDays: number) =>
    `${minDays}-${maxDays} gün arasında seçilebilir.`,

  /* ------------------------------------------------------- the two sections -- */

  notificationsSectionTitle: 'Bildirimler',

  accountSectionTitle: 'Hesap',
  /**
   * The line under the avatar at the top of the profile tab.
   *
   * Ours. Nothing was borrowed here: the app this follows structurally has a
   * tab for the person and its store screenshots show none of what is on it.
   *
   *  exists so that the half-second before the answer is
   * known says nothing rather than the wrong thing - telling somebody who is
   * signed in that their records are on this phone only is a false statement
   * about where their data is, and it does not stop being one for being brief.
   */
  identityLocalOnly: 'Kayıtların yalnızca bu telefonda.',
  identityChecking: 'Hesap durumu kontrol ediliyor.',

  accountOpenLabel: 'Hesabı aç',
  /**
   * What the row says once there is an account to manage.
   *
   *  was used in both states, so somebody signed in read
   * "Hesabı aç" directly under their own address. The screen was offering to
   * open a thing it had just told them they had.
   */
  accountManageLabel: 'Hesabı yönet',
};

export type SettingsMessages = typeof settingsMessagesTr;

const settingsMessagesEn: SettingsMessages = {
  settingsTitle: 'Profile',
  cycleSectionTitle: 'Cycle settings',
  settingsDescription: 'Your account, cycle settings, reminders and data.',

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

  identityLocalOnly: 'Your records are on this phone only.',
  identityChecking: 'Checking your account.',

  settingsSaveLabel: 'Save cycle settings',

  lengthValueLabel: (label: string, value: number) =>
    `${label}: ${plural(value, `${value} day`, `${value} days`)}`,

  lengthLimitHint: (minDays: number, maxDays: number) =>
    `Can be set between ${minDays} and ${maxDays} days.`,

  notificationsSectionTitle: 'Notifications',

  accountSectionTitle: 'Account',
  accountOpenLabel: 'Open an account',
  accountManageLabel: 'Manage your account',
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
export const ACCOUNT_OPEN_LABEL = settingsMessagesTr.accountOpenLabel;

/** Kept as a bare unit for the assertions that name it; screens call `daysUnit`. */
export const DAYS_UNIT = settingsMessagesTr.daysUnit(0);

export const lengthValueLabel = settingsMessagesTr.lengthValueLabel;
