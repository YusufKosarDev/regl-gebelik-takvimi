import type { AuthErrorCode } from '../domain/auth-error';
import { MINIMUM_PASSWORD_LENGTH } from '../domain/password-policy';

import type { Messages } from '@/i18n';

/**
 * Everything the account screen says, in both languages.
 *
 * ## The privacy rules the English was written against
 *
 * Two sentences in here are deliberately vaguer than they could be, and both
 * had to survive translation:
 *
 *   - an address that is already registered and an address that is malformed
 *     get the same message. Firebase can tell them apart and so could this
 *     screen, but a form that says "this one is taken" answers "does this
 *     person have an account here" for anyone who types an address into it —
 *     and here, that is a question about a period tracker.
 *   - a reset request says the same thing whether or not an account exists,
 *     for the same reason.
 *
 * None of these is the SDK's own message: those are written for a developer,
 * they change between versions, and some of them quote the address they were
 * sent.
 */

const authMessagesTr = {
  /**
   * What to say about a password that is too short.
   *
   * Built from the constant rather than written out, so the screen's hint, the
   * message the form shows and the message Firebase triggers can never disagree
   * about what the number is.
   */
  shortPasswordMessage: `Şifre en az ${MINIMUM_PASSWORD_LENGTH} karakter olmalı.`,

  /** The hint under the password field while somebody is choosing one. */
  passwordHint: `En az ${MINIMUM_PASSWORD_LENGTH} karakter`,

  errors: {
    'not-configured': 'Bulut hesabı şu anda yapılandırılmamış.',
    'invalid-email': 'Bu e-posta adresi kullanılamıyor.',
    'email-already-in-use': 'Bu e-posta adresi kullanılamıyor.',
    'invalid-credentials': 'E-posta veya şifre hatalı.',
    // Firebase's own floor is six, which this app never reaches because the
    // form refuses anything shorter than eight first. Same sentence either way.
    'weak-password': `Şifre en az ${MINIMUM_PASSWORD_LENGTH} karakter olmalı.`,
    'too-many-requests': 'Çok fazla deneme yapıldı. Biraz sonra tekrar dene.',
    'network-failed': 'Bağlantı kurulamadı. İnternet bağlantını kontrol et.',
    // The password is asked for on the same screen this can appear on, so the
    // answer is to type it again there — not to sign out and come back.
    'requires-recent-login': 'Güvenlik için şifreni tekrar girip yeniden denemen gerekiyor.',
    'signed-out': 'Bu işlem için giriş yapmış olman gerekiyor.',
    unknown: 'İşlem tamamlanamadı.',
  } as Readonly<Record<AuthErrorCode, string>>,

  /** What to say when the form was sent with something missing. */
  emptyEmailMessage: 'E-posta adresi gerekli.',
  emptyPasswordMessage: 'Şifre gerekli.',

  /**
   * What the reset form says when the request could not be made.
   *
   * Its own table rather than the sign-in one: "bu e-posta adresi
   * kullanılamıyor" is the right answer to an address that cannot hold an
   * account, and the wrong answer to an address that was simply typed wrong.
   */
  resetErrors: {
    'invalid-email': 'Geçerli bir e-posta adresi gir.',
    'too-many-requests': 'Çok fazla deneme yapıldı. Biraz sonra tekrar dene.',
    // A project that refuses everything is not something the person can fix by
    // typing their address again.
    'not-configured': 'Bulut hesabı şu anda yapılandırılmamış.',
  } as Readonly<Partial<Record<AuthErrorCode, string>>>,

  passwordResetSentMessage:
    'Eğer bu e-posta ile bir hesap varsa, şifre sıfırlama bağlantısı gönderildi.',

  /* ---------------------------------------------- the account screen -- */

  accountTitle: 'Hesap',

  accountDescription:
    'Hesap açmak isteğe bağlı. Regl, gebelik ve avatar bilgilerin telefonunda ' +
    'kalır; hesabın olsun ya da olmasın hiçbir yere gönderilmez.',

  accountLoadingMessage: 'Hesap bilgileri yükleniyor',

  /**
   * The status line when the project has no Firebase configuration.
   *
   * The same sentence as the 'not-configured' error above, and kept separate on
   * purpose: one is what a failed call is reported as, the other is what the
   * screen says about itself when there is nothing to call.
   */
  accountNotConfiguredMessage: 'Bulut hesabı şu anda yapılandırılmamış.',
  accountNotConfiguredNote: 'Uygulamanın geri kalanı hesapsız da tam olarak çalışır.',

  /* ----------------------------------------------------- signed in -- */

  signedInLabel: 'Giriş yapıldı',
  noEmailText: 'E-posta adresi yok',

  /** Which account is signed in. The spoken form of the address, or its absence. */
  signedInAccountLabel: (email: string | null) =>
    `Giriş yapılan hesap: ${email ?? 'e-posta yok'}`,

  signOutLabel: 'Çıkış yap',
  signingOutLabel: 'Çıkış yapılıyor...',

  /* ------------------------------------------------- cloud backup -- */

  backupSectionTitle: 'Bulut yedekleme',

  backupSectionDescription:
    'Yedek oluşturduğunda ya da senkronize ettiğinde regl kayıtların, gebelik ' +
    'bilgin, günlük kayıtların, avatarın ve hatırlatıcı tercihlerin hesabına ' +
    'kopyalanır. Başka hiçbir şey gönderilmez ve sen bir düğmeye basmadan ' +
    'hiçbir gönderim olmaz.',

  backupCreateLabel: 'Yedek oluştur',
  backupCheckLabel: 'Yedeği kontrol et',

  backupSavedMessage: 'Yedek oluşturuldu.',
  backupFoundMessage: 'Yedek bulundu.',
  backupMissingMessage: 'Henüz yedek yok.',

  syncPreferenceFailedMessage: 'Senkronizasyon tercihi kaydedilemedi.',

  backupDeletionPendingMessage:
    'Hesap silme işlemi yarım kaldı. Yedek oluşturulmadı — hesabı silmeyi tamamla ya da vazgeç.',

  backupOutdatedAppMessage:
    'Hesabındaki yedek, bu uygulama sürümünün tanımadığı bilgiler içeriyor. Üzerine ' +
    'yazmamak için yedek oluşturulmadı. Uygulamayı güncelleyip tekrar dene.',

  /* ---------------------------------------------------- restoring -- */

  restoreOpenLabel: 'Yedeği geri yükle',
  restorePreviewTitle: 'Neler değişecek',

  restoreRowCycleSettings: 'Döngü ayarları',
  restoreRowPeriodRecords: 'Regl kayıtları',
  restoreRowPregnancy: 'Gebelik bilgisi',
  restoreRowAvatar: 'Avatar',
  restoreRowReminders: 'Hatırlatıcı tercihleri',
  restoreRowDailyEntries: 'Günlük kayıtlar',

  restoreWarning: 'Bu yedek telefondaki mevcut verilerin üzerine yazılacak.',

  restoreConfirmLabel: 'Geri yükle',
  restoringLabel: 'Geri yükleniyor...',
  restoreCancelLabel: 'Geri yüklemekten vazgeç',

  restoreDoneMessage: 'Yedek geri yüklendi.',
  restoreFailedMessage: 'Yedek geri yüklenemedi.',

  /** A preview row, read as the thing it is about and what will happen to it. */
  previewRowLabel: (label: string, value: string) => `${label}: ${value}`,

  /* ----------------------------------------------------- the forms -- */

  emailLabel: 'E-posta',
  emailPlaceholder: 'ornek@eposta.com',
  passwordLabel: 'Şifre',

  signInLabel: 'Giriş yap',
  signUpLabel: 'Hesap oluştur',
  sendingLabel: 'Gönderiliyor...',

  forgotPasswordLabel: 'Şifremi unuttum',

  passwordResetDescription:
    'Bu adrese şifre sıfırlama bağlantısı gönderelim. Bağlantı, tarayıcıda ' +
    'açılan bir sayfaya götürür.',

  passwordResetSendLabel: 'Sıfırlama bağlantısı gönder',
};

export type AuthMessages = typeof authMessagesTr;

const authMessagesEn: AuthMessages = {
  shortPasswordMessage: `A password must be at least ${MINIMUM_PASSWORD_LENGTH} characters.`,

  passwordHint: `At least ${MINIMUM_PASSWORD_LENGTH} characters`,

  errors: {
    'not-configured': 'Cloud accounts are not set up in this build.',
    'invalid-email': 'That email address cannot be used.',
    'email-already-in-use': 'That email address cannot be used.',
    'invalid-credentials': 'That email or password is wrong.',
    'weak-password': `A password must be at least ${MINIMUM_PASSWORD_LENGTH} characters.`,
    'too-many-requests': 'Too many attempts. Try again in a little while.',
    'network-failed': 'Could not connect. Check your internet connection.',
    'requires-recent-login': 'For security, enter your password again and retry.',
    'signed-out': 'You need to be signed in to do this.',
    unknown: 'That could not be completed.',
  },

  emptyEmailMessage: 'An email address is needed.',
  emptyPasswordMessage: 'A password is needed.',

  resetErrors: {
    'invalid-email': 'Enter a valid email address.',
    'too-many-requests': 'Too many attempts. Try again in a little while.',
    'not-configured': 'Cloud accounts are not set up in this build.',
  },

  passwordResetSentMessage:
    'If there is an account with that email, a reset link has been sent.',

  accountTitle: 'Account',

  accountDescription:
    'An account is optional. Your cycle, pregnancy and avatar information stays on your ' +
    'phone; with or without an account, none of it is sent anywhere.',

  accountLoadingMessage: 'Loading your account',

  accountNotConfiguredMessage: 'Cloud accounts are not set up in this build.',
  accountNotConfiguredNote: 'The rest of the app works fully without one.',

  signedInLabel: 'Signed in',
  noEmailText: 'No email address',

  signedInAccountLabel: (email: string | null) =>
    `Signed in as: ${email ?? 'no email address'}`,

  signOutLabel: 'Sign out',
  signingOutLabel: 'Signing out...',

  backupSectionTitle: 'Cloud backup',

  backupSectionDescription:
    'When you create a backup or sync, your period records, pregnancy information, daily ' +
    'entries, avatar and reminder preferences are copied to your account. Nothing else is ' +
    'sent, and nothing is sent at all until you press a button.',

  backupCreateLabel: 'Create a backup',
  backupCheckLabel: 'Check for a backup',

  backupSavedMessage: 'Backup created.',
  backupFoundMessage: 'A backup was found.',
  backupMissingMessage: 'No backup yet.',

  syncPreferenceFailedMessage: 'That sync preference could not be saved.',

  backupDeletionPendingMessage:
    'An account deletion was left half-finished. No backup was created — finish deleting the ' +
    'account or cancel it.',

  backupOutdatedAppMessage:
    'The backup in your account holds information this version of the app does not recognise. ' +
    'No backup was created, so nothing was overwritten. Update the app and try again.',

  restoreOpenLabel: 'Restore the backup',
  restorePreviewTitle: 'What would change',

  restoreRowCycleSettings: 'Cycle settings',
  restoreRowPeriodRecords: 'Period records',
  restoreRowPregnancy: 'Pregnancy information',
  restoreRowAvatar: 'Avatar',
  restoreRowReminders: 'Reminder preferences',
  restoreRowDailyEntries: 'Daily entries',

  restoreWarning: 'This backup will be written over what is on your phone.',

  restoreConfirmLabel: 'Restore',
  restoringLabel: 'Restoring...',
  restoreCancelLabel: 'Do not restore',

  restoreDoneMessage: 'The backup was restored.',
  restoreFailedMessage: 'That backup could not be restored.',

  previewRowLabel: (label: string, value: string) => `${label}: ${value}`,

  emailLabel: 'Email',
  emailPlaceholder: 'you@example.com',
  passwordLabel: 'Password',

  signInLabel: 'Sign in',
  signUpLabel: 'Create an account',
  sendingLabel: 'Sending...',

  forgotPasswordLabel: 'I forgot my password',

  passwordResetDescription:
    'We will send a password reset link to that address. The link opens a page in your browser.',

  passwordResetSendLabel: 'Send a reset link',
};

export const authMessages: Messages<AuthMessages> = { tr: authMessagesTr, en: authMessagesEn };

/** The message for a code, and the plainest one for anything unrecognised. */
export function authErrorMessageIn(
  messages: AuthMessages,
  code: AuthErrorCode | string
): string {
  return messages.errors[code as AuthErrorCode] ?? messages.errors.unknown;
}

/** The message for a failed reset request, generic unless it is worth more. */
export function passwordResetErrorMessageIn(
  messages: AuthMessages,
  code: AuthErrorCode | string
): string {
  return messages.resetErrors[code as AuthErrorCode] ?? messages.errors.unknown;
}

/* ------------------------------------------------------------------------- */
/* The Turkish values under their original names, for the assertions that     */
/* already name them. Not for screens - see the note at the top of the file.  */
/* ------------------------------------------------------------------------- */

export const SHORT_PASSWORD_MESSAGE = authMessagesTr.shortPasswordMessage;
export const PASSWORD_HINT = authMessagesTr.passwordHint;
export const EMPTY_EMAIL_MESSAGE = authMessagesTr.emptyEmailMessage;
export const EMPTY_PASSWORD_MESSAGE = authMessagesTr.emptyPasswordMessage;
export const PASSWORD_RESET_SENT_MESSAGE = authMessagesTr.passwordResetSentMessage;
export const ACCOUNT_TITLE = authMessagesTr.accountTitle;
export const ACCOUNT_DESCRIPTION = authMessagesTr.accountDescription;
export const ACCOUNT_LOADING_MESSAGE = authMessagesTr.accountLoadingMessage;
export const ACCOUNT_NOT_CONFIGURED_MESSAGE = authMessagesTr.accountNotConfiguredMessage;
export const ACCOUNT_NOT_CONFIGURED_NOTE = authMessagesTr.accountNotConfiguredNote;
export const SIGNED_IN_LABEL = authMessagesTr.signedInLabel;
export const NO_EMAIL_TEXT = authMessagesTr.noEmailText;
export const SIGN_OUT_LABEL = authMessagesTr.signOutLabel;
export const SIGNING_OUT_LABEL = authMessagesTr.signingOutLabel;
export const BACKUP_SECTION_TITLE = authMessagesTr.backupSectionTitle;
export const BACKUP_SECTION_DESCRIPTION = authMessagesTr.backupSectionDescription;
export const BACKUP_CREATE_LABEL = authMessagesTr.backupCreateLabel;
export const BACKUP_CHECK_LABEL = authMessagesTr.backupCheckLabel;
export const BACKUP_SAVED_MESSAGE = authMessagesTr.backupSavedMessage;
export const BACKUP_FOUND_MESSAGE = authMessagesTr.backupFoundMessage;
export const BACKUP_MISSING_MESSAGE = authMessagesTr.backupMissingMessage;
export const SYNC_PREFERENCE_FAILED_MESSAGE = authMessagesTr.syncPreferenceFailedMessage;
export const BACKUP_DELETION_PENDING_MESSAGE = authMessagesTr.backupDeletionPendingMessage;
export const BACKUP_OUTDATED_APP_MESSAGE = authMessagesTr.backupOutdatedAppMessage;
export const RESTORE_OPEN_LABEL = authMessagesTr.restoreOpenLabel;
export const RESTORE_PREVIEW_TITLE = authMessagesTr.restorePreviewTitle;
export const RESTORE_ROW_CYCLE_SETTINGS = authMessagesTr.restoreRowCycleSettings;
export const RESTORE_ROW_PERIOD_RECORDS = authMessagesTr.restoreRowPeriodRecords;
export const RESTORE_ROW_PREGNANCY = authMessagesTr.restoreRowPregnancy;
export const RESTORE_ROW_AVATAR = authMessagesTr.restoreRowAvatar;
export const RESTORE_ROW_REMINDERS = authMessagesTr.restoreRowReminders;
export const RESTORE_ROW_DAILY_ENTRIES = authMessagesTr.restoreRowDailyEntries;
export const RESTORE_WARNING = authMessagesTr.restoreWarning;
export const RESTORE_CONFIRM_LABEL = authMessagesTr.restoreConfirmLabel;
export const RESTORING_LABEL = authMessagesTr.restoringLabel;
export const RESTORE_CANCEL_LABEL = authMessagesTr.restoreCancelLabel;
export const RESTORE_DONE_MESSAGE = authMessagesTr.restoreDoneMessage;
export const RESTORE_FAILED_MESSAGE = authMessagesTr.restoreFailedMessage;
export const EMAIL_LABEL = authMessagesTr.emailLabel;
export const EMAIL_PLACEHOLDER = authMessagesTr.emailPlaceholder;
export const PASSWORD_LABEL = authMessagesTr.passwordLabel;
export const SIGN_IN_LABEL = authMessagesTr.signInLabel;
export const SIGN_UP_LABEL = authMessagesTr.signUpLabel;
export const SENDING_LABEL = authMessagesTr.sendingLabel;
export const FORGOT_PASSWORD_LABEL = authMessagesTr.forgotPasswordLabel;
export const PASSWORD_RESET_DESCRIPTION = authMessagesTr.passwordResetDescription;
export const PASSWORD_RESET_SEND_LABEL = authMessagesTr.passwordResetSendLabel;

export const signedInAccountLabel = authMessagesTr.signedInAccountLabel;
export const previewRowLabel = authMessagesTr.previewRowLabel;

export function authErrorMessage(code: AuthErrorCode | string): string {
  return authErrorMessageIn(authMessagesTr, code);
}

export function passwordResetErrorMessage(code: AuthErrorCode | string): string {
  return passwordResetErrorMessageIn(authMessagesTr, code);
}
