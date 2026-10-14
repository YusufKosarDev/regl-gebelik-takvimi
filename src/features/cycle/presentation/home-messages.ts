import type { CycleCalendarDay } from '../application/build-cycle-calendar-month';
import type { CycleOutlook } from '../application/build-cycle-outlook';
import type { CycleDashboard } from '../application/get-cycle-dashboard';

import type { CycleLabels } from './cycle-labels';
import { cycleLabels, getCyclePhaseLabelIn, getFertilityLevelLabelIn } from './cycle-labels';

import type { Messages } from '@/i18n';
import type { Language } from '@/i18n/language';
import { formatDisplayDate } from '@/utils/format-date';

/**
 * What the home screen says about a cycle.
 *
 * Lifted out of the screen unchanged. These were declared beside the component
 * that used them, which was fine while it was the only one; the screen is
 * split into sections and a string every section can reach is better than the
 * same sentence typed twice.
 *
 * ## The two row builders take three things
 *
 * The catalogue for their own words, the phase and fertility catalogue for the
 * values inside them, and a language for the date. All three are the same fact
 * - which language is being shown - and the caller has it, because it picked a
 * catalogue with it.
 */

const homeMessagesTr = {
  loadErrorMessage: 'Bilgiler yüklenemedi.',
  saveErrorMessage: 'Regl başlangıcı kaydedilemedi.',
  endSaveErrorMessage: 'Regl bitişi kaydedilemedi.',
  emptyMessage: 'Döngü bilgisi bulunamadı.',

  /**
   * The way out of the empty home screen.
   *
   * The message above was the whole of it: a statement of the problem on a
   * screen that offered no way to solve it. This is also where the
   * onboarding's one question lands if somebody skips it, so it goes back to
   * exactly that screen rather than to a second version of it.
   */
  emptyActionLabel: 'Son regl tarihimi gir',
  sourceErrorMessage: 'Kaynak açılamadı.',
  supportDisclaimer: 'Bu bilgiler geneldir; kişiden kişiye ve aydan aya değişebilir.',
  fertilityDisclaimer:
    'Doğurganlık bilgileri tahminidir ve gebelikten korunma yöntemi olarak kullanılmamalıdır.',

  /* ------------------------------------------------------------ the rows -- */

  rowCycleDay: 'Döngü günü',
  rowCyclePhase: 'Döngü evresi',
  rowFertility: 'Doğurganlık tahmini',

  /**
   * The fertility row's value past the predicted period.
   *
   * Not `unknownLabel`. "Bilinmiyor" says the app looked and found nothing,
   * which is true before the first record and false here: past the horizon it
   * declines to estimate rather than failing to. The two states would
   * otherwise read identically, which is the collision the selected-day card
   * had and the History tab's two empty lines had before it.
   *
   * The label supplies the subject, so the value does not repeat "tahmin" -
   * "Doğurganlık tahmini: Bugüne ulaşmıyor" - and it says reach rather than
   * knowledge, the same thing the card says at greater length.
   *
   * "Bugüne" rather than "bu güne": these rows are always about today.
   * `summaryRowsIn` is built from the dashboard, and scrubbing the ring moves
   * the hero without moving them.
   *
   * The row below has its own version of declining - `nextPeriodStale`, for
   * records too old to compute from - and this is deliberately not that
   * sentence: they decline for different reasons and should not read as one.
   */
  fertilityBeyondHorizon: 'Bugüne ulaşmıyor',
  rowNextPeriod: 'Sonraki regl tahmini',

  /**
   * What a labelled row says when there is no cycle day: two words after
   * "Döngü günü:".
   *
   * It is a value in a row, and it is read in two places where a row is what
   * it has to be - the home screen's summary and the calendar's card for a
   * day somebody picked. The card can be about last March, so this cannot
   * say anything about what to do next; it reports, because a row is a place
   * where reporting is the job.
   *
   * The hero is the other case and has {@link noCycleDayMessage} instead. The
   * two were one string until a sentence written for the hero turned the
   * calendar's card into "Döngü günü: Gün sayısı ilk reglinle başlar".
   */
  cycleNotStarted: 'Henüz başlamadı',

  /**
   * What the hero says when there is no cycle day - standing where a 96 point
   * number would be, with no label over it.
   *
   * "Henüz başlamadı" was here first and reported a state: true, and the end
   * of the conversation. The screen it is on is somebody's first, and the one
   * thing missing is the record that makes a day number exist, so this says
   * where the count comes from instead.
   *
   * Not an instruction. There is no control in the hero to obey one - the
   * period button is below the fold - so it is written as how the app works
   * rather than as something to do.
   */
  noCycleDayMessage: 'Gün sayısı ilk reglinle başlar',
  cycleDayValue: (day: number) => `${day}. gün`,
  nextPeriodUnknown: 'Henüz hesaplanamıyor',

  /* ------------------------------------- when one day would claim too much -- */

  /**
   * The next period as a span, when the recorded cycles vary too much for a
   * single day to be honest.
   *
   * An en dash with spaces around it rather than a hyphen: the two dates are
   * long and the separator has to survive being read aloud as well as looked
   * at.
   */
  nextPeriodRangeValue: (earliest: string, latest: string) => `${earliest} – ${latest}`,

  /** Why a span is being shown where a date usually is. */
  irregularCycleNote:
    'Kayıtlarındaki döngü süreleri değişkenlik gösterdiği için tek bir gün yerine aralık gösteriliyor.',

  /**
   * What is said when the last recorded period is too old to count forward
   * from.
   *
   * Not "unknown": the app knows perfectly well what the arithmetic would say
   * and is choosing not to say it, which is a different thing and deserves
   * different words. The note that follows is the way out, because a screen
   * that only reports a dead end is worse than one that says what to do.
   */
  /**
   * Said once the predicted day has gone by with nothing recorded.
   *
   * The row showed `predictNextPeriodStart` whatever the date was, so somebody
   * ten days late read "Sonraki regl tahmini: 4 Ekim 2026" on 14 October - a
   * prediction stated as fact after it had expired, directly under a fertility
   * row that had just declined to estimate and under a hero that had stopped
   * naming a phase. The one row nobody looked at, contradicting the two that
   * had been fixed.
   *
   * It turns on `isBeyondHorizon`, the same moment the hero and the card stop
   * at, so the three agree rather than each having a boundary of its own.
   *
   * Not `nextPeriodStale`, which is for records so old the arithmetic means
   * nothing and carries a note about adding a new one. This is the ordinary
   * case - a few days late - and says the opposite kind of thing: there was an
   * estimate and the day it named has passed.
   *
   * No note. The fertility row directly above already carries the
   * contraception one, and two stacked notes bury each other.
   *
   * The date is not kept. "4 Ekim 2026 geçti" would put a past date back under
   * a label that says estimate, which is the defect rather than a softer
   * version of it; the `≈` marks on the calendar still show where it fell.
   */
  nextPeriodExpectedDayPassed: 'Beklenen gün geçti',

  nextPeriodStale: 'Şimdilik tahmin edilemiyor',
  predictionStaleNote:
    'Son kaydının üzerinden uzun süre geçti. Yeni bir regl kaydı eklediğinde tahmin yeniden hesaplanır.',

  /* ------------------------------------------ the observed cycle length -- */

  /** The card that offers what the records show, against what is stored. */
  cycleLengthSuggestionTitle: 'Döngü süren değişmiş olabilir',
  cycleLengthSuggestionBody: (observedDays: number, settingDays: number, count: number) =>
    `Son ${count} döngün ortalama ${observedDays} gün sürmüş. Ayarında ${settingDays} gün yazıyor.`,
  cycleLengthSuggestionAcceptText: (observedDays: number) => `Ayarı ${observedDays} güne güncelle`,
  cycleLengthSuggestionAcceptLabel: (observedDays: number) =>
    `Ortalama döngü süresi ayarını ${observedDays} güne güncelle`,
  cycleLengthSuggestionDismissText: 'Şimdi değil',
  cycleLengthSuggestionDismissLabel: 'Bu öneriyi şimdilik gizle',
  cycleLengthSuggestionFailed: 'Ayar güncellenemedi.',

  /* --------------------------------------------------- the mode switch -- */

  cycleTabLabel: 'Döngü',
  pregnancyTabLabel: 'Gebelik',

  /**
   * What the Gebelik tab is called while there is no pregnancy to show.
   *
   * The segment is disabled until one exists, which is right - there is no
   * second view to switch to - but "disabled" is all a person got. Visually a
   * greyed word; to a screen reader "Gebelik, sekme, devre dışı", a state with
   * no reason attached. It cannot be pressed to find out why, because being
   * disabled is the thing being explained.
   *
   * So the reason goes in the label, between the name and the state, which is
   * where it answers the question "devre dışı" is about to raise.
   *
   * A condition, not an instruction: "başlattığında", not "başlat". There is
   * no control here to obey one - the way in is a row further down the same
   * tab - and a label that implied this segment could start a pregnancy would
   * be describing a button that does not exist.
   *
   * It echoes that row's own label, `pregnancyStartLinkLabel`, word for word,
   * rather than saying where it is. A name stays correct when the screen is
   * reordered and "below" does not.
   */
  pregnancyTabUnavailableLabel: 'Gebelik, gebelik takibini başlattığında kullanılabilir',

  /* ------------------------------------------------ the support section -- */

  supportMoodTitle: 'Olası ruh hali',
  supportMessageTitle: 'Bugünün mesajı',
  supportSourcesTitle: 'Kaynaklar',

  /** A source, as something to open. */
  openSourceLabel: (name: string) => `${name} kaynağını aç`,

  /* ---------------------------------------------------- the period card -- */

  periodEndQuestion: 'Bugünü regl bitişi olarak kaydetmek istiyor musun?',
  periodStartQuestion: 'Bugünü regl başlangıcı olarak kaydetmek istiyor musun?',

  periodCancelLabel: 'Vazgeç',
  periodSaveLabel: 'Kaydet',
  periodSavingLabel: 'Kaydediliyor...',

  periodEndButtonLabel: 'Regl bitişini kaydet',
  periodStartButtonLabel: 'Regl başlangıcını kaydet',
  periodEndButtonText: 'Regl bitti',
  periodStartButtonText: 'Regl başladı',

  /* ------------------------------------------------------- the calendar -- */

  calendarSectionTitle: 'Takvim',
  calendarPreviousMonthLabel: 'Önceki ay',
  calendarNextMonthLabel: 'Sonraki ay',
  calendarTodayLabel: 'Bugün',

  selectedDayTitle: 'Seçilen gün',
  selectedDayEmptyMessage: 'Bir gün seç.',
  predictedPeriodStartNote: 'Sonraki regl başlangıcı tahmini',
  predictedPeriodDayNote: 'Tahmini regl dönemine ait bir gün',

  /**
   * Said on the card for a day past the predicted period, under the cycle day
   * and in place of the phase and fertility rows.
   *
   * Those two rows used to read "Döngü evresi: Luteal, Doğurganlık tahmini:
   * Düşük" for a day in January, because `getCycleDay` counts from the last
   * recorded start and never rolls over - so the count climbed into the
   * eighties and `cycle-phase.ts` gives the luteal window no upper bound. Both
   * were confident and neither was true.
   *
   * The count itself stays and is said first. Somebody whose period is overdue
   * is looking at this screen for a reason, and the number of days since it
   * started is the one thing they came for; it is arithmetic from a record
   * rather than a guess about a cycle that has not happened. Leading with what
   * is there is also what keeps this from reading as an error.
   *
   * One sentence rather than two rows of "Bilinmiyor": two unknowns say less
   * than one line that explains the limit, which is what the History tab's
   * empty lines were about.
   *
   * "Gün sayısı" is the hero's word for the same thing - `noCycleDayMessage`
   * says "Gün sayısı ilk reglinle başlar" on somebody's first screen. The same
   * thing is called the same name here.
   *
   * It points at no action on purpose. What moves this horizon is a period
   * arriving and being recorded, which is nothing anybody does on a Tuesday,
   * and a line inviting somebody to record a period that has not happened
   * would be worse than saying nothing.
   */
  countContinuesMessage:
    'Gün sayısı sürüyor; tahminler bir sonraki reglinden öteye geçmiyor.',

  /** The month on screen, as something to read aloud. */
  calendarMonthLabel: (monthHeading: string) => `${monthHeading} takvimi`,

  /* ----------------------------------------- the links that are not tabs -- */

  /** The daily log, as against the period records that live in a tab now. */
  logHistoryLinkLabel: 'Günlük kayıt geçmişini görüntüle',
  logHistoryLinkText: 'Kayıt geçmişin',

  avatarCreateLabel: 'Avatar oluştur',
  avatarEditLabel: 'Avatarı düzenle',
  avatarLinkText: 'Avatarım',

  pregnancyStartLinkLabel: 'Gebelik takibini başlat',

  /* ---------------------------------------------------------- the legend -- */

  calendarEstimateNotice: 'Takvimdeki doğurganlık ve yumurtlama bilgileri tahminidir.',

  legendPeriodDay: 'Regl günü',
  legendOvulationDay: 'Tahmini yumurtlama günü',
  legendRaisedFertility: 'Doğurganlığın yüksek olduğu tahmini gün',
  /* The mark now sits on every day of the predicted period, so the legend
     describes the period rather than only its first day. Saying "expected to
     start" against five consecutive marks would be a legend that is wrong
     about four of them. */
  legendNextPeriod: 'Tahmini regl günleri',

  /** The letters drawn in the squares. They follow the language, not the code. */
  legendPeriodMarker: 'R',
  legendOvulationMarker: 'Y',

  /** `○` and `≈` read aloud are either nothing or noise, so they get words. */
  legendCircleSpoken: 'Daire',
  legendApproximatelySpoken: 'Yaklaşık işareti',

  /** One legend row, read as one thing. */
  legendItemLabel: (spokenMarker: string, label: string) => `${spokenMarker}: ${label}`,

  /**
   * A label and its value, as one line. Printed under the calendar, spoken in
   * the summary - the same words either way, so they are written once.
   */
  labelledValue: (label: string, value: string) => `${label}: ${value}`,

  /**
   * The calendar's column headers, Monday first.
   *
   * A fixed tuple per language rather than anything locale-driven: Intl is
   * unreliable on Hermes. It lives here rather than on the grid because it is
   * seven words drawn above a layout, not part of one - the grid's own comment
   * calls itself purely positional.
   *
   * Monday first in both, for now. Which day a week starts on is a device fact
   * rather than a language one - an English phone in Britain starts on Monday
   * and the same phone in the United States on Sunday - and
   * `getDeviceFirstWeekday()` already reads it. Following it means rewriting
   * the grid's padding arithmetic, which is deliberately not this stage.
   */
  weekdayLabels: ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as readonly string[],

  /** The heading over today's date, at the top of the screen. */
  todayHeading: 'Bugün',

  /**
   * Shown where the date is while a finger is dragging the arc.
   *
   * The date has to go for as long as the screen is showing some other day,
   * or the number above it reads as today's and the drag quietly lies.
   */
  scrubHeading: 'Bu döngü',

};

export type HomeMessages = typeof homeMessagesTr;

const homeMessagesEn: HomeMessages = {
  loadErrorMessage: 'That could not be loaded.',
  saveErrorMessage: 'The start of your period could not be saved.',
  endSaveErrorMessage: 'The end of your period could not be saved.',
  emptyMessage: 'No cycle information found.',

  emptyActionLabel: 'Enter my last period date',
  sourceErrorMessage: 'That source would not open.',
  supportDisclaimer:
    'This is general information; it varies from person to person and month to month.',
  fertilityDisclaimer:
    'Fertility information is an estimate and must not be used as a method of contraception.',

  rowCycleDay: 'Cycle day',
  rowCyclePhase: 'Cycle phase',
  rowFertility: 'Fertility estimate',
  fertilityBeyondHorizon: 'Does not reach today',
  rowNextPeriod: 'Next period estimate',

  cycleNotStarted: 'Not started yet',
  noCycleDayMessage: 'The day count starts with your first period',
  cycleDayValue: (day: number) => `Day ${day}`,
  nextPeriodUnknown: 'Cannot be worked out yet',

  nextPeriodRangeValue: (earliest: string, latest: string) => `${earliest} – ${latest}`,

  irregularCycleNote:
    'Your recorded cycle lengths vary, so a span is shown here instead of a single day.',

  nextPeriodExpectedDayPassed: 'The expected day has passed',
  nextPeriodStale: 'Cannot be estimated right now',
  predictionStaleNote:
    'It has been a long time since your last record. Add a new period and the estimate is worked out again.',

  cycleLengthSuggestionTitle: 'Your cycle length may have changed',
  cycleLengthSuggestionBody: (observedDays: number, settingDays: number, count: number) =>
    `Your last ${count} cycles averaged ${observedDays} days. Your setting says ${settingDays} days.`,
  cycleLengthSuggestionAcceptText: (observedDays: number) => `Update the setting to ${observedDays} days`,
  cycleLengthSuggestionAcceptLabel: (observedDays: number) =>
    `Update the average cycle length setting to ${observedDays} days`,
  cycleLengthSuggestionDismissText: 'Not now',
  cycleLengthSuggestionDismissLabel: 'Hide this suggestion for now',
  cycleLengthSuggestionFailed: 'The setting could not be updated.',

  cycleTabLabel: 'Cycle',
  pregnancyTabLabel: 'Pregnancy',
  pregnancyTabUnavailableLabel: 'Pregnancy, available once you start following a pregnancy',

  supportMoodTitle: 'How you might feel',
  supportMessageTitle: 'Today’s note',
  supportSourcesTitle: 'Sources',

  openSourceLabel: (name: string) => `Open the source ${name}`,

  periodEndQuestion: 'Record today as the end of your period?',
  periodStartQuestion: 'Record today as the start of your period?',

  periodCancelLabel: 'Cancel',
  periodSaveLabel: 'Save',
  periodSavingLabel: 'Saving...',

  periodEndButtonLabel: 'Record the end of your period',
  periodStartButtonLabel: 'Record the start of your period',
  periodEndButtonText: 'Period ended',
  periodStartButtonText: 'Period started',

  calendarSectionTitle: 'Calendar',
  calendarPreviousMonthLabel: 'Previous month',
  calendarNextMonthLabel: 'Next month',
  calendarTodayLabel: 'Today',

  selectedDayTitle: 'Selected day',
  selectedDayEmptyMessage: 'Pick a day.',
  predictedPeriodStartNote: 'Next period expected to start',
  predictedPeriodDayNote: 'A day of the expected period',

  countContinuesMessage:
    'The day count continues; estimates do not reach past your next period.',

  calendarMonthLabel: (monthHeading: string) => `Calendar for ${monthHeading}`,

  logHistoryLinkLabel: 'See your daily log history',
  logHistoryLinkText: 'Your log history',

  avatarCreateLabel: 'Create an avatar',
  avatarEditLabel: 'Edit your avatar',
  avatarLinkText: 'My avatar',

  pregnancyStartLinkLabel: 'Start following a pregnancy',

  calendarEstimateNotice:
    'The fertility and ovulation marks on this calendar are estimates.',

  legendPeriodDay: 'Period day',
  legendOvulationDay: 'Estimated day of ovulation',
  legendRaisedFertility: 'Estimated day of raised fertility',
  legendNextPeriod: 'Expected period days',

  legendPeriodMarker: 'P',
  legendOvulationMarker: 'O',

  legendCircleSpoken: 'Circle',
  legendApproximatelySpoken: 'Approximately sign',

  legendItemLabel: (spokenMarker: string, label: string) => `${spokenMarker}: ${label}`,

  labelledValue: (label: string, value: string) => `${label}: ${value}`,

  weekdayLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],

  todayHeading: 'Today',

  scrubHeading: 'This cycle',

};

export const homeMessages: Messages<HomeMessages> = { tr: homeMessagesTr, en: homeMessagesEn };

/**
 * `style` names the treatment the calendar gives the same day, so the swatch
 * beside it can look like the square it explains. `spokenMarker` exists because
 * "○" read aloud is either nothing or noise.
 */
export type LegendItem = {
  readonly marker: string;
  readonly spokenMarker: string;
  readonly label: string;
  readonly style: 'filled' | 'outlined' | 'soft' | 'plain';
};

/**
 * Only the marks a person can actually find on the calendar.
 *
 * The peak mark is left out on purpose. The peak day is by definition the
 * estimated ovulation day, and the calendar gives that day one treatment, so a
 * filled circle never appears in a month. Explaining a symbol that is not there
 * would send people looking for it.
 *
 * The two letters follow the language: a Turkish reader looks for R and Y, an
 * English one for P and O. They are drawn in the squares as well as in the
 * legend, so the two cannot be separated.
 */
export function legendItemsIn(messages: HomeMessages): readonly LegendItem[] {
  return [
    {
      marker: messages.legendPeriodMarker,
      spokenMarker: messages.legendPeriodMarker,
      label: messages.legendPeriodDay,
      style: 'filled',
    },
    {
      marker: messages.legendOvulationMarker,
      spokenMarker: messages.legendOvulationMarker,
      label: messages.legendOvulationDay,
      style: 'outlined',
    },
    {
      marker: '○',
      spokenMarker: messages.legendCircleSpoken,
      label: messages.legendRaisedFertility,
      style: 'soft',
    },
    {
      marker: '≈',
      spokenMarker: messages.legendApproximatelySpoken,
      label: messages.legendNextPeriod,
      style: 'plain',
    },
  ];
}

/**
 * The selected day's rows, read straight off the day the calendar already holds.
 *
 * No domain function is called again here: `CycleCalendarDay` carries everything
 * this card shows, so the card and the square it came from cannot disagree.
 *
 * ## Past the horizon it returns one row, not three
 *
 * The cycle day survives there and the phase and fertility do not, so asking
 * for all three would produce two rows of "Bilinmiyor" - honest and useless.
 * The caller says the rest in one sentence, `countContinuesMessage`.
 *
 * Dropped here rather than sliced off by the caller. A component that knows
 * which row index means what is a component that breaks when a row is added,
 * and this function exists precisely so one place decides what a day says.
 */
export function selectedDayRowsIn(
  messages: HomeMessages,
  labels: CycleLabels,
  day: CycleCalendarDay
): { label: string; value: string }[] {
  const cycleDayRow = {
    label: messages.rowCycleDay,
    value:
      day.cycleDay === null ? messages.cycleNotStarted : messages.cycleDayValue(day.cycleDay),
  };

  if (day.isBeyondHorizon) {
    return [cycleDayRow];
  }

  return [
    cycleDayRow,
    { label: messages.rowCyclePhase, value: getCyclePhaseLabelIn(labels, day.phase) },
    {
      label: messages.rowFertility,
      value: getFertilityLevelLabelIn(labels, day.fertilityLevel),
    },
  ];
}

/**
 * The four facts at the top of the home screen, read off today's summary.
 *
 * The same shape as {@link selectedDayRowsIn} and built the same way, with one
 * addition: the fertility row carries the note that says the estimate is not a
 * method of contraception. It travels with the row rather than being placed
 * near it, so the number and the warning about it cannot be separated.
 */
export type SummaryRow = { label: string; value: string; note?: string };

/**
 * A tuple rather than an array, and the length is load-bearing.
 *
 * The home screen destructures the first two rows out of this and hands them to
 * the ring, leaving the rest as rows. Typed as `SummaryRow[]` that destructure
 * compiles whatever the length is - including zero - and a change here would
 * surface as the ring rendering `undefined.label` on the screen a person opens
 * most. Four, stated, so shortening this list fails at the call site instead.
 */
export type SummaryRows = readonly [SummaryRow, SummaryRow, SummaryRow, SummaryRow];

export function summaryRowsIn(
  messages: HomeMessages,
  labels: CycleLabels,
  dashboard: CycleDashboard,
  language: Language,
  outlook?: CycleOutlook
): SummaryRows {
  return [
    {
      label: messages.rowCycleDay,
      value:
        dashboard.cycleDay === null
          ? messages.cycleNotStarted
          : messages.cycleDayValue(dashboard.cycleDay),
    },
    {
      label: messages.rowCyclePhase,
      value: getCyclePhaseLabelIn(labels, dashboard.phase),
    },
    {
      label: messages.rowFertility,
      // Past the horizon the level is null because the app declined to
      // estimate, not because it does not know - `fertilityBeyondHorizon` says
      // which. `getFertilityLevelLabelIn` keeps answering "unknown" for the
      // genuine one, which is what keeps the two tellable apart.
      //
      // The phase row above is left as it is. Past the horizon its value is
      // "Bilinmiyor" too, and nothing draws it: the hero takes that row and
      // uses it only for an accessibility label it skips when there is no
      // phase word. A second string for something nothing renders is how dead
      // copy accumulates.
      value: dashboard.isBeyondHorizon
        ? messages.fertilityBeyondHorizon
        : getFertilityLevelLabelIn(labels, dashboard.fertilityLevel),
      note: messages.fertilityDisclaimer,
    },
    nextPeriodRowIn(messages, dashboard, language, outlook),
  ];
}

/**
 * The next-period row, which is the only one with more than one thing to say.
 *
 * Three answers, in the order they override each other:
 *
 *   - **stale** - the last record is too old for the arithmetic to mean
 *     anything, so the date is withheld and the note says how to get it back.
 *     This beats everything else: a range built on a nine-month-old record is
 *     not more honest than a date built on one, only wider.
 *   - **ranged** - the recorded cycles vary too much for one day. The single
 *     predicted date is still what the calendar marks and the reminder is
 *     queued from, and `predictNextPeriodRange` guarantees it sits inside this
 *     span, so the two cannot contradict each other.
 *   - otherwise the date, exactly as before.
 *
 * `outlook` is optional and the row falls through to its old behaviour without
 * it. That is not politeness: `summaryRows` below is a crutch that existing
 * assertions call with four arguments, and a required parameter would stop it
 * compiling.
 */
function nextPeriodRowIn(
  messages: HomeMessages,
  dashboard: CycleDashboard,
  language: Language,
  outlook?: CycleOutlook
): SummaryRow {
  if (outlook?.predictionConfidence === 'stale') {
    return {
      label: messages.rowNextPeriod,
      value: messages.nextPeriodStale,
      note: messages.predictionStaleNote,
    };
  }

  // Before the range, deliberately. An irregular profile past the horizon
  // would otherwise be shown a span whose latest start has already gone by -
  // the contradiction `predicted-period-range.ts` warns about, arriving
  // through a different door.
  //
  // After the stale branch, equally deliberately: records older than
  // `STALE_PREDICTION_DAYS` keep their own message and the note that says how
  // to get a prediction back. That branch stays reachable; this one covers the
  // ordinary window between the predicted day passing and the records going
  // stale.
  if (dashboard.isBeyondHorizon) {
    return {
      label: messages.rowNextPeriod,
      value: messages.nextPeriodExpectedDayPassed,
    };
  }

  const range = outlook?.nextPeriodRange;

  if (range !== null && range !== undefined) {
    return {
      label: messages.rowNextPeriod,
      value: messages.nextPeriodRangeValue(
        formatDisplayDate(range.earliest, language),
        formatDisplayDate(range.latest, language)
      ),
      note: messages.irregularCycleNote,
    };
  }

  return {
    label: messages.rowNextPeriod,
    value:
      dashboard.nextPeriodStart === null
        ? messages.nextPeriodUnknown
        : formatDisplayDate(dashboard.nextPeriodStart, language),
  };
}

/* ------------------------------------------------------------------------- */
/* The Turkish values under their original names, for the assertions that     */
/* already name them. Not for screens - see the note at the top of the file.  */
/* ------------------------------------------------------------------------- */

export const LOAD_ERROR_MESSAGE = homeMessagesTr.loadErrorMessage;
export const SAVE_ERROR_MESSAGE = homeMessagesTr.saveErrorMessage;
export const END_SAVE_ERROR_MESSAGE = homeMessagesTr.endSaveErrorMessage;
export const EMPTY_MESSAGE = homeMessagesTr.emptyMessage;
export const SOURCE_ERROR_MESSAGE = homeMessagesTr.sourceErrorMessage;
export const SUPPORT_DISCLAIMER = homeMessagesTr.supportDisclaimer;
export const FERTILITY_DISCLAIMER = homeMessagesTr.fertilityDisclaimer;
export const CYCLE_TAB_LABEL = homeMessagesTr.cycleTabLabel;
export const PREGNANCY_TAB_LABEL = homeMessagesTr.pregnancyTabLabel;
export const SUPPORT_MOOD_TITLE = homeMessagesTr.supportMoodTitle;
export const SUPPORT_MESSAGE_TITLE = homeMessagesTr.supportMessageTitle;
export const SUPPORT_SOURCES_TITLE = homeMessagesTr.supportSourcesTitle;
export const PERIOD_END_QUESTION = homeMessagesTr.periodEndQuestion;
export const PERIOD_START_QUESTION = homeMessagesTr.periodStartQuestion;
export const PERIOD_CANCEL_LABEL = homeMessagesTr.periodCancelLabel;
export const PERIOD_SAVE_LABEL = homeMessagesTr.periodSaveLabel;
export const PERIOD_SAVING_LABEL = homeMessagesTr.periodSavingLabel;
export const PERIOD_END_BUTTON_LABEL = homeMessagesTr.periodEndButtonLabel;
export const PERIOD_START_BUTTON_LABEL = homeMessagesTr.periodStartButtonLabel;
export const PERIOD_END_BUTTON_TEXT = homeMessagesTr.periodEndButtonText;
export const PERIOD_START_BUTTON_TEXT = homeMessagesTr.periodStartButtonText;
export const CALENDAR_SECTION_TITLE = homeMessagesTr.calendarSectionTitle;
export const CALENDAR_PREVIOUS_MONTH_LABEL = homeMessagesTr.calendarPreviousMonthLabel;
export const CALENDAR_NEXT_MONTH_LABEL = homeMessagesTr.calendarNextMonthLabel;
export const CALENDAR_TODAY_LABEL = homeMessagesTr.calendarTodayLabel;
export const SELECTED_DAY_TITLE = homeMessagesTr.selectedDayTitle;
export const SELECTED_DAY_EMPTY_MESSAGE = homeMessagesTr.selectedDayEmptyMessage;
export const PREDICTED_PERIOD_START_NOTE = homeMessagesTr.predictedPeriodStartNote;
export const AVATAR_CREATE_LABEL = homeMessagesTr.avatarCreateLabel;
export const AVATAR_EDIT_LABEL = homeMessagesTr.avatarEditLabel;
export const AVATAR_LINK_TEXT = homeMessagesTr.avatarLinkText;
export const PREGNANCY_START_LINK_LABEL = homeMessagesTr.pregnancyStartLinkLabel;
export const CALENDAR_ESTIMATE_NOTICE = homeMessagesTr.calendarEstimateNotice;
export const TODAY_HEADING = homeMessagesTr.todayHeading;

export const LEGEND_ITEMS = legendItemsIn(homeMessagesTr);

export const openSourceLabel = homeMessagesTr.openSourceLabel;
export const calendarMonthLabel = homeMessagesTr.calendarMonthLabel;
export const labelledValue = homeMessagesTr.labelledValue;

export function legendItemLabel(item: LegendItem): string {
  return homeMessagesTr.legendItemLabel(item.spokenMarker, item.label);
}

export function selectedDayRows(day: CycleCalendarDay): { label: string; value: string }[] {
  return selectedDayRowsIn(homeMessagesTr, cycleLabels.tr, day);
}

export function summaryRows(dashboard: CycleDashboard, language: Language): SummaryRows {
  return summaryRowsIn(homeMessagesTr, cycleLabels.tr, dashboard, language);
}
