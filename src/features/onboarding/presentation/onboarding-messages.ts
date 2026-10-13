import type { Messages } from '@/i18n';
import { plural } from '@/i18n';

/**
 * Everything the onboarding flow says.
 *
 * The seven screens were written one at a time and kept their sentences inline,
 * which was fine while each was the only place its words appeared. They are one
 * flow, though, and three of them say "Devam" and four of them say the same
 * thing about invalid cycle information - so the words live together, where a
 * change to one of them is a change to all of them.
 *
 * ## Days are where the two languages stop matching
 *
 * Turkish does not pluralise a noun after a number: "1 gün" and "3 gün". English
 * does. So `DAYS_UNIT` is a bare unit on one side and cannot be on the other,
 * and the three messages that count days call `plural` in English and simply
 * interpolate in Turkish. That is the shape the catalogue pair exists to allow -
 * the English half is free to be a different sentence, not a translated
 * placeholder.
 */

const onboardingMessagesTr = {
  /* ----------------------------------------------------------- welcome -- */

  welcomeTitle: 'Döngünü birlikte takip edelim',

  welcomeDescription:
    'Regl döngünü anlamana, tahmini dönemlerini takip etmene ve günlük değişimleri ' +
    'daha kolay görmene yardımcı olacağız.',

  welcomeNote:
    'Tahminler geçmiş döngü bilgilerine dayanır ve tıbbi tavsiye yerine geçmez.',

  welcomeStartLabel: 'Başlayalım',
  welcomeStartHint: 'Başlamadan önce bilinmesi gerekenlere geçer',

  /* -------------------------------------------------------- disclaimer -- */

  disclaimerContinueLabel: 'Devam et',
  disclaimerContinueHint: 'Döngü ayarlarını girmeye geçer',

  /* ----------------------------------------------------- shared by four -- */

  /**
   * Shown when a screen is reached without the answers the ones before it
   * collect. Four screens can be arrived at that way and all four said the same
   * sentence.
   */
  invalidCycleInfoMessage: 'Geçersiz döngü bilgisi.',

  /** The step forward, on three screens. */
  continueLabel: 'Devam',

  /**
   * The unit under the two number pickers, which draw the number above it.
   *
   * It takes the count even though Turkish never uses it: the word is 'gün'
   * whatever the number, and 'day' or 'days' depending on it. A bare string
   * would have been a Turkish shape forced onto English.
   */
  daysUnit: (_days: number) => 'gün',

  /* ---------------------------------------------------- cycle settings -- */

  cycleLengthTitle: 'Döngün ortalama kaç gün sürüyor?',


  cycleLengthDecreaseLabel: 'Döngü uzunluğunu azalt',
  cycleLengthIncreaseLabel: 'Döngü uzunluğunu artır',

  /** What the picker reads as, to a screen reader. */
  cycleLengthValueLabel: (cycleLength: number) =>
    `Ortalama döngü uzunluğu: ${cycleLength} gün`,

  /* ----------------------------------------------------- period length -- */

  periodLengthTitle: 'Regl dönemin ortalama kaç gün sürüyor?',


  periodLengthDecreaseLabel: 'Regl süresini azalt',
  periodLengthIncreaseLabel: 'Regl süresini artır',

  periodLengthValueLabel: (periodLength: number) =>
    `Ortalama regl süresi: ${periodLength} gün`,

  /* -------------------------------------------------------- last period -- */

  lastPeriodTitle: 'Son regl dönemin ne zaman başladı?',
  lastPeriodDescription: 'Kanamanın başladığı ilk günü seç.',

  /**
   * The way past the one question the flow asks.
   *
   * Somebody may not know, and the two answers to that were both bad: invent
   * a date, which puts a cycle day on the home screen that nobody supplied,
   * or refuse to finish, which leaves them with no app. This saves the
   * settings with no period recorded, and the home screen catches it with the
   * way back to this question.
   */
  lastPeriodSkipLabel: 'Bilmiyorum',

  lastPeriodPreviousDayLabel: 'Önceki günü seç',
  lastPeriodNextDayLabel: 'Sonraki günü seç',
  lastPeriodPreviousDayText: 'Önceki gün',
  lastPeriodNextDayText: 'Sonraki gün',

  /**
   * The coarse step, beside the day one.
   *
   * The screen steps a day at a time because a period start is almost always
   * within a few days of today, which is true and covers most people. It left
   * the rest with ninety taps to reach three months back, or "Bilmiyorum" -
   * which records nothing at all. These are the same control at a coarser
   * step, not a different one: same words, "gün" to "ay".
   */
  lastPeriodPreviousMonthLabel: 'Önceki ayı seç',
  lastPeriodNextMonthLabel: 'Sonraki ayı seç',
  lastPeriodPreviousMonthText: 'Önceki ay',
  lastPeriodNextMonthText: 'Sonraki ay',

  selectedDateLabel: (readableDate: string) => `Seçili tarih: ${readableDate}`,

  /* ------------------------------------------------------------- review -- */




  /** A row of the summary, read as one thing. */

  /** The two rows whose value is a count of days. */
  reviewDaysValue: (days: number) => `${days} gün`,

  /* ------------------------------------------------------------- finish -- */

  finishTitle: 'Her şey hazır',
  finishDescription: 'Bilgilerini kaydedip döngü takibine başlayabilirsin.',

  /**
   * What the flow assumed rather than asked.
   *
   * Two screens used to collect these, each pre-filled with the figure most
   * people would give. Dropping the screens is only honest if the app says
   * what it put in their place and where to change it - an app that quietly
   * decides somebody's cycle is twenty-eight days has not saved them a
   * screen, it has made something up on their behalf.
   */
  finishAssumed: (cycleLength: number, periodLength: number) =>
    `Döngünü ${cycleLength} gün, regl süreni ${periodLength} gün varsaydık. İkisini de Profil sekmesinden değiştirebilirsin.`,

  finishStartLabel: 'Takibe başla',
  finishSavingLabel: 'Kaydediliyor...',

  finishSaveFailedMessage: 'Bilgiler kaydedilemedi. Lütfen tekrar dene.',
};

export type OnboardingMessages = typeof onboardingMessagesTr;

const onboardingMessagesEn: OnboardingMessages = {
  welcomeTitle: 'Let us follow your cycle together',

  welcomeDescription:
    'We will help you understand your cycle, keep track of the periods it predicts, ' +
    'and see the changes from one day to the next more easily.',

  welcomeNote:
    'Predictions are based on your past cycles and are not a substitute for medical advice.',

  welcomeStartLabel: 'Get started',
  welcomeStartHint: 'Goes to what you should know before starting',

  disclaimerContinueLabel: 'Continue',
  disclaimerContinueHint: 'Goes to entering your cycle settings',

  invalidCycleInfoMessage: 'That cycle information is not valid.',

  continueLabel: 'Next',

  daysUnit: (days: number) => plural(days, 'day', 'days'),

  cycleLengthTitle: 'How many days does your cycle usually last?',


  cycleLengthDecreaseLabel: 'Decrease the cycle length',
  cycleLengthIncreaseLabel: 'Increase the cycle length',

  cycleLengthValueLabel: (cycleLength: number) =>
    `Average cycle length: ${plural(cycleLength, `${cycleLength} day`, `${cycleLength} days`)}`,

  periodLengthTitle: 'How many days does your period usually last?',


  periodLengthDecreaseLabel: 'Decrease the period length',
  periodLengthIncreaseLabel: 'Increase the period length',

  periodLengthValueLabel: (periodLength: number) =>
    `Average period length: ${plural(periodLength, `${periodLength} day`, `${periodLength} days`)}`,

  lastPeriodTitle: 'When did your last period start?',
  lastPeriodDescription: 'Pick the first day of bleeding.',

  lastPeriodSkipLabel: 'I do not know',

  lastPeriodPreviousDayLabel: 'Pick the previous day',
  lastPeriodNextDayLabel: 'Pick the next day',
  lastPeriodPreviousDayText: 'Previous day',
  lastPeriodNextDayText: 'Next day',

  lastPeriodPreviousMonthLabel: 'Pick the previous month',
  lastPeriodNextMonthLabel: 'Pick the next month',
  lastPeriodPreviousMonthText: 'Previous month',
  lastPeriodNextMonthText: 'Next month',

  selectedDateLabel: (readableDate: string) => `Selected date: ${readableDate}`,





  reviewDaysValue: (days: number) => plural(days, `${days} day`, `${days} days`),

  finishTitle: 'All set',
  finishDescription: 'Save what you entered and start following your cycle.',

  finishAssumed: (cycleLength: number, periodLength: number) =>
    `We have assumed a ${cycleLength}-day cycle and a ${periodLength}-day period. You can change both in the Profile tab.`,

  finishStartLabel: 'Start tracking',
  finishSavingLabel: 'Saving...',

  finishSaveFailedMessage: 'That could not be saved. Please try again.',
};

export const onboardingMessages: Messages<OnboardingMessages> = {
  tr: onboardingMessagesTr,
  en: onboardingMessagesEn,
};

/* ------------------------------------------------------------------------- */
/* The Turkish values under their original names, for the assertions that     */
/* already name them. Not for screens - see the note at the top of the file.  */
/* ------------------------------------------------------------------------- */

export const WELCOME_TITLE = onboardingMessagesTr.welcomeTitle;
export const WELCOME_DESCRIPTION = onboardingMessagesTr.welcomeDescription;
export const WELCOME_NOTE = onboardingMessagesTr.welcomeNote;
export const WELCOME_START_LABEL = onboardingMessagesTr.welcomeStartLabel;
export const WELCOME_START_HINT = onboardingMessagesTr.welcomeStartHint;
export const DISCLAIMER_CONTINUE_LABEL = onboardingMessagesTr.disclaimerContinueLabel;
export const DISCLAIMER_CONTINUE_HINT = onboardingMessagesTr.disclaimerContinueHint;
export const INVALID_CYCLE_INFO_MESSAGE = onboardingMessagesTr.invalidCycleInfoMessage;
export const CONTINUE_LABEL = onboardingMessagesTr.continueLabel;
export const CYCLE_LENGTH_TITLE = onboardingMessagesTr.cycleLengthTitle;
export const CYCLE_LENGTH_DECREASE_LABEL = onboardingMessagesTr.cycleLengthDecreaseLabel;
export const CYCLE_LENGTH_INCREASE_LABEL = onboardingMessagesTr.cycleLengthIncreaseLabel;
export const PERIOD_LENGTH_TITLE = onboardingMessagesTr.periodLengthTitle;
export const PERIOD_LENGTH_DECREASE_LABEL = onboardingMessagesTr.periodLengthDecreaseLabel;
export const PERIOD_LENGTH_INCREASE_LABEL = onboardingMessagesTr.periodLengthIncreaseLabel;
export const LAST_PERIOD_TITLE = onboardingMessagesTr.lastPeriodTitle;
export const LAST_PERIOD_DESCRIPTION = onboardingMessagesTr.lastPeriodDescription;
export const LAST_PERIOD_PREVIOUS_DAY_LABEL = onboardingMessagesTr.lastPeriodPreviousDayLabel;
export const LAST_PERIOD_NEXT_DAY_LABEL = onboardingMessagesTr.lastPeriodNextDayLabel;
export const LAST_PERIOD_PREVIOUS_DAY_TEXT = onboardingMessagesTr.lastPeriodPreviousDayText;
export const LAST_PERIOD_NEXT_DAY_TEXT = onboardingMessagesTr.lastPeriodNextDayText;
export const FINISH_TITLE = onboardingMessagesTr.finishTitle;
export const FINISH_DESCRIPTION = onboardingMessagesTr.finishDescription;
export const FINISH_START_LABEL = onboardingMessagesTr.finishStartLabel;
export const FINISH_SAVING_LABEL = onboardingMessagesTr.finishSavingLabel;
export const FINISH_SAVE_FAILED_MESSAGE = onboardingMessagesTr.finishSaveFailedMessage;

/** Kept as a bare unit for the assertions that name it; screens call `daysUnit`. */
export const DAYS_UNIT = onboardingMessagesTr.daysUnit(0);

export const cycleLengthValueLabel = onboardingMessagesTr.cycleLengthValueLabel;
export const periodLengthValueLabel = onboardingMessagesTr.periodLengthValueLabel;
export const selectedDateLabel = onboardingMessagesTr.selectedDateLabel;
export const reviewDaysValue = onboardingMessagesTr.reviewDaysValue;
