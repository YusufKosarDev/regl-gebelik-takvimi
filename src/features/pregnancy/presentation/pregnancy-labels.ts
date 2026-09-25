import type { PregnancyDashboard } from '../application/get-pregnancy-dashboard';
import type { PregnancyDueDateSource, PregnancyWeeklyContent } from '../domain/types';

/**
 * What the home screen says about a pregnancy, in Turkish.
 *
 * Lifted out of the screen unchanged, so the pregnancy section can be a
 * component of its own without taking its sentences with it as props.
 */

export const NOT_STARTED_MESSAGE = 'Gebelik başlangıç tarihi henüz gelmedi.';

/**
 * How far along the pregnancy is, in words.
 *
 * A stored pregnancy whose last menstrual period has not arrived yet has no
 * progress to report. It says so rather than showing week 0 or a negative day,
 * and the due date beside it is still shown because that much is known.
 */
export function pregnancyProgressLabel(pregnancy: PregnancyDashboard): string {
  if (pregnancy.pregnancyWeek === null) {
    return NOT_STARTED_MESSAGE;
  }

  return `${pregnancy.pregnancyWeek.week}. hafta ${pregnancy.pregnancyWeek.day}. gün`;
}

/**
 * The week's content in one line, for assistive technology.
 *
 * The size leads when there is one, because that is the part a screen reader
 * would otherwise have to reach the summary to get any sense of.
 */
export function weeklyHighlight(content: PregnancyWeeklyContent): string {
  if (content.size === undefined) {
    return content.developmentSummary;
  }

  return `${content.size.label} — ${content.size.comparison}. ${content.developmentSummary}`;
}

/** Where the due date came from, so an adjusted one is not read as calculated. */
export function dueDateSourceLabel(source: PregnancyDueDateSource): string {
  return source === 'adjusted' ? 'Düzeltilmiş tarih' : 'Son regl tarihine göre';
}

/* ------------------------------------------------ starting to track -- */

/**
 * The screen that begins a pregnancy, in Turkish.
 *
 * Moved out of `app/(app)/pregnancy-start.tsx` verbatim.
 */

export const PREGNANCY_START_TITLE = 'Gebelik takibini başlat';

export const PREGNANCY_START_DESCRIPTION =
  'Son regl döneminin başladığı günü seç. Gebelik haftaları ve tahmini doğum ' +
  'tarihi bu güne göre hesaplanır.';

export const PREGNANCY_START_LMP_LABEL = 'Son regl başlangıcı';

export const PREGNANCY_START_PREVIOUS_DAY_LABEL = 'Önceki gün';
export const PREGNANCY_START_NEXT_DAY_LABEL = 'Sonraki gün';

/** The button says what it does; the label says what it is for. */
export const PREGNANCY_START_SUBMIT_LABEL = 'Gebelik takibini başlat';
export const PREGNANCY_START_SUBMIT_TEXT = 'Takibi başlat';
export const PREGNANCY_START_STARTING_LABEL = 'Başlatılıyor...';

export const PREGNANCY_START_FAILED_MESSAGE = 'Gebelik takibi başlatılamadı.';

/** The chosen day, read as what it is rather than as a bare date. */
export function selectedLmpLabel(readableDate: string): string {
  return `Seçilen son regl başlangıcı: ${readableDate}`;
}

/* --------------------------------------------- the section on home -- */

/**
 * What the pregnancy half of the home screen says, in Turkish.
 *
 * Moved out of `pregnancy/components/pregnancy-section.tsx` verbatim.
 */

export const PREGNANCY_SECTION_TITLE = 'Gebelik takibi';

export const PREGNANCY_WEEK_LABEL = 'Gebelik haftası';
export const PREGNANCY_DUE_DATE_LABEL = 'Tahmini doğum tarihi';

export const PREGNANCY_PREVIOUS_WEEK_LABEL = 'Önceki hafta';
export const PREGNANCY_NEXT_WEEK_LABEL = 'Sonraki hafta';
export const PREGNANCY_BACK_TO_CURRENT_WEEK_LABEL = 'Bugünkü haftaya dön';

export const PREGNANCY_THIS_WEEK_TITLE = 'Bu hafta';
export const PREGNANCY_DEVELOPMENTS_TITLE = 'Bu hafta gelişenler';
export const PREGNANCY_SOURCES_TITLE = 'Kaynaklar';

export const PREGNANCY_SETTINGS_LINK_LABEL = 'Gebelik ayarlarını düzenle';
export const PREGNANCY_SETTINGS_LINK_TEXT = 'Gebelik ayarları';

/** The week, spoken as a label and its value. */
export function pregnancyWeekRowLabel(progress: string): string {
  return `Gebelik haftası: ${progress}`;
}

/**
 * The due date with where it came from.
 *
 * The trailing space belongs to the label: the source is appended to it, so
 * "tarihi: 23 Nisan 2027, Son regl tarihine göre" reads as one sentence.
 */
export function pregnancyDueDateRowLabel(readableDate: string, source: string): string {
  return `Tahmini doğum tarihi: ${readableDate}, ` + source;
}

/** Which week is on screen, for the stepper. */
export function shownWeekLabel(week: number): string {
  return `Gösterilen hafta: ${week}. hafta`;
}

/** The week's content in one line, so a reader hears it without the layout. */
export function thisWeekLabel(highlight: string): string {
  return `Bu hafta: ${highlight}`;
}

/** The bullets, joined, so they are heard as one list rather than five items. */
export function developmentsLabel(features: readonly string[]): string {
  return `Bu hafta gelişenler: ${features.join(', ')}`;
}

/** A source, as something to open. */
export function pregnancySourceLabel(name: string): string {
  return `${name} kaynağını aç`;
}
