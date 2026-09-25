/**
 * Everything the cycle settings screen says, in Turkish.
 *
 * Moved out of `app/(app)/settings.tsx` verbatim. Its own file rather than
 * home-messages or history-messages for the same reason those two are separate:
 * all three are the cycle feature, and none of them is the others' screen.
 *
 * The two field notes read the same as the onboarding questions they repeat.
 * They are left as two strings, in two features, because that is what they were
 * - onboarding asks once and this screen corrects it afterwards, and a shared
 * sentence would make an edit to one an edit to both.
 */

export const SETTINGS_TITLE = 'Döngü ayarları';
export const SETTINGS_DESCRIPTION = 'Döngü ve regl süresi tahminlerini buradan güncelleyebilirsin.';

export const SETTINGS_LOAD_FAILED_MESSAGE = 'Ayarlar yüklenemedi.';
export const SETTINGS_SAVE_FAILED_MESSAGE = 'Ayarlar kaydedilemedi.';
export const SETTINGS_EMPTY_MESSAGE = 'Döngü bilgisi bulunamadı.';

/* ---------------------------------------------------------- the two fields -- */

export const CYCLE_LENGTH_FIELD_LABEL = 'Ortalama döngü süresi';
export const CYCLE_LENGTH_FIELD_NOTE =
  'Bir regl döneminin ilk gününden, sonraki regl döneminin ilk gününe kadar geçen süre.';
export const CYCLE_LENGTH_DECREASE_LABEL = 'Ortalama döngü süresini azalt';
export const CYCLE_LENGTH_INCREASE_LABEL = 'Ortalama döngü süresini artır';

export const PERIOD_LENGTH_FIELD_LABEL = 'Ortalama regl süresi';
export const PERIOD_LENGTH_FIELD_NOTE =
  'Kanamanın başladığı ilk günden tamamen bittiği güne kadar geçen ortalama süre.';
export const PERIOD_LENGTH_DECREASE_LABEL = 'Ortalama regl süresini azalt';
export const PERIOD_LENGTH_INCREASE_LABEL = 'Ortalama regl süresini artır';

/** The unit under both steppers. */
export const DAYS_UNIT = 'gün';

export const SETTINGS_SAVE_LABEL = 'Döngü ayarlarını kaydet';

/** A stepper's current value, read as the field it belongs to. */
export function lengthValueLabel(label: string, value: number): string {
  return `${label}: ${value} gün`;
}

/* -------------------------------------------------------- the two sections -- */

export const NOTIFICATIONS_SECTION_TITLE = 'Bildirimler';

export const ACCOUNT_SECTION_TITLE = 'Hesap';
export const ACCOUNT_SECTION_DESCRIPTION = 'Hesap açmak isteğe bağlı. Verilerin telefonunda kalır.';
export const ACCOUNT_OPEN_LABEL = 'Hesabı aç';
