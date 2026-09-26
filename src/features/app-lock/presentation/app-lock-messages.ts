import { PIN_LENGTH } from '../domain/pin';

/**
 * Everything the app lock says, in Turkish.
 *
 * ## One sentence in here is load-bearing
 *
 * `SETUP_HONESTY_NOTE`. The biggest risk in this feature is not technical: it
 * is somebody reading "Uygulama kilidi", assuming their records are encrypted,
 * and behaving accordingly — keeping the app on a shared phone, handing it
 * over, not worrying about a repair shop.
 *
 * The lock closes the screen. It does not encrypt the database, which is a
 * plain SQLite file in app storage. That sentence must survive every future
 * copy edit, and a test asserts it is still there and still says it.
 *
 * Nothing in this file ever carries a PIN. The counts and the waits are
 * numbers; the digits are not.
 */

/* --------------------------------------------------------- the lock screen -- */

export const LOCK_PROMPT = "PIN'ini gir";

/** The OS biometric sheet's own message, which is read aloud on its own. */
export const LOCK_BIOMETRIC_PROMPT = 'Uygulamayı aç';
export const LOCK_BIOMETRIC_CANCEL_LABEL = "PIN'i kullan";
export const LOCK_BIOMETRIC_RETRY_LABEL = 'Parmak iziyle aç';

export const LOCK_WRONG_PIN_MESSAGE = 'PIN yanlış.';
export const LOCK_FORGOT_LABEL = "PIN'imi unuttum";
export const LOCK_DELETE_DIGIT_LABEL = 'Sil';

/**
 * Shown only as the free tries run out.
 *
 * Telling somebody they have five left before they have used any is noise, and
 * telling them after the waits begin answers a question the wait already
 * answered.
 */
export function remainingAttemptsMessage(remaining: number): string {
  return `${remaining} deneme hakkın kaldı.`;
}

export function waitSecondsMessage(seconds: number): string {
  return `Çok fazla deneme yapıldı. ${seconds} saniye sonra tekrar dene.`;
}

export function waitMinutesMessage(minutes: number): string {
  return `Çok fazla deneme yapıldı. ${minutes} dakika sonra tekrar dene.`;
}

/** What the dots say to a screen reader: the count, never the digits. */
export function enteredDigitsLabel(entered: number): string {
  return `${PIN_LENGTH} haneden ${entered} tanesi girildi`;
}

/** One key of the pad. */
export function digitLabel(digit: string): string {
  return digit;
}

/* --------------------------------------------------------------- the setup -- */

export const SETUP_TITLE = 'Uygulama kilidi';

export const SETUP_DESCRIPTION =
  'Uygulamayı her açtığında 6 haneli bir PIN sorulur. Telefonu eline alan başka ' +
  'biri kayıtlarını göremez.';

/**
 * The sentence this feature is honest because of.
 *
 * Do not soften it, do not shorten it, do not move it below the fold. A lock
 * that let somebody believe their files were encrypted would be worse than no
 * lock, because they would act on the belief.
 */
export const SETUP_HONESTY_NOTE =
  'Bu kilit uygulamanın ekranını kapatır; telefondaki dosyaları şifrelemez. ' +
  'Telefonunun kendi ekran kilidi hâlâ asıl korumadır.';

/** For the person whose phone passcode is known by the person they live with. */
export const SETUP_DIFFERENT_PIN_HINT =
  'Telefonunun kilit şifresinden farklı bir PIN seçebilirsin.';

export const SETUP_CHOOSE_PIN = 'Bir PIN seç';
export const SETUP_CONFIRM_PIN = "PIN'i tekrar gir";
export const SETUP_MISMATCH_MESSAGE = 'İki PIN aynı değil. Tekrar dene.';
export const SETUP_SAVE_FAILED_MESSAGE = 'Kilit kurulamadı. Tekrar dene.';
export const SETUP_DONE_MESSAGE = 'Uygulama kilidi açıldı.';

/** The last honest chance for somebody who chose to go without an account. */
export const SETUP_WRITE_IT_DOWN_NOTE =
  "PIN'ini bir yere not et. Hesabın olmadığı için unutursan geri almanın yolu yok.";

export const SETUP_WIDGET_NOTE =
  "Kilit açıldığında ana ekran widget'ı boşalır: widget kilitli değildir ve " +
  'gösterdiğini telefonu eline alan herkes görür.';

/** Android 12 and below, where blanking the task switcher costs screenshots. */
export const SETUP_SCREENSHOT_NOTE =
  'Bu Android sürümünde kilit açıkken uygulamanın ekran görüntüsü alınamaz.';

/* ------------------------------------------------- the account-less warning -- */

export const NO_ACCOUNT_TITLE = 'Hesabın yok';

export const NO_ACCOUNT_BODY =
  "PIN'ini unutursan tek geri alma yolu hesap şifrendir. Hesabın olmadığı için " +
  "unuttuğun bir PIN'i açmanın yolu olmaz — uygulamayı silip yeniden kurman " +
  'gerekir ve bu telefondaki bütün kayıtların gider.';

export const NO_ACCOUNT_SUGGESTION =
  'Hesap açmak birkaç dakika sürer ve kayıtlarının bir yedeğini almanı da sağlar.';

export const NO_ACCOUNT_CREATE_LABEL = 'Hesap aç';
export const NO_ACCOUNT_CONTINUE_LABEL = 'Hesapsız devam et';

/* ------------------------------------------------------------- biometrics -- */

export const BIOMETRIC_TOGGLE_LABEL = 'Parmak izi veya yüz ile aç';

export const BIOMETRIC_TOGGLE_NOTE =
  'Açıkken PIN yerine parmak izini kullanabilirsin. PIN her zaman çalışmaya devam eder.';

export const BIOMETRIC_UNAVAILABLE_NOTE = 'Bu telefonda kayıtlı parmak izi veya yüz yok.';
export const BIOMETRIC_FAILED_MESSAGE = "Tanınamadı. PIN'ini girebilirsin.";

/* --------------------------------------------------------------- recovery -- */

export const RECOVERY_TITLE = "PIN'i sıfırla";

export const RECOVERY_DESCRIPTION =
  'Hesap şifreni gir. Doğrulandığında kilit kaldırılır; istersen yeni bir PIN kurabilirsin.';

export const RECOVERY_NEEDS_INTERNET_NOTE = 'Bu adım için internet bağlantısı gerekir.';
export const RECOVERY_SUBMIT_LABEL = 'Doğrula';
export const RECOVERY_WRONG_ACCOUNT_MESSAGE = 'Bu hesap bu telefondaki kilide ait değil.';
export const RECOVERY_DONE_MESSAGE = 'Kilit kaldırıldı. İstersen yeni bir PIN kurabilirsin.';

/* ----------------------------------------------------- settings and removal -- */

export const APP_LOCK_SECTION_TITLE = 'Uygulama kilidi';
export const APP_LOCK_SECTION_DESCRIPTION = 'Uygulamayı açarken PIN sorulur. Kapalı gelir.';

export const APP_LOCK_STATUS_ON = 'Açık';
export const APP_LOCK_STATUS_OFF = 'Kapalı';

export const APP_LOCK_SET_LABEL = 'Uygulama kilidini kur';
export const APP_LOCK_MANAGE_LABEL = 'Uygulama kilidini yönet';

export const CHANGE_PIN_LABEL = "PIN'i değiştir";
export const REMOVE_LOCK_LABEL = 'Kilidi kaldır';
export const REMOVE_LOCK_QUESTION = 'Kilidi kaldırmak istiyor musun?';
export const REMOVE_LOCK_CONSEQUENCE = 'Uygulama bir daha PIN sormaz.';
export const REMOVE_LOCK_CONFIRM_LABEL = 'Kilidi kaldır';
export const REMOVE_LOCK_DONE_MESSAGE = 'Uygulama kilidi kaldırıldı.';

/**
 * When the stored lock could not be read.
 *
 * It says the records are fine, because that is the thing somebody seeing this
 * will be afraid of, and it is true: the lock never encrypted anything.
 */
export const LOCK_UNREADABLE_MESSAGE =
  'Kilit ayarın okunamadı ve kapatıldı. Kayıtların yerinde; istersen yeniden kurabilirsin.';
