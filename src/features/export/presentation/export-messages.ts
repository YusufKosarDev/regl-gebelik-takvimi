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

  /**
   * Said once, under the two buttons.
   *
   * Two buttons rather than one is not a design preference: the system share
   * sheet takes one file at a time. Saying so is better than letting somebody
   * press once and wonder where the other half went.
   */
  twoFilesNote: 'İki dosya ayrı ayrı paylaşılır: özet okumak için, CSV ise hesap tablosu için.',

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

  /* ------------------------------------------------------------ the files -- */

  summaryFileName: (isoDate: string) => `regl-ozeti-${isoDate}.txt`,
  csvFileName: (isoDate: string) => `regl-kayitlari-${isoDate}.csv`,
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

  twoFilesNote:
    'The two files are shared separately: the summary to read, the CSV for a spreadsheet.',

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

  summaryFileName: (isoDate: string) => `period-summary-${isoDate}.txt`,
  csvFileName: (isoDate: string) => `period-records-${isoDate}.csv`,
};

export const exportMessages: Messages<ExportMessages> = {
  tr: exportMessagesTr,
  en: exportMessagesEn,
};
