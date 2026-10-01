import type { PregnancyDashboard } from '../application/get-pregnancy-dashboard';
import type { PregnancyDueDateSource, PregnancyWeeklyContent } from '../domain/types';

import type { Messages } from '@/i18n';

/**
 * Everything the three pregnancy screens say.
 *
 * Lifted out of the screens unchanged, so the pregnancy section can be a
 * component of its own without taking its sentences with it as props.
 *
 * ## Weeks and days read differently in the two languages
 *
 * Turkish counts with an ordinal suffix and no noun in front — "12. hafta
 * 3. gün". English needs the noun first and the number after it — "week 12,
 * day 3". Neither is the other with the words swapped, which is why both halves
 * build the phrase rather than filling in one template.
 */

const pregnancyLabelsTr = {
  notStartedMessage: 'Gebelik başlangıç tarihi henüz gelmedi.',

  /** How far along, once there is something to report. */
  progress: (week: number, day: number) => `${week}. hafta ${day}. gün`,

  /** Where the due date came from, so an adjusted one is not read as calculated. */
  dueDateAdjusted: 'Düzeltilmiş tarih',
  dueDateFromLmp: 'Son regl tarihine göre',

  /** The week's content in one line, when there is a size to lead with. */
  weeklyHighlightWithSize: (label: string, comparison: string, summary: string) =>
    `${label} — ${comparison}. ${summary}`,

  /* ---------------------------------------------- starting to track -- */

  pregnancyStartTitle: 'Gebelik takibini başlat',

  pregnancyStartDescription:
    'Son regl döneminin başladığı günü seç. Gebelik haftaları ve tahmini doğum ' +
    'tarihi bu güne göre hesaplanır.',

  pregnancyStartLmpLabel: 'Son regl başlangıcı',

  pregnancyStartPreviousDayLabel: 'Önceki gün',
  pregnancyStartNextDayLabel: 'Sonraki gün',

  /** The button says what it does; the label says what it is for. */
  pregnancyStartSubmitLabel: 'Gebelik takibini başlat',
  pregnancyStartSubmitText: 'Takibi başlat',
  pregnancyStartStartingLabel: 'Başlatılıyor...',

  pregnancyStartFailedMessage: 'Gebelik takibi başlatılamadı.',

  /** The chosen day, read as what it is rather than as a bare date. */
  selectedLmpLabel: (readableDate: string) => `Seçilen son regl başlangıcı: ${readableDate}`,

  /* ------------------------------------------- the section on home -- */

  pregnancySectionTitle: 'Gebelik takibi',

  pregnancyWeekLabel: 'Gebelik haftası',
  pregnancyDueDateLabel: 'Tahmini doğum tarihi',

  pregnancyPreviousWeekLabel: 'Önceki hafta',
  pregnancyNextWeekLabel: 'Sonraki hafta',
  pregnancyBackToCurrentWeekLabel: 'Bugünkü haftaya dön',

  pregnancyThisWeekTitle: 'Bu hafta',
  pregnancyDevelopmentsTitle: 'Bu hafta gelişenler',
  pregnancySourcesTitle: 'Kaynaklar',

  pregnancySettingsLinkLabel: 'Gebelik ayarlarını düzenle',
  pregnancySettingsLinkText: 'Gebelik ayarları',

  /** The week, spoken as a label and its value. */
  pregnancyWeekRowLabel: (progress: string) => `Gebelik haftası: ${progress}`,

  /**
   * The due date with where it came from, read as one sentence rather than a
   * date and an unexplained phrase after it.
   */
  pregnancyDueDateRowLabel: (readableDate: string, source: string) =>
    `Tahmini doğum tarihi: ${readableDate}, ${source}`,

  /** Which week is on screen, for the stepper. */
  shownWeekLabel: (week: number) => `Gösterilen hafta: ${week}. hafta`,

  /**
   * The same week, written on the stepper itself.
   *
   * Separate from `shownWeekLabel` because that one is what a screen reader
   * says and this one is what the eye reads; the stepper has the two arrows
   * beside it, so the visible form does not repeat "Gösterilen".
   *
   * It exists at all because it used to be written into the component as the
   * JSX text `{shownWeek}. hafta`. `no-turkish-outside-catalogues` reads JSX
   * text and still did not catch it: the rule matches Turkish-specific letters
   * and "hafta" has none. That blind spot is stated in the rule and accepted
   * there on purpose, so the thing that catches this is a test, not the rule —
   * see the English render assertion beside this feature.
   */
  shownWeekTitle: (week: number) => `${week}. hafta`,

  /** The week's content in one line, so a reader hears it without the layout. */
  thisWeekLabel: (highlight: string) => `Bu hafta: ${highlight}`,

  /** The bullets, joined, so they are heard as one list rather than five items. */
  developmentsLabel: (features: readonly string[]) =>
    `Bu hafta gelişenler: ${features.join(', ')}`,

  /** A source, as something to open. */
  pregnancySourceLabel: (name: string) => `${name} kaynağını aç`,

  /* -------------------------------------------- the settings screen -- */

  pregnancySettingsTitle: 'Gebelik ayarları',

  pregnancySettingsDescription:
    'Tahmini doğum tarihini düzeltebilir ya da son regl tarihine göre hesaplanan ' +
    'tarihe geri dönebilirsin.',

  pregnancySettingsLoadFailedMessage: 'Gebelik ayarları yüklenemedi.',
  pregnancySettingsSaveFailedMessage: 'Tahmini doğum tarihi güncellenemedi.',
  pregnancySettingsEmptyMessage: 'Takip edilen bir gebelik bulunamadı.',
  pregnancyStopFailedMessage: 'Gebelik takibi sonlandırılamadı.',

  pregnancyStopQuestion: 'Gebelik takibini sonlandırmak istiyor musun?',
  pregnancyStopConsequence: 'Gebelik takip bilgilerin silinecek.',

  pregnancyStopOpenLabel: 'Gebelik takibini sonlandırmayı seç',
  pregnancyStopConfirmLabel: 'Gebelik takibini sonlandır',
  pregnancyStopConfirmText: 'Takibi sonlandır',
  pregnancyStoppingLabel: 'Sonlandırılıyor...',

  pregnancyEditDueDateLabel: 'Tahmini doğum tarihini düzenle',
  pregnancyEditDueDateText: 'Tarihi düzenle',
  pregnancySaveDueDateLabel: 'Tahmini doğum tarihini kaydet',

  pregnancyBackToLmpLabel: 'Son regl tarihine göre hesaplanan tarihe dön',
  pregnancyBackToLmpText: 'LMP hesabına dön',

  pregnancySettingsPreviousDayLabel: 'Önceki gün',
  pregnancySettingsNextDayLabel: 'Sonraki gün',

  /** The label before the stored last menstrual period, which follows it. */
  pregnancyLmpPrefix: 'Son regl başlangıcı:',

  /** The day being chosen, read as what it is rather than as a bare date. */
  selectedDueDateLabel: (readableDate: string) =>
    `Seçilen tahmini doğum tarihi: ${readableDate}`,
};

export type PregnancyLabels = typeof pregnancyLabelsTr;

const pregnancyLabelsEn: PregnancyLabels = {
  notStartedMessage: 'That pregnancy has not started yet.',

  progress: (week: number, day: number) => `Week ${week}, day ${day}`,

  dueDateAdjusted: 'Adjusted date',
  dueDateFromLmp: 'From your last period',

  weeklyHighlightWithSize: (label: string, comparison: string, summary: string) =>
    `${label} — ${comparison}. ${summary}`,

  pregnancyStartTitle: 'Start following a pregnancy',

  pregnancyStartDescription:
    'Pick the day your last period started. The pregnancy weeks and the estimated due ' +
    'date are worked out from that day.',

  pregnancyStartLmpLabel: 'Last period started',

  pregnancyStartPreviousDayLabel: 'Previous day',
  pregnancyStartNextDayLabel: 'Next day',

  pregnancyStartSubmitLabel: 'Start following a pregnancy',
  pregnancyStartSubmitText: 'Start tracking',
  pregnancyStartStartingLabel: 'Starting...',

  pregnancyStartFailedMessage: 'That pregnancy could not be started.',

  selectedLmpLabel: (readableDate: string) => `Last period start chosen: ${readableDate}`,

  pregnancySectionTitle: 'Pregnancy tracking',

  pregnancyWeekLabel: 'Pregnancy week',
  pregnancyDueDateLabel: 'Estimated due date',

  pregnancyPreviousWeekLabel: 'Previous week',
  pregnancyNextWeekLabel: 'Next week',
  pregnancyBackToCurrentWeekLabel: 'Back to this week',

  pregnancyThisWeekTitle: 'This week',
  pregnancyDevelopmentsTitle: 'Developing this week',
  pregnancySourcesTitle: 'Sources',

  pregnancySettingsLinkLabel: 'Edit your pregnancy settings',
  pregnancySettingsLinkText: 'Pregnancy settings',

  pregnancyWeekRowLabel: (progress: string) => `Pregnancy week: ${progress}`,

  pregnancyDueDateRowLabel: (readableDate: string, source: string) =>
    `Estimated due date: ${readableDate}, ${source}`,

  shownWeekLabel: (week: number) => `Showing week ${week}`,

  shownWeekTitle: (week: number) => `Week ${week}`,

  thisWeekLabel: (highlight: string) => `This week: ${highlight}`,

  developmentsLabel: (features: readonly string[]) =>
    `Developing this week: ${features.join(', ')}`,

  pregnancySourceLabel: (name: string) => `Open the source ${name}`,

  pregnancySettingsTitle: 'Pregnancy settings',

  pregnancySettingsDescription:
    'You can correct the estimated due date, or go back to the one worked out from your ' +
    'last period.',

  pregnancySettingsLoadFailedMessage: 'Those pregnancy settings could not be loaded.',
  pregnancySettingsSaveFailedMessage: 'The estimated due date could not be updated.',
  pregnancySettingsEmptyMessage: 'No pregnancy is being followed.',
  pregnancyStopFailedMessage: 'That pregnancy could not be stopped.',

  pregnancyStopQuestion: 'Stop following this pregnancy?',
  pregnancyStopConsequence: 'Your pregnancy tracking information will be deleted.',

  pregnancyStopOpenLabel: 'Choose to stop following this pregnancy',
  pregnancyStopConfirmLabel: 'Stop following this pregnancy',
  pregnancyStopConfirmText: 'Stop tracking',
  pregnancyStoppingLabel: 'Stopping...',

  pregnancyEditDueDateLabel: 'Edit the estimated due date',
  pregnancyEditDueDateText: 'Edit the date',
  pregnancySaveDueDateLabel: 'Save the estimated due date',

  pregnancyBackToLmpLabel: 'Go back to the date worked out from your last period',
  pregnancyBackToLmpText: 'Back to the LMP date',

  pregnancySettingsPreviousDayLabel: 'Previous day',
  pregnancySettingsNextDayLabel: 'Next day',

  pregnancyLmpPrefix: 'Last period started:',

  selectedDueDateLabel: (readableDate: string) => `Estimated due date chosen: ${readableDate}`,
};

export const pregnancyLabels: Messages<PregnancyLabels> = {
  tr: pregnancyLabelsTr,
  en: pregnancyLabelsEn,
};

/**
 * How far along the pregnancy is, in words.
 *
 * A stored pregnancy whose last menstrual period has not arrived yet has no
 * progress to report. It says so rather than showing week 0 or a negative day,
 * and the due date beside it is still shown because that much is known.
 */
export function pregnancyProgressLabelIn(
  labels: PregnancyLabels,
  pregnancy: PregnancyDashboard
): string {
  if (pregnancy.pregnancyWeek === null) {
    return labels.notStartedMessage;
  }

  return labels.progress(pregnancy.pregnancyWeek.week, pregnancy.pregnancyWeek.day);
}

/**
 * The week's content in one line, for assistive technology.
 *
 * The size leads when there is one, because that is the part a screen reader
 * would otherwise have to reach the summary to get any sense of.
 */
export function weeklyHighlightIn(
  labels: PregnancyLabels,
  content: PregnancyWeeklyContent
): string {
  if (content.size === undefined) {
    return content.developmentSummary;
  }

  return labels.weeklyHighlightWithSize(
    content.size.label,
    content.size.comparison,
    content.developmentSummary
  );
}

/** Where the due date came from, so an adjusted one is not read as calculated. */
export function dueDateSourceLabelIn(
  labels: PregnancyLabels,
  source: PregnancyDueDateSource
): string {
  return source === 'adjusted' ? labels.dueDateAdjusted : labels.dueDateFromLmp;
}

/* ------------------------------------------------------------------------- */
/* The Turkish values under their original names, for the assertions that     */
/* already name them. Not for screens - see the note at the top of the file.  */
/* ------------------------------------------------------------------------- */

export const NOT_STARTED_MESSAGE = pregnancyLabelsTr.notStartedMessage;
export const PREGNANCY_START_TITLE = pregnancyLabelsTr.pregnancyStartTitle;
export const PREGNANCY_START_DESCRIPTION = pregnancyLabelsTr.pregnancyStartDescription;
export const PREGNANCY_START_LMP_LABEL = pregnancyLabelsTr.pregnancyStartLmpLabel;
export const PREGNANCY_START_PREVIOUS_DAY_LABEL =
  pregnancyLabelsTr.pregnancyStartPreviousDayLabel;
export const PREGNANCY_START_NEXT_DAY_LABEL = pregnancyLabelsTr.pregnancyStartNextDayLabel;
export const PREGNANCY_START_SUBMIT_LABEL = pregnancyLabelsTr.pregnancyStartSubmitLabel;
export const PREGNANCY_START_SUBMIT_TEXT = pregnancyLabelsTr.pregnancyStartSubmitText;
export const PREGNANCY_START_STARTING_LABEL = pregnancyLabelsTr.pregnancyStartStartingLabel;
export const PREGNANCY_START_FAILED_MESSAGE = pregnancyLabelsTr.pregnancyStartFailedMessage;
export const PREGNANCY_SECTION_TITLE = pregnancyLabelsTr.pregnancySectionTitle;
export const PREGNANCY_WEEK_LABEL = pregnancyLabelsTr.pregnancyWeekLabel;
export const PREGNANCY_DUE_DATE_LABEL = pregnancyLabelsTr.pregnancyDueDateLabel;
export const PREGNANCY_PREVIOUS_WEEK_LABEL = pregnancyLabelsTr.pregnancyPreviousWeekLabel;
export const PREGNANCY_NEXT_WEEK_LABEL = pregnancyLabelsTr.pregnancyNextWeekLabel;
export const PREGNANCY_BACK_TO_CURRENT_WEEK_LABEL =
  pregnancyLabelsTr.pregnancyBackToCurrentWeekLabel;
export const PREGNANCY_THIS_WEEK_TITLE = pregnancyLabelsTr.pregnancyThisWeekTitle;
export const PREGNANCY_DEVELOPMENTS_TITLE = pregnancyLabelsTr.pregnancyDevelopmentsTitle;
export const PREGNANCY_SOURCES_TITLE = pregnancyLabelsTr.pregnancySourcesTitle;
export const PREGNANCY_SETTINGS_LINK_LABEL = pregnancyLabelsTr.pregnancySettingsLinkLabel;
export const PREGNANCY_SETTINGS_LINK_TEXT = pregnancyLabelsTr.pregnancySettingsLinkText;
export const PREGNANCY_SETTINGS_TITLE = pregnancyLabelsTr.pregnancySettingsTitle;
export const PREGNANCY_SETTINGS_DESCRIPTION = pregnancyLabelsTr.pregnancySettingsDescription;
export const PREGNANCY_SETTINGS_LOAD_FAILED_MESSAGE =
  pregnancyLabelsTr.pregnancySettingsLoadFailedMessage;
export const PREGNANCY_SETTINGS_SAVE_FAILED_MESSAGE =
  pregnancyLabelsTr.pregnancySettingsSaveFailedMessage;
export const PREGNANCY_SETTINGS_EMPTY_MESSAGE =
  pregnancyLabelsTr.pregnancySettingsEmptyMessage;
export const PREGNANCY_STOP_FAILED_MESSAGE = pregnancyLabelsTr.pregnancyStopFailedMessage;
export const PREGNANCY_STOP_QUESTION = pregnancyLabelsTr.pregnancyStopQuestion;
export const PREGNANCY_STOP_CONSEQUENCE = pregnancyLabelsTr.pregnancyStopConsequence;
export const PREGNANCY_STOP_OPEN_LABEL = pregnancyLabelsTr.pregnancyStopOpenLabel;
export const PREGNANCY_STOP_CONFIRM_LABEL = pregnancyLabelsTr.pregnancyStopConfirmLabel;
export const PREGNANCY_STOP_CONFIRM_TEXT = pregnancyLabelsTr.pregnancyStopConfirmText;
export const PREGNANCY_STOPPING_LABEL = pregnancyLabelsTr.pregnancyStoppingLabel;
export const PREGNANCY_EDIT_DUE_DATE_LABEL = pregnancyLabelsTr.pregnancyEditDueDateLabel;
export const PREGNANCY_EDIT_DUE_DATE_TEXT = pregnancyLabelsTr.pregnancyEditDueDateText;
export const PREGNANCY_SAVE_DUE_DATE_LABEL = pregnancyLabelsTr.pregnancySaveDueDateLabel;
export const PREGNANCY_BACK_TO_LMP_LABEL = pregnancyLabelsTr.pregnancyBackToLmpLabel;
export const PREGNANCY_BACK_TO_LMP_TEXT = pregnancyLabelsTr.pregnancyBackToLmpText;
export const PREGNANCY_SETTINGS_PREVIOUS_DAY_LABEL =
  pregnancyLabelsTr.pregnancySettingsPreviousDayLabel;
export const PREGNANCY_SETTINGS_NEXT_DAY_LABEL =
  pregnancyLabelsTr.pregnancySettingsNextDayLabel;
export const PREGNANCY_LMP_PREFIX = pregnancyLabelsTr.pregnancyLmpPrefix;

export const selectedLmpLabel = pregnancyLabelsTr.selectedLmpLabel;
export const pregnancyWeekRowLabel = pregnancyLabelsTr.pregnancyWeekRowLabel;
export const shownWeekLabel = pregnancyLabelsTr.shownWeekLabel;
export const thisWeekLabel = pregnancyLabelsTr.thisWeekLabel;
export const developmentsLabel = pregnancyLabelsTr.developmentsLabel;
export const pregnancySourceLabel = pregnancyLabelsTr.pregnancySourceLabel;
export const selectedDueDateLabel = pregnancyLabelsTr.selectedDueDateLabel;

export function pregnancyDueDateRowLabel(readableDate: string, source: string): string {
  return pregnancyLabelsTr.pregnancyDueDateRowLabel(readableDate, source);
}

export function pregnancyProgressLabel(pregnancy: PregnancyDashboard): string {
  return pregnancyProgressLabelIn(pregnancyLabelsTr, pregnancy);
}

export function weeklyHighlight(content: PregnancyWeeklyContent): string {
  return weeklyHighlightIn(pregnancyLabelsTr, content);
}

export function dueDateSourceLabel(source: PregnancyDueDateSource): string {
  return dueDateSourceLabelIn(pregnancyLabelsTr, source);
}
