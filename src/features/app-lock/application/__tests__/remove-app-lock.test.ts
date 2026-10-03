import { deleteLockRecord, readLockRecord } from '../../infrastructure/lock-record-store';
import {
  isAppLockBoundTo,
  isAppLockEnabled,
  isAppLockRecoverable,
  remainingLockWaitMs,
  removeAppLock,
} from '../remove-app-lock';

/**
 * The questions the screens ask about the lock, and taking it off.
 *
 * ## Why this file exists
 *
 * 55% statements and 22% branches, on the module that answers "is there a lock"
 * and "can it be reset". Each function is three lines, and every one of them
 * has an unreadable-record branch that nothing exercised - which is the branch
 * where a wrong answer is dangerous in both directions: claiming no lock when
 * there is one, or refusing a reset that would have worked.
 *
 * ## What removal must not do
 *
 * `removeAppLock` deletes the record and nothing else. It sits beside the
 * account wipe in the same feature, and the one assertion worth having here is
 * that it has not grown into one.
 */

jest.mock('../../infrastructure/lock-record-store', () => ({
  readLockRecord: jest.fn(),
  deleteLockRecord: jest.fn(),
}));

const read = jest.mocked(readLockRecord);
const remove = jest.mocked(deleteLockRecord);

const NOW = 1_700_000_000_000;

function recordWith(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'record' as const,
    record: {
      hash: 'hash',
      salt: 'salt',
      attempts: { failedCount: 0, lockedUntil: null },
      biometricsEnabled: false,
      boundUid: null,
      ...overrides,
    },
  };
}

beforeEach(() => {
  read.mockReset();
  remove.mockReset();
  remove.mockResolvedValue(undefined as never);
});

describe('taking the lock off', () => {
  it('deletes the record', async () => {
    await removeAppLock();

    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('touches nothing else', async () => {
    // Turning off a lock is not a reason to lose anything. This module sits
    // beside the account wipe, which is exactly why it has to be said in a
    // test and not only in a comment.
    await removeAppLock();

    expect(read).not.toHaveBeenCalled();
  });
});

describe('whether a lock is set', () => {
  it('says yes for a stored record', async () => {
    read.mockResolvedValue(recordWith() as never);

    expect(await isAppLockEnabled()).toBe(true);
  });

  it('says no when none was set', async () => {
    read.mockResolvedValue({ kind: 'absent' } as never);

    expect(await isAppLockEnabled()).toBe(false);
  });

  it('says no for a record it cannot read, rather than guessing', async () => {
    // The same failing-open choice the store makes. Treating "broken" as "on"
    // would lock somebody out of their own records with no PIN that opens it.
    read.mockResolvedValue({ kind: 'unreadable' } as never);

    expect(await isAppLockEnabled()).toBe(false);
  });
});

describe('whether it can be reset with an account password', () => {
  it('says yes for a lock bound to an account', async () => {
    read.mockResolvedValue(recordWith({ boundUid: 'uid-1' }) as never);

    expect(await isAppLockRecoverable()).toBe(true);
  });

  it('says no for a lock set without one', async () => {
    // The person was told at setup that there would be no way back. A link
    // that led to a refusal would be a second, crueller way of telling them.
    read.mockResolvedValue(recordWith({ boundUid: null }) as never);

    expect(await isAppLockRecoverable()).toBe(false);
  });

  it('says no when there is no lock at all', async () => {
    read.mockResolvedValue({ kind: 'absent' } as never);

    expect(await isAppLockRecoverable()).toBe(false);
  });

  it('says no for an unreadable record', async () => {
    read.mockResolvedValue({ kind: 'unreadable' } as never);

    expect(await isAppLockRecoverable()).toBe(false);
  });
});

describe('how long it is still refusing attempts', () => {
  it('reports a wait that survived a restart', async () => {
    // Without this the lock screen lets somebody spend six digits to discover
    // they are still waiting.
    read.mockResolvedValue(
      recordWith({ attempts: { failedCount: 5, lockedUntil: NOW + 30_000 } }) as never
    );

    expect(await remainingLockWaitMs(NOW)).toBe(30_000);
  });

  it('reports nothing once the wait has passed', async () => {
    read.mockResolvedValue(
      recordWith({ attempts: { failedCount: 5, lockedUntil: NOW - 1 } }) as never
    );

    expect(await remainingLockWaitMs(NOW)).toBe(0);
  });

  it('reports nothing when there is no lock', async () => {
    read.mockResolvedValue({ kind: 'absent' } as never);

    expect(await remainingLockWaitMs(NOW)).toBe(0);
  });

  it('reports nothing for an unreadable record', async () => {
    read.mockResolvedValue({ kind: 'unreadable' } as never);

    expect(await remainingLockWaitMs(NOW)).toBe(0);
  });
});

describe('whether the lock is bound to one account', () => {
  it('recognises the account it was bound to', async () => {
    read.mockResolvedValue(recordWith({ boundUid: 'uid-1' }) as never);

    expect(await isAppLockBoundTo('uid-1')).toBe(true);
  });

  it('does not match a different account', async () => {
    // Asked before deleting an account, because deleting the one a lock is
    // bound to makes that lock unrecoverable. A false match here would warn
    // the wrong person; a false miss would warn nobody.
    read.mockResolvedValue(recordWith({ boundUid: 'uid-1' }) as never);

    expect(await isAppLockBoundTo('uid-2')).toBe(false);
  });

  it('does not match a lock bound to nothing', async () => {
    read.mockResolvedValue(recordWith({ boundUid: null }) as never);

    expect(await isAppLockBoundTo('uid-1')).toBe(false);
  });

  it('does not match when there is no lock or it cannot be read', async () => {
    for (const outcome of [{ kind: 'absent' }, { kind: 'unreadable' }]) {
      read.mockResolvedValue(outcome as never);

      expect([outcome.kind, await isAppLockBoundTo('uid-1')]).toEqual([outcome.kind, false]);
    }
  });
});
