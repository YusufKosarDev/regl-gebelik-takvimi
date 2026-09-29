import { PIN_LENGTH } from '../domain/pin';

import type { Messages } from '@/i18n';
import { plural } from '@/i18n';

/**
 * Everything the app lock says.
 *
 * ## One sentence in here is load-bearing
 *
 * `setupHonestyNote`. The biggest risk in this feature is not technical: it is
 * somebody reading "Uygulama kilidi", assuming their records are encrypted, and
 * behaving accordingly — keeping the app on a shared phone, handing it over,
 * not worrying about a repair shop.
 *
 * The lock closes the screen. It does not encrypt the database, which is a
 * plain SQLite file in app storage. That sentence must survive every future
 * copy edit **and every translation**, and a test asserts both halves still say
 * it and still say what the phone's own lock is for.
 *
 * Nothing in this file ever carries a PIN. The counts and the waits are
 * numbers; the digits are not.
 */

const appLockMessagesTr = {
  /* ------------------------------------------------------- the lock screen -- */

  lockPrompt: "PIN'ini gir",

  /** The OS biometric sheet's own message, which is read aloud on its own. */
  lockBiometricPrompt: 'Uygulamayı aç',
  lockBiometricCancelLabel: "PIN'i kullan",
  lockBiometricRetryLabel: 'Parmak iziyle aç',

  lockWrongPinMessage: 'PIN yanlış.',
  lockForgotLabel: "PIN'imi unuttum",
  lockDeleteDigitLabel: 'Sil',

  /**
   * Shown only as the free tries run out.
   *
   * Telling somebody they have five left before they have used any is noise,
   * and telling them after the waits begin answers a question the wait already
   * answered.
   */
  remainingAttemptsMessage: (remaining: number) => `${remaining} deneme hakkın kaldı.`,

  waitSecondsMessage: (seconds: number) =>
    `Çok fazla deneme yapıldı. ${seconds} saniye sonra tekrar dene.`,

  waitMinutesMessage: (minutes: number) =>
    `Çok fazla deneme yapıldı. ${minutes} dakika sonra tekrar dene.`,

  /** What the dots say to a screen reader: the count, never the digits. */
  enteredDigitsLabel: (entered: number) => `${PIN_LENGTH} haneden ${entered} tanesi girildi`,

  /* ------------------------------------------------------------- the setup -- */

  setupTitle: 'Uygulama kilidi',

  setupDescription:
    `Uygulamayı her açtığında ${PIN_LENGTH} haneli bir PIN sorulur. Telefonu eline alan ` +
    'başka biri kayıtlarını göremez.',

  /**
   * The sentence this feature is honest because of.
   *
   * Do not soften it, do not shorten it, do not move it below the fold. A lock
   * that let somebody believe their files were encrypted would be worse than no
   * lock, because they would act on the belief.
   */
  setupHonestyNote:
    'Bu kilit uygulamanın ekranını kapatır; telefondaki dosyaları şifrelemez. ' +
    'Telefonunun kendi ekran kilidi hâlâ asıl korumadır.',

  /** For the person whose phone passcode is known by the person they live with. */
  setupDifferentPinHint: 'Telefonunun kilit şifresinden farklı bir PIN seçebilirsin.',

  setupChoosePin: 'Bir PIN seç',
  setupConfirmPin: "PIN'i tekrar gir",
  setupMismatchMessage: 'İki PIN aynı değil. Tekrar dene.',
  setupSaveFailedMessage: 'Kilit kurulamadı. Tekrar dene.',
  setupDoneMessage: 'Uygulama kilidi açıldı.',

  /** The last honest chance for somebody who chose to go without an account. */
  setupWriteItDownNote:
    "PIN'ini bir yere not et. Hesabın olmadığı için unutursan geri almanın yolu yok.",

  setupWidgetNote:
    "Kilit açıldığında ana ekran widget'ı boşalır: widget kilitli değildir ve " +
    'gösterdiğini telefonu eline alan herkes görür.',

  /** Android 12 and below, where blanking the task switcher costs screenshots. */
  setupScreenshotNote:
    'Bu Android sürümünde kilit açıkken uygulamanın ekran görüntüsü alınamaz.',

  /**
   * Said because the lock changes a second setting, and the person did not ask
   * for that one.
   *
   * Somebody setting a lock has said what they want: the phone can be picked up
   * by somebody else. A reminder printing "regl dönemin yaklaşıyor" on the lock
   * screen defeats it entirely, and Android does not let the app hide that —
   * only reword it. So the lock switches the wording over.
   *
   * Doing it silently would be the app deciding something on their behalf,
   * which is what the rest of this feature refuses to do. It says so instead,
   * and says where to undo it.
   */
  setupDiscreetNotificationsNote:
    'Kilit açıldığında hatırlatıcı bildirimleri de sadeleşir: kilit ekranında ' +
    'regl ya da gebelikten söz etmez, yalnızca uygulamayı açmanı söyler. Bunu ' +
    'Ayarlar > Bildirimler altından geri alabilirsin.',

  /* ----------------------------------------------- the account-less warning -- */

  noAccountTitle: 'Hesabın yok',

  noAccountBody:
    "PIN'ini unutursan tek geri alma yolu hesap şifrendir. Hesabın olmadığı için " +
    "unuttuğun bir PIN'i açmanın yolu olmaz — uygulamayı silip yeniden kurman " +
    'gerekir ve bu telefondaki bütün kayıtların gider.',

  noAccountSuggestion:
    'Hesap açmak birkaç dakika sürer ve kayıtlarının bir yedeğini almanı da sağlar.',

  noAccountCreateLabel: 'Hesap aç',
  noAccountContinueLabel: 'Hesapsız devam et',

  /* ------------------------------------------------------------ biometrics -- */

  biometricToggleLabel: 'Parmak izi veya yüz ile aç',

  biometricToggleNote:
    'Açıkken PIN yerine parmak izini kullanabilirsin. PIN her zaman çalışmaya devam eder.',

  biometricUnavailableNote: 'Bu telefonda kayıtlı parmak izi veya yüz yok.',
  biometricFailedMessage: "Tanınamadı. PIN'ini girebilirsin.",

  /* -------------------------------------------------------------- recovery -- */

  recoveryTitle: "PIN'i sıfırla",

  recoveryDescription:
    'Hesap şifreni gir. Doğrulandığında kilit kaldırılır; istersen yeni bir PIN kurabilirsin.',

  recoveryNeedsInternetNote: 'Bu adım için internet bağlantısı gerekir.',
  recoverySubmitLabel: 'Doğrula',
  recoveryWrongAccountMessage: 'Bu hesap bu telefondaki kilide ait değil.',
  recoveryDoneMessage: 'Kilit kaldırıldı. İstersen yeni bir PIN kurabilirsin.',

  /* ---------------------------------------------------- settings and removal -- */

  appLockSectionTitle: 'Uygulama kilidi',
  appLockSectionDescription: 'Uygulamayı açarken PIN sorulur. Kapalı gelir.',

  appLockStatusOn: 'Açık',
  appLockStatusOff: 'Kapalı',

  appLockSetLabel: 'Uygulama kilidini kur',
  appLockManageLabel: 'Uygulama kilidini yönet',

  changePinLabel: "PIN'i değiştir",
  removeLockLabel: 'Kilidi kaldır',
  removeLockQuestion: 'Kilidi kaldırmak istiyor musun?',
  removeLockConsequence: 'Uygulama bir daha PIN sormaz.',
  removeLockConfirmLabel: 'Kilidi kaldır',
  removeLockDoneMessage: 'Uygulama kilidi kaldırıldı.',

  /**
   * When the stored lock could not be read.
   *
   * It says the records are fine, because that is the thing somebody seeing
   * this will be afraid of, and it is true: the lock never encrypted anything.
   */
  lockUnreadableMessage:
    'Kilit ayarın okunamadı ve kapatıldı. Kayıtların yerinde; istersen yeniden kurabilirsin.',

  /* -------------------------------------- when the bound account is deleted -- */

  /**
   * Shown in the account-deletion panel when a lock is bound to that account.
   *
   * Deleting the account makes the lock unrecoverable: the uid it was bound to
   * stops existing, and signing in as it stops being possible. Somebody who
   * then forgets the PIN has no way back at all.
   *
   * Said where the decision is made, with the way out beside it, rather than
   * discovered weeks later by somebody standing at a lock screen.
   */
  lockBoundToAccountWarning:
    "Uygulama kilidin bu hesaba bağlı. Hesabı silersen PIN'ini unuttuğunda geri " +
    'almanın yolu kalmaz. Önce kilidi kaldırman önerilir.',

  removeLockFirstLabel: 'Önce kilidi kaldır',
};

export type AppLockMessages = typeof appLockMessagesTr;

const appLockMessagesEn: AppLockMessages = {
  lockPrompt: 'Enter your PIN',

  lockBiometricPrompt: 'Open the app',
  lockBiometricCancelLabel: 'Use the PIN',
  lockBiometricRetryLabel: 'Open with a fingerprint',

  lockWrongPinMessage: 'That PIN is wrong.',
  lockForgotLabel: 'I forgot my PIN',
  lockDeleteDigitLabel: 'Delete',

  remainingAttemptsMessage: (remaining: number) =>
    plural(remaining, '1 try left.', `${remaining} tries left.`),

  waitSecondsMessage: (seconds: number) =>
    `Too many attempts. Try again in ${plural(seconds, '1 second', `${seconds} seconds`)}.`,

  waitMinutesMessage: (minutes: number) =>
    `Too many attempts. Try again in ${plural(minutes, '1 minute', `${minutes} minutes`)}.`,

  enteredDigitsLabel: (entered: number) => `${entered} of ${PIN_LENGTH} digits entered`,

  setupTitle: 'App lock',

  setupDescription:
    `A ${PIN_LENGTH}-digit PIN is asked for every time you open the app. Somebody else ` +
    'picking up your phone cannot see your records.',

  setupHonestyNote:
    'This lock closes the app’s screen; it does not encrypt the files on your phone. ' +
    'Your phone’s own screen lock is still the real protection.',

  setupDifferentPinHint: 'You can choose a PIN different from your phone’s passcode.',

  setupChoosePin: 'Choose a PIN',
  setupConfirmPin: 'Enter the PIN again',
  setupMismatchMessage: 'Those two PINs are not the same. Try again.',
  setupSaveFailedMessage: 'The lock could not be set up. Try again.',
  setupDoneMessage: 'The app lock is on.',

  setupWriteItDownNote:
    'Write your PIN down somewhere. You have no account, so if you forget it there is no ' +
    'way to get back in.',

  setupWidgetNote:
    'With the lock on, the home screen widget goes blank: a widget is not locked, and ' +
    'anybody picking up the phone can see what it shows.',

  setupScreenshotNote:
    'On this version of Android, screenshots of the app cannot be taken while the lock is on.',

  setupDiscreetNotificationsNote:
    'With the lock on, reminder notifications are made plainer too: on the lock screen they ' +
    'do not mention periods or pregnancy, they only tell you to open the app. You can undo ' +
    'this under Settings > Notifications.',

  noAccountTitle: 'You have no account',

  noAccountBody:
    'If you forget your PIN, the only way back in is your account password. You have no ' +
    'account, so a forgotten PIN could not be opened at all — you would have to delete the ' +
    'app and install it again, and every record on this phone would go with it.',

  noAccountSuggestion:
    'Opening an account takes a couple of minutes and also lets you back your records up.',

  noAccountCreateLabel: 'Open an account',
  noAccountContinueLabel: 'Carry on without one',

  biometricToggleLabel: 'Open with a fingerprint or face',

  biometricToggleNote:
    'With this on you can use your fingerprint instead of the PIN. The PIN always keeps working.',

  biometricUnavailableNote: 'This phone has no fingerprint or face saved.',
  biometricFailedMessage: 'Not recognised. You can enter your PIN.',

  recoveryTitle: 'Reset your PIN',

  recoveryDescription:
    'Enter your account password. Once it is verified the lock is removed; you can set up a ' +
    'new PIN if you want one.',

  recoveryNeedsInternetNote: 'This step needs an internet connection.',
  recoverySubmitLabel: 'Verify',
  recoveryWrongAccountMessage: 'That account is not the one this phone’s lock belongs to.',
  recoveryDoneMessage: 'The lock was removed. You can set up a new PIN if you want one.',

  appLockSectionTitle: 'App lock',
  appLockSectionDescription: 'A PIN is asked for when you open the app. It starts off.',

  appLockStatusOn: 'On',
  appLockStatusOff: 'Off',

  appLockSetLabel: 'Set up the app lock',
  appLockManageLabel: 'Manage the app lock',

  changePinLabel: 'Change the PIN',
  removeLockLabel: 'Remove the lock',
  removeLockQuestion: 'Remove the lock?',
  removeLockConsequence: 'The app will not ask for a PIN again.',
  removeLockConfirmLabel: 'Remove the lock',
  removeLockDoneMessage: 'The app lock was removed.',

  lockUnreadableMessage:
    'Your lock setting could not be read and has been switched off. Your records are where ' +
    'you left them; you can set it up again if you want to.',

  lockBoundToAccountWarning:
    'Your app lock is bound to this account. If you delete the account there will be no way ' +
    'back in when you forget your PIN. Removing the lock first is recommended.',

  removeLockFirstLabel: 'Remove the lock first',
};

export const appLockMessages: Messages<AppLockMessages> = {
  tr: appLockMessagesTr,
  en: appLockMessagesEn,
};

/* ------------------------------------------------------------------------- */
/* The Turkish values under their original names, for the assertions that     */
/* already name them. Not for screens - see the note at the top of the file.  */
/* ------------------------------------------------------------------------- */

export const LOCK_PROMPT = appLockMessagesTr.lockPrompt;
export const LOCK_BIOMETRIC_PROMPT = appLockMessagesTr.lockBiometricPrompt;
export const LOCK_BIOMETRIC_CANCEL_LABEL = appLockMessagesTr.lockBiometricCancelLabel;
export const LOCK_BIOMETRIC_RETRY_LABEL = appLockMessagesTr.lockBiometricRetryLabel;
export const LOCK_WRONG_PIN_MESSAGE = appLockMessagesTr.lockWrongPinMessage;
export const LOCK_FORGOT_LABEL = appLockMessagesTr.lockForgotLabel;
export const LOCK_DELETE_DIGIT_LABEL = appLockMessagesTr.lockDeleteDigitLabel;
export const SETUP_TITLE = appLockMessagesTr.setupTitle;
export const SETUP_DESCRIPTION = appLockMessagesTr.setupDescription;
export const SETUP_HONESTY_NOTE = appLockMessagesTr.setupHonestyNote;
export const SETUP_DIFFERENT_PIN_HINT = appLockMessagesTr.setupDifferentPinHint;
export const SETUP_CHOOSE_PIN = appLockMessagesTr.setupChoosePin;
export const SETUP_CONFIRM_PIN = appLockMessagesTr.setupConfirmPin;
export const SETUP_MISMATCH_MESSAGE = appLockMessagesTr.setupMismatchMessage;
export const SETUP_SAVE_FAILED_MESSAGE = appLockMessagesTr.setupSaveFailedMessage;
export const SETUP_DONE_MESSAGE = appLockMessagesTr.setupDoneMessage;
export const SETUP_WRITE_IT_DOWN_NOTE = appLockMessagesTr.setupWriteItDownNote;
export const SETUP_WIDGET_NOTE = appLockMessagesTr.setupWidgetNote;
export const SETUP_SCREENSHOT_NOTE = appLockMessagesTr.setupScreenshotNote;
export const SETUP_DISCREET_NOTIFICATIONS_NOTE =
  appLockMessagesTr.setupDiscreetNotificationsNote;
export const NO_ACCOUNT_TITLE = appLockMessagesTr.noAccountTitle;
export const NO_ACCOUNT_BODY = appLockMessagesTr.noAccountBody;
export const NO_ACCOUNT_SUGGESTION = appLockMessagesTr.noAccountSuggestion;
export const NO_ACCOUNT_CREATE_LABEL = appLockMessagesTr.noAccountCreateLabel;
export const NO_ACCOUNT_CONTINUE_LABEL = appLockMessagesTr.noAccountContinueLabel;
export const BIOMETRIC_TOGGLE_LABEL = appLockMessagesTr.biometricToggleLabel;
export const BIOMETRIC_TOGGLE_NOTE = appLockMessagesTr.biometricToggleNote;
export const BIOMETRIC_UNAVAILABLE_NOTE = appLockMessagesTr.biometricUnavailableNote;
export const BIOMETRIC_FAILED_MESSAGE = appLockMessagesTr.biometricFailedMessage;
export const RECOVERY_TITLE = appLockMessagesTr.recoveryTitle;
export const RECOVERY_DESCRIPTION = appLockMessagesTr.recoveryDescription;
export const RECOVERY_NEEDS_INTERNET_NOTE = appLockMessagesTr.recoveryNeedsInternetNote;
export const RECOVERY_SUBMIT_LABEL = appLockMessagesTr.recoverySubmitLabel;
export const RECOVERY_WRONG_ACCOUNT_MESSAGE = appLockMessagesTr.recoveryWrongAccountMessage;
export const RECOVERY_DONE_MESSAGE = appLockMessagesTr.recoveryDoneMessage;
export const APP_LOCK_SECTION_TITLE = appLockMessagesTr.appLockSectionTitle;
export const APP_LOCK_SECTION_DESCRIPTION = appLockMessagesTr.appLockSectionDescription;
export const APP_LOCK_STATUS_ON = appLockMessagesTr.appLockStatusOn;
export const APP_LOCK_STATUS_OFF = appLockMessagesTr.appLockStatusOff;
export const APP_LOCK_SET_LABEL = appLockMessagesTr.appLockSetLabel;
export const APP_LOCK_MANAGE_LABEL = appLockMessagesTr.appLockManageLabel;
export const CHANGE_PIN_LABEL = appLockMessagesTr.changePinLabel;
export const REMOVE_LOCK_LABEL = appLockMessagesTr.removeLockLabel;
export const REMOVE_LOCK_QUESTION = appLockMessagesTr.removeLockQuestion;
export const REMOVE_LOCK_CONSEQUENCE = appLockMessagesTr.removeLockConsequence;
export const REMOVE_LOCK_CONFIRM_LABEL = appLockMessagesTr.removeLockConfirmLabel;
export const REMOVE_LOCK_DONE_MESSAGE = appLockMessagesTr.removeLockDoneMessage;
export const LOCK_UNREADABLE_MESSAGE = appLockMessagesTr.lockUnreadableMessage;
export const LOCK_BOUND_TO_ACCOUNT_WARNING = appLockMessagesTr.lockBoundToAccountWarning;
export const REMOVE_LOCK_FIRST_LABEL = appLockMessagesTr.removeLockFirstLabel;

export const remainingAttemptsMessage = appLockMessagesTr.remainingAttemptsMessage;
export const waitSecondsMessage = appLockMessagesTr.waitSecondsMessage;
export const waitMinutesMessage = appLockMessagesTr.waitMinutesMessage;
export const enteredDigitsLabel = appLockMessagesTr.enteredDigitsLabel;

/** One key of the pad. The digit is the label, in every language. */
export function digitLabel(digit: string): string {
  return digit;
}
