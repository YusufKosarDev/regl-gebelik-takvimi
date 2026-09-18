import type { AuthErrorCode } from '../domain/auth-error';

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
  'weak-password': 'Şifre en az 6 karakter olmalı.',
  'too-many-requests': 'Çok fazla deneme yapıldı. Biraz sonra tekrar dene.',
  'network-failed': 'Bağlantı kurulamadı. İnternet bağlantını kontrol et.',
  unknown: 'İşlem tamamlanamadı.',
};

/** The message for a code, and the plainest one for anything unrecognised. */
export function authErrorMessage(code: AuthErrorCode | string): string {
  return MESSAGES[code as AuthErrorCode] ?? MESSAGES.unknown;
}

/** What to say when the form was sent with something missing. */
export const EMPTY_EMAIL_MESSAGE = 'E-posta adresi gerekli.';
export const EMPTY_PASSWORD_MESSAGE = 'Şifre gerekli.';
