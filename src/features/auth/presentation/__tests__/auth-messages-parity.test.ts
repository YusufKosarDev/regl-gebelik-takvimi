import { describeCatalogueParity } from '../../../../../jest/catalogue-parity';
import { AUTH_ERROR_CODES } from '../../domain/auth-error';
import { MINIMUM_PASSWORD_LENGTH } from '../../domain/password-policy';
import { syncMessages } from '../../../sync/presentation/sync-messages';
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
  it('still says an account is optional, in both languages', () => {
    expect(authMessages.en.accountDescription).toMatch(/optional/i);
    expect(authMessages.tr.accountDescription).toMatch(/isteğe bağlı/i);
  });

  it('still warns that restoring overwrites the phone', () => {
    expect(authMessages.en.restoreWarning).toMatch(/written over/i);
  });
});

/**
 * The header's promise about where the data is.
 *
 * It said "with or without an account, none of it is sent anywhere" while the
 * backup paragraph on the same screen said, correctly, that a sync copies five
 * categories of health data to the account - and under that, "Last sync: today
 * at 08:40". Found on a device, not by a test, because the test that was here
 * asserted the false half of it word for word.
 *
 * So these hold the rule instead of the wording. An unconditional "it goes
 * nowhere" cannot name the three things that send, which is why naming them is
 * the assertion: there is no way to satisfy it and still claim the data never
 * leaves. The reassurance has its own test, because the fix for a false
 * promise is a true one and not silence - and because this screen's sentence
 * has to agree with the Data Safety form, which declares data in transit.
 *
 * Both languages, because the Turkish is the one almost everybody reads and
 * the one nobody reviewing an English diff would notice going wrong.
 */
describe('where the account screen says the data goes', () => {
  const headers = [
    ['Turkish', authMessages.tr.accountDescription],
    ['English', authMessages.en.accountDescription],
  ] as const;

  it.each(headers)('%s keeps the part that is true: nowhere but your own account', (_, header) => {
    // The real reassurance, and the one claim that is unconditional: no third
    // party, no analytics, no other destination. Deleting the promise would be
    // a way to stop it being false, and it is not the one that was chosen.
    expect(header).toMatch(/hesabından başka hiçbir yere|nowhere but your own account/i);
  });

  it.each(headers)('%s names taking a backup as a way the data leaves', (_, header) => {
    expect(header).toMatch(/yedek|backup/i);
  });

  it.each(headers)('%s names syncing as a way the data leaves', (_, header) => {
    expect(header).toMatch(/senkronize|\bsync\b/i);
  });

  it.each(headers)('%s names automatic sync as a way the data leaves', (_, header) => {
    // The third one is its own assertion because it is the one that sends
    // without anybody pressing anything, and so the one a shortened sentence
    // drops first. "Nothing leaves unless you turn on sync" would pass the two
    // above and still be wrong about the two buttons.
    expect(header).toMatch(/otomatik senkronizasyon|automatic sync/i);
  });

  it('does not contradict the paragraph three blocks below it', () => {
    // The two are read one after the other by the same person. If the header
    // ever goes back to saying the data stays put, this fails on the pair
    // rather than on either sentence alone.
    for (const catalogue of [authMessages.tr, authMessages.en]) {
      const bodySends = /kopyalanır|copied to your account/i.test(
        catalogue.backupSectionDescription
      );

      expect(bodySends).toBe(true);
      expect(catalogue.accountDescription).toMatch(
        /senkronize ettiğinde|otomatik senkronizasyonu açtığında|when you take a backup|automatic sync on/i
      );
    }
  });
});

/**
 * The same rule, one paragraph lower.
 *
 * `backupSectionDescription` ended "nothing is sent at all until you press a
 * button" - and the automatic sync card is drawn directly beneath it, saying
 * that changes are synced by themselves while the app is open. True by
 * default, written as though the default could not be changed, on the screen
 * that carries the switch for changing it.
 *
 * It had a test of its own asserting `/until you press a button/i`, which is
 * the second assertion in this file to have pinned a false sentence word for
 * word. Both were written the same way: read the shipped copy, assert the
 * copy. A test that quotes the string back cannot tell you the string is
 * wrong, and both of these were green while the screen contradicted itself.
 *
 * So the split here is the same one the header got. What is unconditionally
 * true keeps an unconditional assertion; what depends on a setting has to name
 * the setting.
 */
describe('what the account screen says a sync sends', () => {
  const paragraphs = [
    ['Turkish', authMessages.tr.backupSectionDescription],
    ['English', authMessages.en.backupSectionDescription],
  ] as const;

  it.each(paragraphs)('%s still says nothing beyond those categories is sent', (_, body) => {
    // Unconditional and true: the claim about third parties. The fix for the
    // timing clause was not allowed to cost this.
    //
    // Deliberately loose about which way the Turkish says it - "başka hiçbir
    // şey" and "bunların dışında hiçbir şey" are the same claim, and pinning
    // the one that happens to be in the file today is how the last two tests
    // in this file ended up asserting a sentence instead of a rule.
    expect(body).toMatch(
      /(başka|bunların dışında) hiçbir şey gönderilmez|nothing else is (ever )?sent/i
    );
  });

  it.each(paragraphs)('%s still names what a sync copies to the account', (_, body) => {
    expect(body).toMatch(/hesabına.*kopyalanır|copied to your account/is);
  });

  it.each(paragraphs)('%s names a button as something that starts a send', (_, body) => {
    expect(body).toMatch(/düğme|press a button/i);
  });

  it.each(paragraphs)('%s names automatic sync as something that starts a send', (_, body) => {
    // The assertion the old sentence could not have passed. "Nothing is sent
    // until you press a button" names the buttons and stops, which is exactly
    // the half-truth that shipped; naming the switch too is what makes the
    // sentence hold whether or not the switch is on.
    expect(body).toMatch(/otomatik senkronizasyonu açmadığın|turn on automatic sync/i);
  });

  it('does not contradict the automatic sync card drawn directly beneath it', () => {
    // Read as a pair, the way somebody scrolling reads them. The card says the
    // app sends by itself; the paragraph above it may not say that nothing is
    // sent without a press.
    for (const [auth, sync, sendsByItself] of [
      [authMessages.tr, syncMessages.tr, /kendiliğinden/i],
      [authMessages.en, syncMessages.en, /by themselves/i],
    ] as const) {
      expect(sync.automaticSyncNote).toMatch(sendsByItself);
      expect(auth.backupSectionDescription).toMatch(
        /otomatik senkronizasyonu açmadığın|turn on automatic sync/i
      );
    }
  });
});
