import type { Messages } from '@/i18n';

/**
 * What the records summary says.
 *
 * ## What this screen is allowed to be
 *
 * A count of what somebody wrote down, and where those days fall in their
 * cycle. Nothing here is a finding about a body, and the wording carries that
 * rather than relying on the reader to remember it:
 *
 * - no verb implies that one thing produced another, in either language —
 *   `daily-log-history-messages-parity.test.ts` holds the same rule for the
 *   panel this screen opens from, and `records-summary-messages-parity.test.ts`
 *   holds it here;
 * - the disclaimer is shown every time, whether or not any section has
 *   anything in it, because it is about what the screen is rather than about
 *   any line on it;
 * - there is no word for how regular a cycle is. `build-cycle-outlook.ts`
 *   dropped `assessCycleRegularity` deliberately — "a label reading
 *   'irregular' beside it would be the app telling somebody something about
 *   their body, which is the one thing it does not do" — and a screen headed
 *   "summary" is exactly where that label would creep back in.
 *
 * ## Why the baseline is on screen and not just in the arithmetic
 *
 * The panel in the History tab prints one sentence per notable row: "12 of
 * your 15 entries fell in the luteal phase." That sentence is true and it is
 * also the most flattering reading of the data — it picks the phase with the
 * largest count and does not mention the other three, and it does not say that
 * the luteal phase is half of a typical cycle.
 *
 * `expectedShare` exists in the domain for precisely that reason, and until now
 * it was only used to decide whether to *print* the sentence. Showing all four
 * counts against the share each phase has of the recorded days says less, not
 * more: a reader can see for themselves that a distribution matching the
 * baseline is describing the shape of a cycle. That is the claim being reduced,
 * and it is why this screen exists at all.
 */

const recordsSummaryMessagesTr = {
  screenTitle: 'Kayıtlarının özeti',
  screenDescription: 'Yazdıklarının sayımı ve bunların döngüne göre dağılımı.',

  /** The link in the History tab's phase panel that opens this screen. */
  openLabel: 'Dökümü gör',

  baselineTitle: 'Karşılaştırma zemini',
  baselineNote:
    'Kayıtlı günlerinin evrelere dağılımı. Bir belirtinin dağılımı buna yakınsa, ' +
    'söylediği şey döngünün şekli.',

  phaseBreakdownTitle: 'Evrelere göre dağılım',

  /** One phase inside a bar's legend: its word and how many days fell in it. */
  phaseCount: (phase: string, days: number) => `${phase}: ${days} gün`,

  /** The row above each bar: what is being counted, and over how many days. */
  barHeading: (label: string, placed: number) => `${label} — ${placed} gün`,

  cycleLengthTitle: 'Döngü uzunluğu',
  cycleLengthMedian: (days: number) => `Medyan: ${days} gün`,
  cycleLengthShortest: (days: number) => `En kısa: ${days} gün`,
  cycleLengthLongest: (days: number) => `En uzun: ${days} gün`,
  cycleLengthSpread: (days: number) => `Aradaki fark: ${days} gün`,
  cycleLengthFrom: (gaps: number) => `${gaps} döngü aralığından`,
  cycleLengthDiscarded: (gaps: number) =>
    `${gaps} aralık hesaba katılmadı (olağandışı uzunlukta).`,
  cycleLengthNotEnough: 'Döngü uzunluğu için en az 3 kayıtlı regl başlangıcı gerekiyor.',

  flowTitle: 'Akış yoğunluğu',
  mostLoggedTitle: 'En çok yazdıkların',

  /**
   * Why a short bar is a number instead.
   *
   * The same five the domain uses, and the same reason in plainer words: the
   * length of a bar is read as a measurement, and four entries drawn as a bar
   * is a measurement of four things.
   */
  belowThresholdNote:
    'Beşten az kaydı olanlar için çubuk çizilmiyor: kısa bir çubuğun uzunluğu ' +
    'istatistik gibi okunuyor. Sayılar aşağıda.',

  countOnly: (label: string, days: number) => `${label}: ${days} gün`,

  emptyTitle: 'Henüz özetlenecek bir şey yok',
  emptyNote: 'Gün ekledikçe sayımlar ve dağılımlar burada görünür.',

  unplacedNote:
    'Günlerinin evrelere yerleştirilebilmesi için en az bir kayıtlı regl gerekiyor.',

  /** Said under everything, every time. */
  disclaimer:
    'Bunlar yalnızca senin yazdıklarının sayımıdır, bir neden-sonuç ilişkisi değildir.',
};

export type RecordsSummaryMessages = typeof recordsSummaryMessagesTr;

const recordsSummaryMessagesEn: RecordsSummaryMessages = {
  screenTitle: 'Your records, summarised',
  screenDescription: 'A count of what you wrote down, and how it falls across your cycle.',

  openLabel: 'See the breakdown',

  baselineTitle: 'The baseline',
  baselineNote:
    'How your recorded days fall across the phases. A symptom that matches this closely ' +
    'is describing the shape of a cycle.',

  phaseBreakdownTitle: 'By phase',

  phaseCount: (phase: string, days: number) => `${phase}: ${days} days`,

  barHeading: (label: string, placed: number) => `${label} — ${placed} days`,

  cycleLengthTitle: 'Cycle length',
  cycleLengthMedian: (days: number) => `Median: ${days} days`,
  cycleLengthShortest: (days: number) => `Shortest: ${days} days`,
  cycleLengthLongest: (days: number) => `Longest: ${days} days`,
  cycleLengthSpread: (days: number) => `Spread: ${days} days`,
  cycleLengthFrom: (gaps: number) => `From ${gaps} cycle gaps`,
  cycleLengthDiscarded: (gaps: number) => `${gaps} gaps were left out (an unusual length).`,
  cycleLengthNotEnough: 'Cycle length needs at least 3 recorded period starts.',

  flowTitle: 'Flow',
  mostLoggedTitle: 'What you write down most',

  belowThresholdNote:
    'No bar is drawn under five entries: the length of a short bar reads as a statistic. ' +
    'The counts are below.',

  countOnly: (label: string, days: number) => `${label}: ${days} days`,

  emptyTitle: 'Nothing to summarise yet',
  emptyNote: 'As you add days, the counts and distributions appear here.',

  unplacedNote:
    'At least one recorded period is needed before your days can be placed in a phase.',

  disclaimer: 'These are counts of what you wrote down, not a cause and effect.',
};

export const recordsSummaryMessages: Messages<RecordsSummaryMessages> = {
  tr: recordsSummaryMessagesTr,
  en: recordsSummaryMessagesEn,
};
