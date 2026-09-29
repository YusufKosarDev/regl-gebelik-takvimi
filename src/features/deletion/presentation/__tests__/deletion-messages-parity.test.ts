import { describeCatalogueParity } from '../../../../../jest/catalogue-parity';
import { DELETION_FAILURES } from '../../domain/deletion-outcome';
import { accountDeletionMessageIn, deletionMessages, localWipeMessageIn } from '../deletion-messages';

/**
 * The deletion words, in both languages.
 *
 * Its own file rather than a block inside `deletion-messages.test.ts`, which
 * asserts the Turkish and predates the second language. Nothing in it moved.
 *
 * Deleting is the one thing in this app that cannot be undone, so these
 * assertions are about meaning rather than about keys: what is gone, what is
 * not, and never reporting a failure as though nothing happened when something
 * did.
 */

describe('parity', () => {
  describeCatalogueParity(deletionMessages);
});

describe('saying what is gone and what is not', () => {
  it('tells a local wipe it does not touch the account, in both languages', () => {
    // Without this line "all my data" reads as "all of my data, everywhere",
    // and somebody would use it believing their cloud backup went with it.
    expect(deletionMessages.en.localWipeCloudDisclaimer).toMatch(/not deleted/i);
    expect(deletionMessages.en.localWipeCloudDisclaimer).toMatch(/account/i);
    expect(deletionMessages.tr.localWipeCloudDisclaimer).toMatch(/silinmez/);
  });

  it('keeps the two wipe notes opposite', () => {
    // One says the records stay, the other says they go. A translation that
    // blurred them would leave somebody deleting more than they meant to.
    expect(deletionMessages.en.accountDeleteWipeOffNote).toMatch(/stay/i);
    expect(deletionMessages.en.accountDeleteWipeOnNote).toMatch(/deleted/i);
    expect(deletionMessages.en.accountDeleteWipeOffNote).not.toBe(
      deletionMessages.en.accountDeleteWipeOnNote
    );
  });

  it('names the section and the button differently', () => {
    // A screen reader announcing the same words twice in a row gives no clue
    // which one is the control.
    for (const catalogue of [deletionMessages.tr, deletionMessages.en]) {
      expect(catalogue.accountDeleteSectionTitle).not.toBe(catalogue.accountDeleteOpenLabel);
      expect(catalogue.localWipeSectionTitle).not.toBe(catalogue.localWipeOpenLabel);
    }
  });
});

describe('every failure has a sentence', () => {
  it.each(DELETION_FAILURES)('%s is answered in both languages', (reason) => {
    for (const catalogue of [deletionMessages.tr, deletionMessages.en]) {
      const message = accountDeletionMessageIn(catalogue, { kind: 'failed', reason });

      expect(message.trim()).not.toBe('');

      // Every named reason gets its own sentence. `unknown` is the one that is
      // allowed to be the fallback, because it is the fallback.
      if (reason !== 'unknown') {
        expect([reason, message]).not.toEqual([
          reason,
          catalogue.accountDeleteFailures.unknown,
        ]);
      }
    }
  });

  it('keeps the two halves of the same moment apart', () => {
    // After cloud-delete-failed nothing has been deleted. After
    // account-delete-failed the backup is already gone and only the account
    // remains, and "your account was not deleted" alone would be true and
    // useless - they would not know their backup had gone with it.
    const cloud = accountDeletionMessageIn(deletionMessages.en, {
      kind: 'failed',
      reason: 'cloud-delete-failed',
    });
    const account = accountDeletionMessageIn(deletionMessages.en, {
      kind: 'failed',
      reason: 'account-delete-failed',
    });

    expect(cloud).not.toBe(account);
    expect(cloud).toMatch(/account was not deleted/i);
    expect(account).toMatch(/backup was deleted/i);
  });

  it('falls back to the unknown sentence rather than to nothing', () => {
    const message = accountDeletionMessageIn(deletionMessages.en, {
      kind: 'failed',
      reason: 'a-code-from-a-later-build',
    } as never);

    expect(message).toBe(deletionMessages.en.accountDeleteFailures.unknown);
  });
});

describe('what a success says', () => {
  it('does not claim a deletion that did not just happen', () => {
    // "already-deleted" is not "deleted". Saying the second would claim
    // something the app did not do.
    const message = accountDeletionMessageIn(deletionMessages.en, {
      kind: 'already-deleted',
    } as never);

    expect(message).toMatch(/already/i);
  });

  it('says the phone is still full when only the account went', () => {
    const message = accountDeletionMessageIn(deletionMessages.en, { kind: 'deleted' } as never);

    expect(message).toMatch(/stayed on this phone/i);
  });
});

describe('a wipe that worked says nothing', () => {
  it('returns null on success in both languages', () => {
    // A finished wipe swaps the route group and this screen stops existing, so
    // a success message would land on a screen nobody sees.
    for (const catalogue of [deletionMessages.tr, deletionMessages.en]) {
      expect(localWipeMessageIn(catalogue, { kind: 'wiped' } as never)).toBeNull();
    }
  });

  it('speaks up when it only partly worked', () => {
    expect(localWipeMessageIn(deletionMessages.en, { kind: 'partial' } as never)).toBe(
      deletionMessages.en.localWipePartialMessage
    );
  });

  it('says nothing changed when it failed outright', () => {
    expect(localWipeMessageIn(deletionMessages.en, { kind: 'failed' } as never)).toMatch(
      /nothing changed/i
    );
  });
});
