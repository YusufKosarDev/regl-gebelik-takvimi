import type { Messages } from '@/i18n';

/**
 * What the export screen says, and what goes in the readable summary.
 *
 * ## Why the summary is written here and not in `domain/`
 *
 * It is prose, in a chosen language, for a person to read - and what belongs in
 * it is an editorial decision rather than a rule about the data. "What a doctor
 * wants to see at an appointment" is a judgement; "a row per day" is not.
 *
 * ## Why the file names are here too
 *
 * They differ between the languages, and they have to stay ASCII. A share sheet
 * hands the name to whatever app receives it - a mail client, a messaging app, a
 * file manager - and a non-ASCII attachment name is a real-world hazard in all
 * three. Turkish characters are spelled out rather than accented for exactly
 * that reason, which is why `summaryFileName` is in the parity test's identical
 * list only where the two halves genuinely coincide.
 */

const exportMessagesTr = {
  /* --------------------------------------------------------- the screen -- */

  exportTitle: 'Verilerini dışa aktar',
  exportDescription:
    'Kayıtlarını telefonundan çıkarabilirsin. Dosya paylaştıktan sonra uygulamanın '
    + 'denetiminden çıkar; nereye gittiğine sen karar verirsin.',

  summaryButtonText: 'Okunur özeti paylaş',
  summaryButtonLabel: 'Kayıtlarının okunur özetini paylaş',
  csvButtonText: 'Ham veriyi (CSV) paylaş',
  csvButtonLabel: 'Kayıtlarının tamamını CSV dosyası olarak paylaş',
  pdfButtonText: 'Yazdırılabilir PDF paylaş',
  pdfButtonLabel: 'Kayıtlarının özetini yazdırılabilir PDF olarak paylaş',

  /**
   * Said once, under the three buttons.
   *
   * Three buttons rather than one is not a design preference: the system share
   * sheet takes one file at a time. Saying so is better than letting somebody
   * press once and wonder where the other two went.
   *
   * The `.txt` stays alongside the PDF rather than being replaced by it. It is
   * the one of the three that depends on no renderer: `printToFileAsync` hands
   * the HTML to the platform's WebView, and when that fails there has to be a
   * readable format left.
   *
   * The three are listed in the order the buttons are in. Somebody reading this
   * note looks down at the buttons to find the one it is describing, and a list
   * that runs the other way makes them do the matching themselves.
   */
  threeFilesNote:
    'Üç dosya ayrı ayrı paylaşılır: özet okumak için, CSV hesap tablosu için, '
    + 'PDF ise yazdırmak için.',

  preparingMessage: 'Hazırlanıyor...',
  shareFailedMessage: 'Dosya paylaşılamadı.',
  sharingUnavailableMessage: 'Bu cihazda paylaşım kullanılamıyor.',
  emptyMessage: 'Dışa aktarılacak bir kayıt yok.',

  /* -------------------------------------------------- the readable summary -- */

  summaryHeading: 'Regl ve gebelik kayıtları',
  summaryGeneratedOn: (readableDate: string) => `Çıkarıldığı tarih: ${readableDate}`,

  summaryCycleHeading: 'Döngü ayarları',
  summaryCycleLengths: (cycleDays: number, periodDays: number) =>
    `Ortalama döngü süresi ${cycleDays} gün, ortalama regl süresi ${periodDays} gün.`,
  summaryObservedLength: (medianDays: number, count: number) =>
    `Kayıtlardan ölçülen: son ${count} döngünün ortancası ${medianDays} gün.`,
  summaryObservedRange: (shortestDays: number, longestDays: number) =>
    `En kısa ${shortestDays} gün, en uzun ${longestDays} gün.`,
  summaryNoObservations: 'Ölçüm yapmaya yetecek kadar kayıt yok.',

  summaryRecordsHeading: 'Regl kayıtları',
  summaryRecordLine: (startDate: string, endDate: string) => `${startDate} – ${endDate}`,
  summaryRecordOngoing: (startDate: string) => `${startDate} – devam ediyor`,
  summaryRecordUnknownEnd: (startDate: string) => `${startDate} – bitiş bilinmiyor`,
  summaryNoRecords: 'Kayıtlı regl yok.',

  summaryLogHeading: 'Günlük kayıtlar',
  summaryLogCount: (dayCount: number) => `${dayCount} gün için kayıt var.`,
  summaryNoLog: 'Günlük kayıt yok.',

  summaryFooter:
    'Bu özet uygulamadaki kayıtlardan üretilmiştir ve tıbbi bir değerlendirme değildir.',

  /* ------------------------------------------------- what the PDF adds -- */

  /**
   * The sentences the printable document needs and the `.txt` does not.
   *
   * All of them exist because a document arrives without the app. Nobody can
   * tap through to context, the reader may never have seen the app, and a
   * typeset page reads as a report where the same words in a `.txt` read as a
   * dump - the form makes a claim the content does not. So the page says, in
   * words, the three things the app says structurally everywhere else:
   *
   *   - what it is (`pdfIntro`), because the footer alone comes too late;
   *   - which numbers a person entered and which the device worked out
   *     (`pdfEnteredNote`, `pdfRecordedNote`, `pdfCountsNote`). The CSV can
   *     leave this to its column names - `cycle_day` and `phase` are the
   *     worked-out ones - and a page has no column names;
   *   - what is missing and why (`pdfCountsBelowFloor`, `pdfCountsNone`),
   *     which is `build-export-rows.ts`'s "an empty cell means the app has
   *     nothing to say" in a format that has no cells.
   */
  pdfIntro:
    'Bu belge bir telefon uygulamasındaki kayıtlardan üretildi. İçindeki her şey '
    + 'ya girilen bir kayıt ya da o kayıtların sayımıdır.',

  pdfEnteredNote: 'İlk satır ayarlardan girildi. Varsa altındaki satırlar kayıtlardan hesaplandı.',
  pdfRecordedNote: 'Tarihler girildiği gibi, en yeniden en eskiye.',

  pdfCountsHeading: 'Yazılan belirtiler ve ruh halleri',

  /**
   * `most-logged.ts` wrote this rule for the screen; the document is where it
   * would be broken. "Cramps, eleven days" is a count of what somebody wrote
   * down, not a measure of how often they had cramps.
   */
  pdfCountsNote:
    'Bunlar bir şeyin kaç gün yazıldığının sayımıdır; ne sıklıkta yaşandığının ölçümü değil.',

  pdfCountLine: (label: string, days: number) => `${label} — ${days} gün`,

  /**
   * Why the short counts are absent, and where the complete record is.
   *
   * The floor is the five the daily-log domain already uses. The screen shows
   * counts under it, as plain numbers, and can afford to: a reader there can
   * look at the rest of the screen. A page cannot be asked a follow-up
   * question, so it carries only the counts the app elsewhere treats as enough
   * to mention - and says where the others are rather than dropping them in
   * silence.
   */
  pdfCountsBelowFloor:
    'Beşten az güne yazılanlar bu listede yok. Günü gününe kayıtların tamamı CSV dosyasında.',

  pdfCountsNone: 'Beş ya da daha fazla güne yazılmış bir belirti ya da ruh hali yok.',

  /* ------------------------------------------------------------ the files -- */

  summaryFileName: (isoDate: string) => `regl-ozeti-${isoDate}.txt`,
  csvFileName: (isoDate: string) => `regl-kayitlari-${isoDate}.csv`,
  pdfFileName: (isoDate: string) => `regl-ozeti-${isoDate}.pdf`,
};

export type ExportMessages = typeof exportMessagesTr;

const exportMessagesEn: ExportMessages = {
  exportTitle: 'Export your data',
  exportDescription:
    'You can take your records off this phone. Once a file is shared it leaves the app’s '
    + 'control; where it goes is your decision.',

  summaryButtonText: 'Share the readable summary',
  summaryButtonLabel: 'Share a readable summary of your records',
  csvButtonText: 'Share the raw data (CSV)',
  csvButtonLabel: 'Share all of your records as a CSV file',
  pdfButtonText: 'Share a printable PDF',
  pdfButtonLabel: 'Share a summary of your records as a printable PDF',

  threeFilesNote:
    'The three files are shared separately: the summary to read, the CSV for a '
    + 'spreadsheet, the PDF to print.',

  preparingMessage: 'Preparing…',
  shareFailedMessage: 'That file could not be shared.',
  sharingUnavailableMessage: 'Sharing is not available on this device.',
  emptyMessage: 'There is nothing to export yet.',

  summaryHeading: 'Period and pregnancy records',
  summaryGeneratedOn: (readableDate: string) => `Taken on: ${readableDate}`,

  summaryCycleHeading: 'Cycle settings',
  summaryCycleLengths: (cycleDays: number, periodDays: number) =>
    `Average cycle length ${cycleDays} days, average period length ${periodDays} days.`,
  summaryObservedLength: (medianDays: number, count: number) =>
    `Measured from the records: the median of the last ${count} cycles is ${medianDays} days.`,
  summaryObservedRange: (shortestDays: number, longestDays: number) =>
    `Shortest ${shortestDays} days, longest ${longestDays} days.`,
  summaryNoObservations: 'There are not enough records to measure from.',

  summaryRecordsHeading: 'Period records',
  summaryRecordLine: (startDate: string, endDate: string) => `${startDate} – ${endDate}`,
  summaryRecordOngoing: (startDate: string) => `${startDate} – still going`,
  summaryRecordUnknownEnd: (startDate: string) => `${startDate} – end not known`,
  summaryNoRecords: 'No periods recorded.',

  summaryLogHeading: 'Daily records',
  summaryLogCount: (dayCount: number) => `There are records for ${dayCount} days.`,
  summaryNoLog: 'No days logged.',

  summaryFooter:
    'This summary was produced from the records in the app and is not a medical assessment.',

  pdfIntro:
    'This document was produced from the records kept in a phone app. Everything in it '
    + 'is either a record somebody entered or a count of those records.',

  pdfEnteredNote:
    'The first line was entered in the settings. Any lines below it were worked out '
    + 'from the records.',
  pdfRecordedNote: 'The dates as they were entered, newest first.',

  pdfCountsHeading: 'Symptoms and moods written down',

  pdfCountsNote:
    'These are counts of how many days something was written down, not a measurement '
    + 'of how often it happened.',

  pdfCountLine: (label: string, days: number) => `${label} — ${days} days`,

  pdfCountsBelowFloor:
    'Anything written on fewer than five days is not in this list. The complete '
    + 'day-by-day records are in the CSV file.',

  pdfCountsNone: 'Nothing was written down on five or more days.',

  summaryFileName: (isoDate: string) => `period-summary-${isoDate}.txt`,
  csvFileName: (isoDate: string) => `period-records-${isoDate}.csv`,
  pdfFileName: (isoDate: string) => `period-summary-${isoDate}.pdf`,
};

export const exportMessages: Messages<ExportMessages> = {
  tr: exportMessagesTr,
  en: exportMessagesEn,
};
