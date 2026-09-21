import { DELETION_FAILURES } from '../../domain/deletion-outcome';
import type { AccountDeletionOutcome } from '../../domain/deletion-outcome';
import {
  ACCOUNT_DELETE_WIPE_OFF_NOTE,
  ACCOUNT_DELETE_WIPE_ON_NOTE,
  LOCAL_WIPE_CLOUD_DISCLAIMER,
  LOCAL_WIPE_PANEL_BODY,
  LOCAL_WIPE_SECTION_DESCRIPTION,
  accountDeletionMessage,
  localWipeMessage,
  shouldRetryWithPassword,
} from '../deletion-messages';

describe('what a finished account deletion says', () => {
  it('says the records stayed when only the account went', () => {
    expect(accountDeletionMessage({ kind: 'deleted' })).toBe(
      'Hesabın silindi. Kayıtların bu telefonda kaldı.'
    );
  });

  it('says both went when both went', () => {
    expect(accountDeletionMessage({ kind: 'deleted-and-wiped' })).toBe(
      'Hesabın ve bu cihazdaki tüm verilerin silindi.'
    );
  });

  it('says the account went but the phone did not, and where to try again', () => {
    const message = accountDeletionMessage({ kind: 'deleted-wipe-failed' });

    expect(message).toContain('Hesabın silindi');
    expect(message).toContain('Tüm verilerimi sil');
  });
});

describe('what a failed account deletion says', () => {
  it.each([...DELETION_FAILURES])('has a sentence for %s', (reason) => {
    const message = accountDeletionMessage({ kind: 'failed', reason });

    expect(typeof message).toBe('string');
    expect(message.length).toBeGreaterThan(0);
  });

  it('tells somebody to type the password again rather than to sign out', () => {
    // The password is asked for on the same screen this appears on.
    const message = accountDeletionMessage({
      kind: 'failed',
      reason: 'requires-recent-login',
    });

    expect(message).toBe('Güvenlik için şifreni tekrar girip yeniden denemen gerekiyor.');
    expect(message).not.toContain('Çıkış');
  });

  it('says nothing was deleted when the cloud delete failed', () => {
    const message = accountDeletionMessage({ kind: 'failed', reason: 'cloud-delete-failed' });

    expect(message).toContain('Hesabın silinmedi');
  });

  it('says the backup already went when only the account delete failed', () => {
    // The opposite of the one above, and the difference matters: this person's
    // backup is gone whether or not they try again.
    const message = accountDeletionMessage({ kind: 'failed', reason: 'account-delete-failed' });

    expect(message).toContain('yedeğin silindi');
    expect(message).toContain('hesap silinemedi');
  });

  it('gives the two middle failures different sentences', () => {
    expect(accountDeletionMessage({ kind: 'failed', reason: 'cloud-delete-failed' })).not.toBe(
      accountDeletionMessage({ kind: 'failed', reason: 'account-delete-failed' })
    );
  });

  it('never repeats a sentence across two different reasons', () => {
    const messages = DELETION_FAILURES.map((reason) =>
      accountDeletionMessage({ kind: 'failed', reason })
    );

    // `signed-out` and `unknown` are allowed to be distinct; every one of them
    // should be, because each names a different thing to do next.
    expect(new Set(messages).size).toBe(messages.length);
  });
});

describe('when the password field should be cleared and the panel kept open', () => {
  it.each([
    ['a wrong password', 'invalid-credentials'],
    ['a session that needs re-proving', 'requires-recent-login'],
  ])('is true for %s', (_label, reason) => {
    expect(
      shouldRetryWithPassword({ kind: 'failed', reason } as AccountDeletionOutcome)
    ).toBe(true);
  });

  it.each([
    ['no connection', 'network-failed'],
    ['a failed cloud delete', 'cloud-delete-failed'],
    ['a failed account delete', 'account-delete-failed'],
    ['too many attempts', 'too-many-requests'],
  ])('is false for %s, where retyping changes nothing', (_label, reason) => {
    expect(
      shouldRetryWithPassword({ kind: 'failed', reason } as AccountDeletionOutcome)
    ).toBe(false);
  });

  it('is false for every success', () => {
    expect(shouldRetryWithPassword({ kind: 'deleted' })).toBe(false);
    expect(shouldRetryWithPassword({ kind: 'deleted-and-wiped' })).toBe(false);
    expect(shouldRetryWithPassword({ kind: 'deleted-wipe-failed' })).toBe(false);
  });
});

describe('the checkbox notes', () => {
  it('says the records stay when it is off', () => {
    expect(ACCOUNT_DELETE_WIPE_OFF_NOTE).toContain('telefonunda kalacak');
  });

  it('says what goes when it is on', () => {
    expect(ACCOUNT_DELETE_WIPE_ON_NOTE).toContain('silinecek');
  });

  it('gives the two states different words', () => {
    expect(ACCOUNT_DELETE_WIPE_OFF_NOTE).not.toBe(ACCOUNT_DELETE_WIPE_ON_NOTE);
  });
});

describe('what a local wipe says', () => {
  it('says nothing at all when it succeeds', () => {
    // The screen is being unmounted as the onboarding flag flips; a message
    // here would either never be read or be set on a component that has gone.
    expect(localWipeMessage({ kind: 'wiped' })).toBeNull();
  });

  it('says nothing changed when it fails', () => {
    expect(localWipeMessage({ kind: 'failed', reason: 'local-failed' })).toContain(
      'Hiçbir şey değişmedi'
    );
  });

  it('admits the gap when it half worked', () => {
    expect(localWipeMessage({ kind: 'partial' })).toContain('silindi');
  });
});

describe('keeping the two actions apart', () => {
  it('says outright that the cloud backup and account are not deleted', () => {
    expect(LOCAL_WIPE_CLOUD_DISCLAIMER).toContain('silinmez');
  });

  it('points at the other action by name', () => {
    expect(LOCAL_WIPE_CLOUD_DISCLAIMER).toContain('Hesabı sil');
  });

  it('never claims the local wipe removes everything everywhere', () => {
    for (const copy of [LOCAL_WIPE_SECTION_DESCRIPTION, LOCAL_WIPE_PANEL_BODY]) {
      expect(copy).toMatch(/telefon|cihaz/i);
    }
  });
});
