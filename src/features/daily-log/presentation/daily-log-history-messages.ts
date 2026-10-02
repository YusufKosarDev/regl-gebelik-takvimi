import type { Messages } from '@/i18n';

/**
 * What the daily log history screen says.
 *
 * ## Why the sentences are counts and never claims
 *
 * This screen is the first thing in the app that looks at several days at once
 * and says something about the pattern. Everything it says is a count of what
 * was recorded, phrased so it cannot be read as a cause: "12 of your 15 cramp
 * entries fell in the luteal phase" is a fact about the log, and "your cramps
 * are caused by your luteal phase" is a claim the app has no basis for and no
 * business making.
 *
 * The domain already refuses to offer a share below five days or one that only
 * describes how long a phase is. These words are the second half of that: no
 * "linked to", no "associated with", no "because", and the note under the list
 * says in as many words that this is what was written down rather than a
 * finding.
 */

const dailyLogHistoryMessagesTr = {
  /* --------------------------------------------------------- the screen -- */

  historyTitle: 'Kayıt geçmişin',
  historyDescription: 'Günlük kayıtlarının takvim üzerindeki dağılımı.',

  loadFailedMessage: 'Kayıt geçmişi yüklenemedi.',
  emptyMessage: 'Henüz günlük kayıt eklemedin. Bir gün ekledikçe burada görünür.',

  /* ------------------------------------------------------- the calendar -- */

  /** Which month is on screen, for the two arrows either side of it. */
  previousMonthLabel: 'Önceki ay',
  nextMonthLabel: 'Sonraki ay',

  /** A day with something written on it, for a screen reader. */
  markedDayLabel: (readableDate: string, summary: string) => `${readableDate}: ${summary}`,
  unmarkedDayLabel: (readableDate: string) => `${readableDate}: kayıt yok`,

  /** The dot drawn under a day that holds a record. */
  markedDayMarker: '•',

  /* -------------------------------------------------------- the summary -- */

  summaryTitle: 'Evrelere göre dağılım',

  /**
   * One line per symptom or mood worth mentioning.
   *
   * Two counts and a phase name. No verb that implies one thing produced the
   * other, in either language.
   */
  summaryLine: (label: string, dominantCount: number, placedCount: number, phaseLabel: string) =>
    `${label}: ${placedCount} kayıttan ${dominantCount} tanesi ${phaseLabel} evresine denk geldi.`,

  /** Said under the list, every time, whether or not there is a line above it. */
  summaryDisclaimer:
    'Bunlar yalnızca senin yazdıklarının sayımıdır, bir neden-sonuç ilişkisi değildir.',

  /**
   * Said when there are records but nothing stands out.
   *
   * A real answer rather than an empty list: "nothing stands out" is itself
   * information, and leaving the space blank would read as the screen having
   * failed.
   */
  summaryNothingNotable:
    'Kayıtlarında belirli bir evrede öne çıkan bir belirti ya da ruh hali yok.',

  /** Said when there are records but no period to place them against. */
  summaryUnplaced:
    'Kayıtlarının hangi evreye denk geldiğini gösterebilmek için en az bir regl kaydı gerekiyor.',
};

export type DailyLogHistoryMessages = typeof dailyLogHistoryMessagesTr;

const dailyLogHistoryMessagesEn: DailyLogHistoryMessages = {
  historyTitle: 'Your log history',
  historyDescription: 'How your daily records fall across the calendar.',

  loadFailedMessage: 'Your log history could not be loaded.',
  emptyMessage: 'You have not logged a day yet. Days you add show up here.',

  previousMonthLabel: 'Previous month',
  nextMonthLabel: 'Next month',

  markedDayLabel: (readableDate: string, summary: string) => `${readableDate}: ${summary}`,
  unmarkedDayLabel: (readableDate: string) => `${readableDate}: nothing logged`,

  markedDayMarker: '•',

  summaryTitle: 'Across the cycle',

  summaryLine: (label: string, dominantCount: number, placedCount: number, phaseLabel: string) =>
    `${label}: ${dominantCount} of your ${placedCount} entries fell in the ${phaseLabel} phase.`,

  summaryDisclaimer:
    'These are counts of what you wrote down, not a cause and effect.',

  summaryNothingNotable:
    'Nothing in your records stands out in one phase of the cycle.',

  summaryUnplaced:
    'At least one recorded period is needed before your entries can be placed in a phase.',
};

export const dailyLogHistoryMessages: Messages<DailyLogHistoryMessages> = {
  tr: dailyLogHistoryMessagesTr,
  en: dailyLogHistoryMessagesEn,
};
