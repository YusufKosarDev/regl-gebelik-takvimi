import { readFileSync } from 'fs';
import { join } from 'path';

import {
  LOCK_UNREADABLE_MESSAGE,
  NO_ACCOUNT_BODY,
  NO_ACCOUNT_CREATE_LABEL,
  SETUP_DESCRIPTION,
  SETUP_HONESTY_NOTE,
  SETUP_WRITE_IT_DOWN_NOTE,
  enteredDigitsLabel,
  remainingAttemptsMessage,
} from '../app-lock-messages';
import { waitMessage } from '../wait-message';

const MESSAGES_FILE = readFileSync(join(__dirname, '..', 'app-lock-messages.ts'), 'utf8');

/**
 * The sentence the whole feature's honesty rests on.
 *
 * Written as a test because the risk is a future copy edit, not a bug. Somebody
 * tidying the setup screen shortens a long note, and the app quietly starts
 * implying it encrypts a database that it does not encrypt.
 */
describe('SETUP_HONESTY_NOTE', () => {
  it('exists and is not empty', () => {
    expect(SETUP_HONESTY_NOTE.trim().length).toBeGreaterThan(40);
  });

  it('says the lock does not encrypt the files', () => {
    expect(SETUP_HONESTY_NOTE).toContain('şifrelemez');
  });

  it('points at the device lock as the real protection', () => {
    expect(SETUP_HONESTY_NOTE).toContain('ekran kilidi');
  });

  // The failure this guards against is a note that is technically present but
  // has been softened into saying nothing.
  it('does not claim the opposite anywhere in the file', () => {
    expect(MESSAGES_FILE).not.toMatch(/verilerin şifrelen/i);
    expect(MESSAGES_FILE).not.toMatch(/şifrelenir/i);
    expect(MESSAGES_FILE).not.toMatch(/güvenle saklan/i);
  });
});

describe('nothing here promises more than the lock does', () => {
  it('describes the lock as closing the screen, not the data', () => {
    expect(SETUP_DESCRIPTION).toContain('göremez');
    expect(SETUP_DESCRIPTION).not.toContain('şifre');
  });

  // The thing somebody seeing this will be afraid of is that their records are
  // gone. They are not, and the message says so.
  it('reassures about the records when the lock cannot be read', () => {
    expect(LOCK_UNREADABLE_MESSAGE).toContain('Kayıtların yerinde');
  });
});

describe('the account-less warning', () => {
  it('says plainly that the records go', () => {
    expect(NO_ACCOUNT_BODY).toContain('bütün kayıtların gider');
  });

  it('offers opening an account as the way out', () => {
    expect(NO_ACCOUNT_CREATE_LABEL).toBe('Hesap aç');
  });

  it('repeats it at the end of setup, where the decision is actually made', () => {
    expect(SETUP_WRITE_IT_DOWN_NOTE).toContain('not et');
  });
});

describe('what a screen reader hears', () => {
  // The count is not secret; the digits are.
  it('announces how many digits are in, never which', () => {
    expect(enteredDigitsLabel(0)).toBe('6 haneden 0 tanesi girildi');
    expect(enteredDigitsLabel(3)).toBe('6 haneden 3 tanesi girildi');
    expect(enteredDigitsLabel(6)).toBe('6 haneden 6 tanesi girildi');
  });
});

describe('remainingAttemptsMessage', () => {
  it('counts the tries left', () => {
    expect(remainingAttemptsMessage(2)).toBe('2 deneme hakkın kaldı.');
    expect(remainingAttemptsMessage(1)).toBe('1 deneme hakkın kaldı.');
  });
});

describe('waitMessage', () => {
  it('rounds up, so a countdown never reaches zero while the pad still refuses', () => {
    expect(waitMessage(1)).toContain('1 saniye');
    expect(waitMessage(900)).toContain('1 saniye');
    expect(waitMessage(30_000)).toContain('30 saniye');
  });

  it('switches to minutes rather than reading out 1740 seconds', () => {
    expect(waitMessage(60_000)).toContain('1 dakika');
    expect(waitMessage(5 * 60_000)).toContain('5 dakika');
    expect(waitMessage(29 * 60_000)).toContain('29 dakika');
    expect(waitMessage(30 * 60_000)).toContain('30 dakika');
  });

  it('says nought seconds rather than a negative one', () => {
    expect(waitMessage(0)).toContain('0 saniye');
    expect(waitMessage(-5_000)).toContain('0 saniye');
  });
});

/**
 * The PIN is the one thing nobody else gets to see.
 *
 * No message may carry one, and none may be built by concatenating digits.
 */
describe('no message can carry a PIN', () => {
  it('has no six-digit literal anywhere in the file', () => {
    const withoutComments = MESSAGES_FILE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');

    expect(withoutComments).not.toMatch(/'[0-9]{6}'/);
    expect(withoutComments).not.toMatch(/"[0-9]{6}"/);
  });
});
