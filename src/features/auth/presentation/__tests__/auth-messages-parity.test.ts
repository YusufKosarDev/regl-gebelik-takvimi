import { describeCatalogueParity } from '../../../../../jest/catalogue-parity';
import { AUTH_ERROR_CODES } from '../../domain/auth-error';
import { MINIMUM_PASSWORD_LENGTH } from '../../domain/password-policy';
import { authErrorMessageIn, authMessages, passwordResetErrorMessageIn } from '../auth-messages';

/**
 * The account screen's words, in both languages.
 *
 * Its own file rather than a block inside `auth-messages.test.ts`, which
 * asserts the Turkish and predates the second language. Nothing in it moved.
 *
 * Two of these assertions are about privacy rather than wording. A form that
 * says "this address is taken" answers "does this person have an account here"
 * for anyone who types an address into it, and here that is a question about a
 * period tracker.
 */

describe('parity', () => {
  describeCatalogueParity(authMessages, {
    functions: [
      ['signedInAccountLabel', ['you@example.com'], [null]],
      ['previewRowLabel', ['Period records', '3 will be added']],
    ],
    // previewRowLabel is the ": " join of two values that have already been
    // translated. 'Avatar' is the same word in both languages, and it is the
    // one this app draws rather than a noun it chose.
    identical: ['previewRowLabel', 'restoreRowAvatar'],
  });
});

describe('what the form will not tell an onlooker', () => {
  it('answers a taken address and a malformed one identically, in both languages', () => {
    for (const catalogue of [authMessages.tr, authMessages.en]) {
      expect(authErrorMessageIn(catalogue, 'email-already-in-use')).toBe(
        authErrorMessageIn(catalogue, 'invalid-email')
      );
    }
  });

  it('says the same thing about a reset whether or not the account exists', () => {
    // The app is not told which it was, and a form that said "no account with
    // that address" would answer, for anyone who typed one in, whether its
    // owner tracks their period here.
    expect(authMessages.en.passwordResetSentMessage).toMatch(/if there is an account/i);
  });
});

describe('every auth error has a sentence', () => {
  it.each(AUTH_ERROR_CODES)('%s is answered in both languages', (code) => {
    for (const catalogue of [authMessages.tr, authMessages.en]) {
      expect(authErrorMessageIn(catalogue, code).trim()).not.toBe('');
    }
  });

  it('falls back to the plainest sentence for a code from a later build', () => {
    expect(authErrorMessageIn(authMessages.en, 'something-new')).toBe(
      authMessages.en.errors.unknown
    );
  });

  it('keeps the reset table separate from the sign-in one', () => {
    // "That email address cannot be used" is the right answer to an address
    // that cannot hold an account and the wrong answer to one simply typed
    // wrong.
    expect(passwordResetErrorMessageIn(authMessages.en, 'invalid-email')).not.toBe(
      authErrorMessageIn(authMessages.en, 'invalid-email')
    );
  });

  it('falls back to the sign-in unknown for a reset code it has no line for', () => {
    expect(passwordResetErrorMessageIn(authMessages.en, 'signed-out')).toBe(
      authMessages.en.errors.unknown
    );
  });
});

describe('the password length is stated once', () => {
  it.each(['tr', 'en'] as const)('%s builds both sentences from the constant', (language) => {
    // The hint under the field, the message the form shows and the message
    // Firebase triggers can never disagree about the number.
    const catalogue = authMessages[language];

    expect(catalogue.shortPasswordMessage).toContain(String(MINIMUM_PASSWORD_LENGTH));
    expect(catalogue.passwordHint).toContain(String(MINIMUM_PASSWORD_LENGTH));
    expect(catalogue.errors['weak-password']).toBe(catalogue.shortPasswordMessage);
  });
});

describe('what the screen says about itself', () => {
  it('still says an account is optional and nothing is sent without one', () => {
    expect(authMessages.en.accountDescription).toMatch(/optional/i);
    expect(authMessages.en.accountDescription).toMatch(/none of it is sent/i);
  });

  it('still says a backup sends nothing until a button is pressed', () => {
    expect(authMessages.en.backupSectionDescription).toMatch(/nothing else is sent/i);
    expect(authMessages.en.backupSectionDescription).toMatch(/until you press a button/i);
  });

  it('still warns that restoring overwrites the phone', () => {
    expect(authMessages.en.restoreWarning).toMatch(/written over/i);
  });
});
