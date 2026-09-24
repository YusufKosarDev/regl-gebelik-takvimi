import { AUTH_ERROR_CODES } from '../../domain/auth-error';
import {
  EMPTY_EMAIL_MESSAGE,
  EMPTY_PASSWORD_MESSAGE,
  PASSWORD_RESET_SENT_MESSAGE,
  authErrorMessage,
  passwordResetErrorMessage,
} from '../auth-messages';

describe('what the account screen says about a failure', () => {
  it.each([
    ['invalid-credentials', 'E-posta veya şifre hatalı.'],
    ['email-already-in-use', 'Bu e-posta adresi kullanılamıyor.'],
    ['invalid-email', 'Bu e-posta adresi kullanılamıyor.'],
    ['weak-password', 'Şifre en az 8 karakter olmalı.'],
    ['not-configured', 'Bulut hesabı şu anda yapılandırılmamış.'],
    ['unknown', 'İşlem tamamlanamadı.'],
  ])('says %s as "%s"', (code, message) => {
    expect(authErrorMessage(code)).toBe(message);
  });

  it('has something to say for every code the app can produce', () => {
    for (const code of AUTH_ERROR_CODES) {
      expect(authErrorMessage(code).length).toBeGreaterThan(5);
    }
  });

  it('falls back to the plainest sentence for anything else', () => {
    expect(authErrorMessage('auth/wrong-password')).toBe('İşlem tamamlanamadı.');
    expect(authErrorMessage('')).toBe('İşlem tamamlanamadı.');
  });

  it('gives an address already registered and a malformed one the same answer', () => {
    // Anything else would tell whoever typed an address whether it has an
    // account here.
    expect(authErrorMessage('email-already-in-use')).toBe(authErrorMessage('invalid-email'));
  });
});

describe('what the reset form says about a failure', () => {
  it.each([
    ['invalid-email', 'Geçerli bir e-posta adresi gir.'],
    ['too-many-requests', 'Çok fazla deneme yapıldı. Biraz sonra tekrar dene.'],
    ['not-configured', 'Bulut hesabı şu anda yapılandırılmamış.'],
    ['network-failed', 'İşlem tamamlanamadı.'],
    ['unknown', 'İşlem tamamlanamadı.'],
  ])('says %s as "%s"', (code, message) => {
    expect(passwordResetErrorMessage(code)).toBe(message);
  });

  it('says nothing about whether an address has an account', () => {
    for (const code of AUTH_ERROR_CODES) {
      expect(passwordResetErrorMessage(code)).not.toMatch(/hesap (var|yok|bulun)/i);
    }
  });

  it('tells a mistyped address from a project that is not set up', () => {
    expect(passwordResetErrorMessage('invalid-email')).not.toBe(
      passwordResetErrorMessage('not-configured')
    );
  });
});

describe('what these sentences never contain', () => {
  const everything = [
    ...AUTH_ERROR_CODES.map((code) => authErrorMessage(code)),
    ...AUTH_ERROR_CODES.map((code) => passwordResetErrorMessage(code)),
    PASSWORD_RESET_SENT_MESSAGE,
    EMPTY_EMAIL_MESSAGE,
    EMPTY_PASSWORD_MESSAGE,
  ];

  it.each(everything)('%s carries no code, address or SDK name', (message) => {
    expect(message).not.toMatch(/auth\/|firebase|@|AIzaSy/i);
  });

  it('is Turkish, which is what the rest of the app speaks', () => {
    for (const message of everything) {
      expect(message).toMatch(/[a-zçğıöşü]/i);
      expect(message).not.toMatch(/[A-Z_]{4,}/);
    }
  });
});
