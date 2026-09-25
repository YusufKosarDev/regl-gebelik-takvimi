import type { AuthErrorCode } from '../domain/auth-error';
import { MINIMUM_PASSWORD_LENGTH } from '../domain/password-policy';

/**
 * What to say about a password that is too short.
 *
 * Built from the constant rather than written out, so the screen's hint, the
 * message the form shows and the message Firebase triggers can never disagree
 * about what the number is.
 */
export const SHORT_PASSWORD_MESSAGE = `Şifre en az ${MINIMUM_PASSWORD_LENGTH} karakter olmalı.`;

/** The hint under the password field while somebody is choosing one. */
export const PASSWORD_HINT = `En az ${MINIMUM_PASSWORD_LENGTH} karakter`;

/**
 * What the account screen says when something does not work.
 *
 * Turkish, short, and about what the person can do next. None of these is the
 * SDK's message: those are written for a developer, they change between
 * versions, and some of them quote the address they were sent.
 *
 * An address that is already registered and an address that is malformed get
 * the same sentence on purpose. Firebase can tell them apart and so could this
 * screen, but a form that says "this one is taken" answers "does this person
 * have an account here" for anyone who types an address into it — and here,
 * that is a question about a period tracker.
 */
const MESSAGES: Readonly<Record<AuthErrorCode, string>> = {
  'not-configured': 'Bulut hesabı şu anda yapılandırılmamış.',
  'invalid-email': 'Bu e-posta adresi kullanılamıyor.',
  'email-already-in-use': 'Bu e-posta adresi kullanılamıyor.',
  'invalid-credentials': 'E-posta veya şifre hatalı.',
  // Firebase's own floor is six, which this app never reaches because the form
  // refuses anything shorter than eight first. Same sentence either way.
  'weak-password': SHORT_PASSWORD_MESSAGE,
  'too-many-requests': 'Çok fazla deneme yapıldı. Biraz sonra tekrar dene.',
  'network-failed': 'Bağlantı kurulamadı. İnternet bağlantını kontrol et.',
  // The password is asked for on the same screen this can appear on, so the
  // answer is to type it again there — not to sign out and come back.
  'requires-recent-login': 'Güvenlik için şifreni tekrar girip yeniden denemen gerekiyor.',
  'signed-out': 'Bu işlem için giriş yapmış olman gerekiyor.',
  unknown: 'İşlem tamamlanamadı.',
};

/** The message for a code, and the plainest one for anything unrecognised. */
export function authErrorMessage(code: AuthErrorCode | string): string {
  return MESSAGES[code as AuthErrorCode] ?? MESSAGES.unknown;
}

/** What to say when the form was sent with something missing. */
export const EMPTY_EMAIL_MESSAGE = 'E-posta adresi gerekli.';
export const EMPTY_PASSWORD_MESSAGE = 'Şifre gerekli.';

/**
 * What the reset form says when the request could not be made.
 *
 * Its own table rather than the sign-in one: "bu e-posta adresi kullanılamıyor"
 * is the right answer to an address that cannot hold an account, and the wrong
 * answer to an address that was simply typed wrong.
 *
 * Nothing here distinguishes an address with an account from one without,
 * because the repository does not tell this screen which it was.
 */
const RESET_MESSAGES: Readonly<Partial<Record<AuthErrorCode, string>>> = {
  'invalid-email': 'Geçerli bir e-posta adresi gir.',
  'too-many-requests': 'Çok fazla deneme yapıldı. Biraz sonra tekrar dene.',
  // A project that refuses everything is not something the person can fix by
  // typing their address again.
  'not-configured': MESSAGES['not-configured'],
};

/** The message for a failed reset request, generic unless it is worth more. */
export function passwordResetErrorMessage(code: AuthErrorCode | string): string {
  return RESET_MESSAGES[code as AuthErrorCode] ?? MESSAGES.unknown;
}

/**
 * What a reset request says when it worked.
 *
 * The same sentence whether or not an account exists, because the app is not
 * told which it was — and because a form that said "no account with that
 * address" would answer, for anyone who typed one in, whether its owner tracks
 * their period here.
 */
export const PASSWORD_RESET_SENT_MESSAGE =
  'Eğer bu e-posta ile bir hesap varsa, şifre sıfırlama bağlantısı gönderildi.';

/* ------------------------------------------------ the account screen -- */

/**
 * Everything the account screen says, in Turkish.
 *
 * Moved out of `app/(app)/account.tsx` verbatim. The messages above are about
 * what went wrong; these are the screen itself - its headings, its two forms
 * and the backup section.
 *
 * The backup wording that belongs to the backup and sync features stays in
 * theirs: this screen already imports PHONE_TRANSFER_NOTE, AUTOMATIC_SYNC_NOTE
 * and the restore labels from where they live.
 */

export const ACCOUNT_TITLE = 'Hesap';

export const ACCOUNT_DESCRIPTION =
  'Hesap açmak isteğe bağlı. Regl, gebelik ve avatar bilgilerin telefonunda ' +
  'kalır; hesabın olsun ya da olmasın hiçbir yere gönderilmez.';

export const ACCOUNT_LOADING_MESSAGE = 'Hesap bilgileri yükleniyor';

/**
 * The status line when the project has no Firebase configuration.
 *
 * The same sentence as the 'not-configured' error above, and kept separate on
 * purpose: one is what a failed call is reported as, the other is what the
 * screen says about itself when there is nothing to call.
 */
export const ACCOUNT_NOT_CONFIGURED_MESSAGE = 'Bulut hesabı şu anda yapılandırılmamış.';

export const ACCOUNT_NOT_CONFIGURED_NOTE = 'Uygulamanın geri kalanı hesapsız da tam olarak çalışır.';

/* ------------------------------------------------------- signed in -- */

export const SIGNED_IN_LABEL = 'Giriş yapıldı';
export const NO_EMAIL_TEXT = 'E-posta adresi yok';

/** Which account is signed in. The spoken form of the address, or its absence. */
export function signedInAccountLabel(email: string | null): string {
  return `Giriş yapılan hesap: ${email ?? 'e-posta yok'}`;
}

export const SIGN_OUT_LABEL = 'Çıkış yap';
export const SIGNING_OUT_LABEL = 'Çıkış yapılıyor...';

/* --------------------------------------------------- cloud backup -- */

export const BACKUP_SECTION_TITLE = 'Bulut yedekleme';

export const BACKUP_SECTION_DESCRIPTION =
  'Yedek oluşturduğunda ya da senkronize ettiğinde regl kayıtların, gebelik ' +
  'bilgin, günlük kayıtların, avatarın ve hatırlatıcı tercihlerin hesabına ' +
  'kopyalanır. Başka hiçbir şey gönderilmez ve sen bir düğmeye basmadan ' +
  'hiçbir gönderim olmaz.';

export const BACKUP_CREATE_LABEL = 'Yedek oluştur';
export const BACKUP_CHECK_LABEL = 'Yedeği kontrol et';

export const BACKUP_SAVED_MESSAGE = 'Yedek oluşturuldu.';
export const BACKUP_FOUND_MESSAGE = 'Yedek bulundu.';
export const BACKUP_MISSING_MESSAGE = 'Henüz yedek yok.';

export const SYNC_PREFERENCE_FAILED_MESSAGE = 'Senkronizasyon tercihi kaydedilemedi.';

export const BACKUP_DELETION_PENDING_MESSAGE =
  'Hesap silme işlemi yarım kaldı. Yedek oluşturulmadı — hesabı silmeyi tamamla ya da vazgeç.';

export const BACKUP_OUTDATED_APP_MESSAGE =
  'Hesabındaki yedek, bu uygulama sürümünün tanımadığı bilgiler içeriyor. Üzerine ' +
  'yazmamak için yedek oluşturulmadı. Uygulamayı güncelleyip tekrar dene.';

/* ------------------------------------------------------ restoring -- */

export const RESTORE_OPEN_LABEL = 'Yedeği geri yükle';
export const RESTORE_PREVIEW_TITLE = 'Neler değişecek';

export const RESTORE_ROW_CYCLE_SETTINGS = 'Döngü ayarları';
export const RESTORE_ROW_PERIOD_RECORDS = 'Regl kayıtları';
export const RESTORE_ROW_PREGNANCY = 'Gebelik bilgisi';
export const RESTORE_ROW_AVATAR = 'Avatar';
export const RESTORE_ROW_REMINDERS = 'Hatırlatıcı tercihleri';
export const RESTORE_ROW_DAILY_ENTRIES = 'Günlük kayıtlar';

export const RESTORE_WARNING = 'Bu yedek telefondaki mevcut verilerin üzerine yazılacak.';

export const RESTORE_CONFIRM_LABEL = 'Geri yükle';
export const RESTORING_LABEL = 'Geri yükleniyor...';
export const RESTORE_CANCEL_LABEL = 'Geri yüklemekten vazgeç';

export const RESTORE_DONE_MESSAGE = 'Yedek geri yüklendi.';
export const RESTORE_FAILED_MESSAGE = 'Yedek geri yüklenemedi.';

/** A preview row, read as the thing it is about and what will happen to it. */
export function previewRowLabel(label: string, value: string): string {
  return `${label}: ${value}`;
}

/* ------------------------------------------------------- the forms -- */

export const EMAIL_LABEL = 'E-posta';
export const EMAIL_PLACEHOLDER = 'ornek@eposta.com';
export const PASSWORD_LABEL = 'Şifre';

export const SIGN_IN_LABEL = 'Giriş yap';
export const SIGN_UP_LABEL = 'Hesap oluştur';
export const SENDING_LABEL = 'Gönderiliyor...';

export const FORGOT_PASSWORD_LABEL = 'Şifremi unuttum';

export const PASSWORD_RESET_DESCRIPTION =
  'Bu adrese şifre sıfırlama bağlantısı gönderelim. Bağlantı, tarayıcıda ' +
  'açılan bir sayfaya götürür.';

export const PASSWORD_RESET_SEND_LABEL = 'Sıfırlama bağlantısı gönder';
