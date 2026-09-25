/**
 * Everything the onboarding flow says, in Turkish.
 *
 * The seven screens were written one at a time and kept their sentences inline,
 * which was fine while each was the only place its words appeared. They are one
 * flow, though, and three of them say "Devam" and four of them say the same
 * thing about invalid cycle information - so the words live together, where a
 * change to one of them is a change to all of them.
 *
 * Moved here verbatim. Not a word of this file is new.
 */

/* ------------------------------------------------------------- welcome -- */

export const WELCOME_TITLE = 'Döngünü birlikte takip edelim';

export const WELCOME_DESCRIPTION =
  'Regl döngünü anlamana, tahmini dönemlerini takip etmene ve günlük değişimleri ' +
  'daha kolay görmene yardımcı olacağız.';

export const WELCOME_NOTE =
  'Tahminler geçmiş döngü bilgilerine dayanır ve tıbbi tavsiye yerine geçmez.';

export const WELCOME_START_LABEL = 'Başlayalım';
export const WELCOME_START_HINT = 'Başlamadan önce bilinmesi gerekenlere geçer';

/* ---------------------------------------------------------- disclaimer -- */

export const DISCLAIMER_CONTINUE_LABEL = 'Devam et';
export const DISCLAIMER_CONTINUE_HINT = 'Döngü ayarlarını girmeye geçer';

/* ------------------------------------------------------- shared by four -- */

/**
 * Shown when a screen is reached without the answers the ones before it collect.
 *
 * Four screens can be arrived at that way and all four said the same sentence.
 */
export const INVALID_CYCLE_INFO_MESSAGE = 'Geçersiz döngü bilgisi.';

/** The step forward, on three screens. */
export const CONTINUE_LABEL = 'Devam';

/** The unit under the two number pickers. */
export const DAYS_UNIT = 'gün';

/* ------------------------------------------------------ cycle settings -- */

export const CYCLE_LENGTH_TITLE = 'Döngün ortalama kaç gün sürüyor?';

export const CYCLE_LENGTH_DESCRIPTION =
  'Bir regl döneminin ilk gününden, sonraki regl döneminin ilk gününe kadar geçen ' +
  'süre.';

export const CYCLE_LENGTH_DECREASE_LABEL = 'Döngü uzunluğunu azalt';
export const CYCLE_LENGTH_INCREASE_LABEL = 'Döngü uzunluğunu artır';

/** What the picker reads as, to a screen reader. */
export function cycleLengthValueLabel(cycleLength: number): string {
  return `Ortalama döngü uzunluğu: ${cycleLength} gün`;
}

/* ------------------------------------------------------ period length -- */

export const PERIOD_LENGTH_TITLE = 'Regl dönemin ortalama kaç gün sürüyor?';

export const PERIOD_LENGTH_DESCRIPTION =
  'Kanamanın başladığı ilk günden tamamen bittiği güne kadar geçen ortalama süre.';

export const PERIOD_LENGTH_DECREASE_LABEL = 'Regl süresini azalt';
export const PERIOD_LENGTH_INCREASE_LABEL = 'Regl süresini artır';

export function periodLengthValueLabel(periodLength: number): string {
  return `Ortalama regl süresi: ${periodLength} gün`;
}

/* --------------------------------------------------------- last period -- */

export const LAST_PERIOD_TITLE = 'Son regl dönemin ne zaman başladı?';
export const LAST_PERIOD_DESCRIPTION = 'Kanamanın başladığı ilk günü seç.';

export const LAST_PERIOD_PREVIOUS_DAY_LABEL = 'Önceki günü seç';
export const LAST_PERIOD_NEXT_DAY_LABEL = 'Sonraki günü seç';
export const LAST_PERIOD_PREVIOUS_DAY_TEXT = 'Önceki gün';
export const LAST_PERIOD_NEXT_DAY_TEXT = 'Sonraki gün';

export function selectedDateLabel(readableDate: string): string {
  return `Seçili tarih: ${readableDate}`;
}

/* -------------------------------------------------------------- review -- */

export const REVIEW_TITLE = 'Bilgilerini kontrol et';
export const REVIEW_DESCRIPTION = 'Devam etmeden önce döngü bilgilerini gözden geçir.';

export const REVIEW_CYCLE_LENGTH_LABEL = 'Döngü uzunluğu';
export const REVIEW_PERIOD_LENGTH_LABEL = 'Regl süresi';
export const REVIEW_LAST_PERIOD_LABEL = 'Son regl başlangıcı';

export const REVIEW_CONFIRM_LABEL = 'Bilgiler doğru';
export const REVIEW_EDIT_LABEL = 'Bilgileri düzenle';

/** A row of the summary, read as one thing. */
export function reviewRowLabel(label: string, value: string): string {
  return `${label}: ${value}`;
}

/** The two rows whose value is a count of days. */
export function reviewDaysValue(days: number): string {
  return `${days} gün`;
}

/* -------------------------------------------------------------- finish -- */

export const FINISH_TITLE = 'Her şey hazır';
export const FINISH_DESCRIPTION = 'Bilgilerini kaydedip döngü takibine başlayabilirsin.';

export const FINISH_START_LABEL = 'Takibe başla';
export const FINISH_SAVING_LABEL = 'Kaydediliyor...';

export const FINISH_SAVE_FAILED_MESSAGE = 'Bilgiler kaydedilemedi. Lütfen tekrar dene.';
