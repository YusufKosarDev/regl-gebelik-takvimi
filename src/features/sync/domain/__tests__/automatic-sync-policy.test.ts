import type {
  AutomaticSyncPolicyInput,
  AutomaticSyncTrigger,
} from '../automatic-sync-policy';
import {
  LOCAL_CHANGE_DEBOUNCE_MS,
  MINIMUM_INTERVAL_MS,
  decideAutomaticSync,
} from '../automatic-sync-policy';

/**
 * The rule that decides whether a period history leaves a phone by itself.
 *
 * Every refusal is tested by name rather than by "it did not run": the whole
 * point of naming them is that a change which turns one refusal into another
 * has changed behaviour, even though nothing synced either way.
 */

/** Everything green. Each test breaks exactly one thing. */
const RUNNABLE: AutomaticSyncPolicyInput = {
  trigger: 'sign-in',
  automaticSyncEnabled: true,
  uid: 'uid-1',
  firebaseConfigured: true,
  deletionPending: false,
  conflictUnresolved: false,
  suspended: false,
  inFlight: false,
  nowMs: 1_000_000,
  lastAttemptAtMs: null,
};

const input = (overrides: Partial<AutomaticSyncPolicyInput> = {}): AutomaticSyncPolicyInput => ({
  ...RUNNABLE,
  ...overrides,
});

describe('when nothing is in the way', () => {
  it('runs', () => {
    expect(decideAutomaticSync(RUNNABLE)).toEqual({ kind: 'run' });
  });

  it('runs for every trigger there is, given enough time since the last one', () => {
    const triggers: readonly AutomaticSyncTrigger[] = [
      'foreground',
      'background-flush',
      'sign-in',
      'enabled',
      'local-change',
    ];

    for (const trigger of triggers) {
      expect(decideAutomaticSync(input({ trigger, lastAttemptAtMs: null }))).toEqual({
        kind: 'run',
      });
    }
  });
});

describe('the refusals that mean never, for now', () => {
  it('refuses with the switch off, and says that is why', () => {
    expect(decideAutomaticSync(input({ automaticSyncEnabled: false }))).toEqual({
      kind: 'skip',
      reason: 'disabled',
    });
  });

  it('refuses a build with no Firebase project', () => {
    expect(decideAutomaticSync(input({ firebaseConfigured: false }))).toEqual({
      kind: 'skip',
      reason: 'not-configured',
    });
  });

  it.each([[null], [''], ['   ']])('refuses when the uid is %p', (uid) => {
    expect(decideAutomaticSync(input({ uid }))).toEqual({ kind: 'skip', reason: 'signed-out' });
  });

  it('refuses while an account deletion is part-way through', () => {
    // Half of the deletion has happened: the cloud backup is gone but the
    // account is not. A sync here would write the data straight back.
    expect(decideAutomaticSync(input({ deletionPending: true }))).toEqual({
      kind: 'skip',
      reason: 'deletion-pending',
    });
  });

  it('refuses while a conflict is waiting for a person, for every trigger', () => {
    const triggers: readonly AutomaticSyncTrigger[] = [
      'foreground',
      'background-flush',
      'sign-in',
      'enabled',
      'local-change',
    ];

    for (const trigger of triggers) {
      expect(decideAutomaticSync(input({ trigger, conflictUnresolved: true }))).toEqual({
        kind: 'skip',
        reason: 'conflict-unresolved',
      });
    }
  });

  it('refuses while a wipe, restore or resolution holds the gate', () => {
    expect(decideAutomaticSync(input({ suspended: true }))).toEqual({
      kind: 'skip',
      reason: 'suspended',
    });
  });

  it('refuses while one is already running', () => {
    expect(decideAutomaticSync(input({ inFlight: true }))).toEqual({
      kind: 'skip',
      reason: 'in-flight',
    });
  });
});

describe('the order the rules are asked in', () => {
  it('reports the switch being off ahead of everything else', () => {
    // Otherwise somebody whose app is not syncing at all would be told it was
    // "too soon", which suggests it would have gone in four minutes.
    const decision = decideAutomaticSync(
      input({
        automaticSyncEnabled: false,
        firebaseConfigured: false,
        uid: null,
        deletionPending: true,
        conflictUnresolved: true,
        suspended: true,
        inFlight: true,
        trigger: 'foreground',
        lastAttemptAtMs: RUNNABLE.nowMs,
      })
    );

    expect(decision).toEqual({ kind: 'skip', reason: 'disabled' });
  });

  it('reports a conflict ahead of being suspended, in flight or too soon', () => {
    const decision = decideAutomaticSync(
      input({
        conflictUnresolved: true,
        suspended: true,
        inFlight: true,
        trigger: 'foreground',
        lastAttemptAtMs: RUNNABLE.nowMs,
      })
    );

    expect(decision).toEqual({ kind: 'skip', reason: 'conflict-unresolved' });
  });

  it('reports a pending deletion ahead of a conflict', () => {
    expect(
      decideAutomaticSync(input({ deletionPending: true, conflictUnresolved: true }))
    ).toEqual({ kind: 'skip', reason: 'deletion-pending' });
  });

  it('reports being signed out ahead of a pending deletion', () => {
    expect(decideAutomaticSync(input({ uid: null, deletionPending: true }))).toEqual({
      kind: 'skip',
      reason: 'signed-out',
    });
  });
});

describe('how long each trigger waits', () => {
  it('holds the foreground trigger for five minutes', () => {
    expect(MINIMUM_INTERVAL_MS.foreground).toBe(5 * 60 * 1000);

    const lastAttemptAtMs = RUNNABLE.nowMs - MINIMUM_INTERVAL_MS.foreground + 1;

    expect(decideAutomaticSync(input({ trigger: 'foreground', lastAttemptAtMs }))).toEqual({
      kind: 'skip',
      reason: 'too-soon',
    });
  });

  it('lets the foreground trigger through once the five minutes are up', () => {
    const lastAttemptAtMs = RUNNABLE.nowMs - MINIMUM_INTERVAL_MS.foreground;

    expect(decideAutomaticSync(input({ trigger: 'foreground', lastAttemptAtMs }))).toEqual({
      kind: 'run',
    });
  });

  it('holds an edit for two minutes on top of its own debounce', () => {
    expect(MINIMUM_INTERVAL_MS['local-change']).toBe(2 * 60 * 1000);

    const lastAttemptAtMs = RUNNABLE.nowMs - MINIMUM_INTERVAL_MS['local-change'] + 1;

    expect(decideAutomaticSync(input({ trigger: 'local-change', lastAttemptAtMs }))).toEqual({
      kind: 'skip',
      reason: 'too-soon',
    });
  });

  it('makes somebody who just acted wait for nothing', () => {
    // Signing in, turning the switch on, and the flush on the way out are each
    // something a person did once, a moment ago.
    for (const trigger of ['sign-in', 'enabled', 'background-flush'] as const) {
      expect(MINIMUM_INTERVAL_MS[trigger]).toBe(0);

      expect(
        decideAutomaticSync(input({ trigger, lastAttemptAtMs: RUNNABLE.nowMs }))
      ).toEqual({ kind: 'run' });
    }
  });

  it('runs when there has never been an attempt, however short the gap would be', () => {
    expect(
      decideAutomaticSync(input({ trigger: 'foreground', lastAttemptAtMs: null }))
    ).toEqual({ kind: 'run' });
  });

  it('debounces an edit for thirty seconds', () => {
    expect(LOCAL_CHANGE_DEBOUNCE_MS).toBe(30 * 1000);
  });
});

describe('a clock that is not a clock', () => {
  it.each([[Number.NaN], [Number.POSITIVE_INFINITY]])('throws on %p', (nowMs) => {
    expect(() => decideAutomaticSync(input({ nowMs }))).toThrow('decideAutomaticSync');
  });

  it('throws rather than guessing when the reading is not a number at all', () => {
    expect(() =>
      decideAutomaticSync(input({ nowMs: '1000' as unknown as number }))
    ).toThrow('decideAutomaticSync');
  });
});
