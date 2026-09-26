import type { LockContext } from '../lock-decision';
import { GRACE_WINDOW_MS, shouldLockOnForeground, shouldLockOnStart } from '../lock-decision';

/**
 * Whether the lock should be on screen.
 *
 * Every boundary is tested from both sides, because a person coming back to
 * their phone lands on exactly one of them every time.
 */

const NOW = 1_800_000_000_000;

function context(overrides: Partial<LockContext> = {}): LockContext {
  return {
    enabled: true,
    backgroundedAt: NOW - GRACE_WINDOW_MS,
    authenticationInProgress: false,
    ...overrides,
  };
}

describe('a cold start', () => {
  it('locks when a lock is set', () => {
    expect(shouldLockOnStart(true)).toBe(true);
  });

  it('does not when there is none', () => {
    expect(shouldLockOnStart(false)).toBe(false);
  });

  // A cold start has no previous moment, which is what makes "always lock on a
  // cold start" fall out of the same rule rather than sitting beside it.
  it('reads as no previous moment through the same rule', () => {
    expect(shouldLockOnForeground(context({ backgroundedAt: null }), NOW)).toBe(true);
  });
});

describe('coming back from the background', () => {
  it('is fifteen seconds', () => {
    expect(GRACE_WINDOW_MS).toBe(15_000);
  });

  it('does not lock inside the window', () => {
    expect(shouldLockOnForeground(context({ backgroundedAt: NOW }), NOW)).toBe(false);
    expect(shouldLockOnForeground(context({ backgroundedAt: NOW - 1 }), NOW)).toBe(false);
    expect(shouldLockOnForeground(context({ backgroundedAt: NOW - 14_999 }), NOW)).toBe(false);
  });

  it('locks at the moment the window closes, not a tick later', () => {
    expect(shouldLockOnForeground(context({ backgroundedAt: NOW - 15_000 }), NOW)).toBe(true);
  });

  it('locks well outside it', () => {
    expect(shouldLockOnForeground(context({ backgroundedAt: NOW - 60_000 }), NOW)).toBe(true);
    expect(shouldLockOnForeground(context({ backgroundedAt: NOW - 86_400_000 }), NOW)).toBe(true);
  });
});

describe('with no lock set', () => {
  it('never locks, however long the app was away', () => {
    expect(shouldLockOnForeground(context({ enabled: false, backgroundedAt: null }), NOW)).toBe(
      false
    );
    expect(
      shouldLockOnForeground(context({ enabled: false, backgroundedAt: NOW - 86_400_000 }), NOW)
    ).toBe(false);
  });
});

/**
 * The loop this guard exists to stop.
 *
 * On several Android devices the biometric sheet sends the activity to the
 * background. Without this, the app re-locks the instant the fingerprint prompt
 * opens and unlocking becomes impossible.
 */
describe('while the biometric prompt is up', () => {
  it('does not lock, however long the prompt has been open', () => {
    expect(
      shouldLockOnForeground(
        context({ authenticationInProgress: true, backgroundedAt: NOW - 60_000 }),
        NOW
      )
    ).toBe(false);
  });

  it('does not lock on what looks like a cold start either', () => {
    expect(
      shouldLockOnForeground(
        context({ authenticationInProgress: true, backgroundedAt: null }),
        NOW
      )
    ).toBe(false);
  });

  it('locks again once the prompt is gone and the window has passed', () => {
    expect(
      shouldLockOnForeground(
        context({ authenticationInProgress: false, backgroundedAt: NOW - 60_000 }),
        NOW
      )
    ).toBe(true);
  });
});

/**
 * A clock that moved while the app was away.
 *
 * Locking somebody out because their phone crossed a timezone would be a bug
 * with a real cost, and the window is a courtesy rather than a defence.
 */
describe('a clock that moved backwards', () => {
  it('reads as no elapsed time rather than as a very long absence', () => {
    expect(shouldLockOnForeground(context({ backgroundedAt: NOW + 60_000 }), NOW)).toBe(false);
  });
});
