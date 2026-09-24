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
