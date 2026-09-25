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
