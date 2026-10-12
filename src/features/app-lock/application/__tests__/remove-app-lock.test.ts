import {
  deleteLockRecord,
  readLockRecord,
  writeLockRecord,
} from '../../infrastructure/lock-record-store';
import {
  isAppLockBoundTo,
  isAppLockEnabled,
  isAppLockRecoverable,
  remainingLockWaitMs,
  removeAppLock,
  unbindAppLock,
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
  writeLockRecord: jest.fn(),
}));

const read = jest.mocked(readLockRecord);
const remove = jest.mocked(deleteLockRecord);
const write = jest.mocked(writeLockRecord);

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
  write.mockReset();
  remove.mockResolvedValue(undefined as never);
  write.mockResolvedValue(undefined as never);
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

/**
 * Cutting the lock loose from an account that has stopped existing.
 *
 * `boundUid` is the account allowed to reset the lock by password, and
 * `isRecoverable` is only `boundUid !== null`. Pointing at a deleted uid it is
 * a yes to a question whose answer is no: the lock screen draws "I forgot my
 * PIN", the recovery screen takes an email and a password, and signing in
 * cannot succeed because the account is gone - so the person is told their
 * password is wrong about an account that no longer exists.
 *
 * The two halves are tested separately on purpose, because the dangerous
 * mistake is to fix this by calling `removeAppLock`. That would take the PIN
 * off somebody's records as a side effect of deleting an account, and the
 * records are still there.
 */
describe('cutting the lock loose from a deleted account', () => {
  it('clears the binding', async () => {
    read.mockResolvedValue(recordWith({ boundUid: 'uid-1' }) as never);

    await unbindAppLock();

    expect(write).toHaveBeenCalledWith(expect.objectContaining({ boundUid: null }));
  });

  it('leaves the lock on, and everything that opens it untouched', async () => {
    // The whole of the risk in one assertion. A hash or a salt that did not
    // survive would be a lock nobody can open, which is worse than the defect
    // this function exists to remove.
    read.mockResolvedValue(
      recordWith({
        boundUid: 'uid-1',
        hash: 'the-hash',
        salt: 'the-salt',
        biometricsEnabled: true,
        attempts: { failedCount: 2, lockedUntil: 123 },
      }) as never
    );

    await unbindAppLock();

    expect(remove).not.toHaveBeenCalled();
    expect(write).toHaveBeenCalledWith({
      hash: 'the-hash',
      salt: 'the-salt',
      biometricsEnabled: true,
      attempts: { failedCount: 2, lockedUntil: 123 },
      boundUid: null,
    });
  });

  it('makes the lock stop claiming it can be reset', async () => {
    // Read from the other end: the question the lock screen actually asks.
    read.mockResolvedValue(recordWith({ boundUid: 'uid-1' }) as never);

    await unbindAppLock();

    const written = write.mock.calls[0]?.[0];

    read.mockResolvedValue({ kind: 'record', record: written } as never);

    expect(await isAppLockRecoverable()).toBe(false);
  });

  it('writes nothing when the lock was never bound to an account', async () => {
    read.mockResolvedValue(recordWith({ boundUid: null }) as never);

    await unbindAppLock();

    expect(write).not.toHaveBeenCalled();
  });

  it('writes nothing when there is no lock, or it cannot be read', async () => {
    // Called after the account is already gone, where nothing may fail. An
    // unreadable record has been deleted by the read itself, so there is no
    // binding left to cut and nothing to rewrite.
    for (const outcome of [{ kind: 'none' }, { kind: 'unreadable' }]) {
      write.mockClear();
      read.mockResolvedValue(outcome as never);

      await unbindAppLock();

      expect([outcome.kind, write.mock.calls.length]).toEqual([outcome.kind, 0]);
    }
  });

  it('does not throw when the record cannot be written back', async () => {
    // The account is already deleted by the time this runs. Throwing here
    // would turn a deletion that happened into one that reports failure.
    read.mockResolvedValue(recordWith({ boundUid: 'uid-1' }) as never);
    write.mockRejectedValue(new Error('secure store is unavailable') as never);

    await expect(unbindAppLock()).resolves.toBeUndefined();
  });
});
