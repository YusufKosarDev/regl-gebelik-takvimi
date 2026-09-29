import { describeCatalogueParity } from '../../../../../jest/catalogue-parity';
import { PIN_LENGTH } from '../../domain/pin';
import { appLockMessages } from '../app-lock-messages';
import { waitMessageIn } from '../wait-message';

/**
 * The app lock's words, in both languages.
 *
 * Its own file rather than a block inside `app-lock-messages.test.ts`, which
 * asserts the Turkish and predates the second language. Nothing in it moved.
 *
 * The first block is the reason this feature is honest, and it is the one that
 * must never be allowed to drift in either language.
 */

describe('parity', () => {
  describeCatalogueParity(appLockMessages, {
    functions: [
      ['remainingAttemptsMessage', [1], [3]],
      ['waitSecondsMessage', [1], [30]],
      ['waitMinutesMessage', [1], [30]],
      ['enteredDigitsLabel', [0], [3], [6]],
    ],
  });
});

describe('the sentence this feature is honest because of', () => {
  it('says the lock does not encrypt the files, in both languages', () => {
    // Somebody reading "App lock" and assuming their records are encrypted
    // would act on the belief - keeping the app on a shared phone, handing it
    // over, not worrying about a repair shop. A lock that allowed that would be
    // worse than no lock.
    expect(appLockMessages.en.setupHonestyNote).toMatch(/does not encrypt/i);
    expect(appLockMessages.tr.setupHonestyNote).toMatch(/şifrelemez/);
  });

  it('says the phone’s own lock is still the real protection', () => {
    expect(appLockMessages.en.setupHonestyNote).toMatch(/real protection/i);
    expect(appLockMessages.tr.setupHonestyNote).toMatch(/asıl koruma/);
  });

  it('is not shortened in either language', () => {
    // Do not soften it, do not shorten it, do not move it below the fold.
    for (const catalogue of [appLockMessages.tr, appLockMessages.en]) {
      expect(catalogue.setupHonestyNote.length).toBeGreaterThan(80);
    }
  });
});

describe('what the lock warns about', () => {
  it('still says a forgotten PIN has no way back without an account', () => {
    // Three claims, and all three have to survive: the account password is the
    // only recovery, there is no account, and the records go with a reinstall.
    expect(appLockMessages.en.noAccountBody).toMatch(/only way back in is your account password/i);
    expect(appLockMessages.en.noAccountBody).toMatch(/could not be opened at all/i);
    expect(appLockMessages.en.noAccountBody).toMatch(/every record on this phone/i);
  });

  it('still says the widget is not locked', () => {
    // The widget shows what it shows to anybody picking up the phone.
    expect(appLockMessages.en.setupWidgetNote).toMatch(/not locked/i);
  });

  it('still says the lock changes the notification wording, and where to undo it', () => {
    // Doing it silently would be the app deciding something on somebody's
    // behalf, which is what the rest of this feature refuses to do.
    expect(appLockMessages.en.setupDiscreetNotificationsNote).toMatch(/plainer|do not mention/i);
    expect(appLockMessages.en.setupDiscreetNotificationsNote).toMatch(/Settings > Notifications/);
  });

  it('still says deleting the bound account closes the only way back', () => {
    expect(appLockMessages.en.lockBoundToAccountWarning).toMatch(/no way back/i);
  });

  it('still says the records are fine when the lock cannot be read', () => {
    // That is the thing somebody seeing it will be afraid of, and it is true.
    expect(appLockMessages.en.lockUnreadableMessage).toMatch(/records are where you left them/i);
  });
});

describe('counting tries and waits', () => {
  it('pluralises the tries left in English', () => {
    // On a screen somebody is already frustrated at, "1 tries left" reads as
    // carelessness.
    expect(appLockMessages.en.remainingAttemptsMessage(1)).toBe('1 try left.');
    expect(appLockMessages.en.remainingAttemptsMessage(3)).toBe('3 tries left.');
  });

  it('pluralises both waits in English', () => {
    expect(appLockMessages.en.waitSecondsMessage(1)).toContain('1 second');
    expect(appLockMessages.en.waitSecondsMessage(1)).not.toContain('1 seconds');
    expect(appLockMessages.en.waitMinutesMessage(1)).toContain('1 minute');
    expect(appLockMessages.en.waitMinutesMessage(1)).not.toContain('1 minutes');
  });

  it('rounds a wait up and switches to minutes at sixty seconds', () => {
    // A countdown that reaches zero while the pad is still refusing is worse
    // than one that is a moment pessimistic.
    expect(waitMessageIn(appLockMessages.en, 900)).toContain('1 second');
    expect(waitMessageIn(appLockMessages.en, 59_000)).toContain('59 seconds');
    expect(waitMessageIn(appLockMessages.en, 60_000)).toContain('1 minute');
    expect(waitMessageIn(appLockMessages.en, 1_740_000)).toContain('29 minutes');
  });
});

describe('what the dots say', () => {
  it('reports the count and never the digits, in both languages', () => {
    for (const catalogue of [appLockMessages.tr, appLockMessages.en]) {
      const label = catalogue.enteredDigitsLabel(3);

      expect(label).toContain('3');
      expect(label).toContain(String(PIN_LENGTH));
    }
  });

  it('builds the length from PIN_LENGTH rather than writing it out', () => {
    // The sentence and the pad cannot disagree about how many digits there are.
    for (const catalogue of [appLockMessages.tr, appLockMessages.en]) {
      expect(catalogue.setupDescription).toContain(String(PIN_LENGTH));
    }
  });
});
