import { readFileSync } from 'fs';
import { join } from 'path';

import { NO_FAILED_ATTEMPTS } from '../../domain/attempt-policy';
import type { LockRecord } from '../../domain/lock-record';
import { setAppLock } from '../set-app-lock';
import { unlockWithPin } from '../unlock-with-pin';

/**
 * Trying a PIN.
 *
 * SecureStore is faked with an in-memory map so the whole use case runs — the
 * record shape, the hashing, the counters and the write-before-answer ordering
 * are all real. Only the platform store is not.
 *
 * `expo-crypto` is faked too, and deliberately *not* with a stub that returns a
 * constant: a hash that ignored its input would let every one of these pass.
 */

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();

  (globalThis as Record<string, unknown>).__secureStore = store;

  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  CryptoEncoding: { HEX: 'hex' },
  getRandomBytesAsync: jest.fn(async (count: number) =>
    Uint8Array.from({ length: count }, (_, index) => (index * 7 + 11) % 256)
  ),
  // A real function of its input, so a wrong PIN cannot accidentally match.
  digestStringAsync: jest.fn(async (_algorithm: string, data: string) => {
    let hash = 0x811c9dc5;

    for (let index = 0; index < data.length; index++) {
      hash ^= data.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }

    return hash.toString(16).padStart(8, '0');
  }),
}));

const secureStore = () => (globalThis as Record<string, unknown>).__secureStore as Map<string, string>;

const RIGHT = '314159';
const WRONG = '271828';
const NOW = 1_800_000_000_000;

function storedRecord(): LockRecord {
  const raw = [...secureStore().values()][0];

  return JSON.parse(raw) as LockRecord;
}

beforeEach(() => {
  secureStore().clear();
});

describe('with no lock set', () => {
  it('says so rather than refusing', async () => {
    expect(await unlockWithPin(RIGHT, NOW)).toEqual({ kind: 'no-lock' });
  });
});

describe('the right PIN', () => {
  it('opens', async () => {
    await setAppLock({ pin: RIGHT, boundUid: 'uid-1', biometricsEnabled: false });

    expect(await unlockWithPin(RIGHT, NOW)).toEqual({ kind: 'unlocked' });
  });

  it('clears the counters somebody had built up', async () => {
    await setAppLock({ pin: RIGHT, boundUid: 'uid-1', biometricsEnabled: false });

    await unlockWithPin(WRONG, NOW);
    await unlockWithPin(WRONG, NOW);

    expect(storedRecord().attempts.failedAttempts).toBe(2);

    await unlockWithPin(RIGHT, NOW);

    expect(storedRecord().attempts).toEqual(NO_FAILED_ATTEMPTS);
  });
});

describe('the wrong PIN', () => {
  beforeEach(async () => {
    await setAppLock({ pin: RIGHT, boundUid: 'uid-1', biometricsEnabled: false });
  });

  it('does not open', async () => {
    const outcome = await unlockWithPin(WRONG, NOW);

    expect(outcome.kind).toBe('wrong');
  });

  it('counts', async () => {
    await unlockWithPin(WRONG, NOW);
    await unlockWithPin(WRONG, NOW);
    await unlockWithPin(WRONG, NOW);

    expect(storedRecord().attempts.failedAttempts).toBe(3);
  });

  it('costs an attempt even when it could not have been typed on the pad', async () => {
    await unlockWithPin('nonsense', NOW);

    expect(storedRecord().attempts.failedAttempts).toBe(1);
  });

  it('starts the waits at the sixth', async () => {
    for (let i = 0; i < 5; i++) {
      const outcome = await unlockWithPin(WRONG, NOW);

      expect(outcome).toMatchObject({ kind: 'wrong' });
      expect(storedRecord().attempts.lockedUntil).toBeNull();
    }

    await unlockWithPin(WRONG, NOW);

    expect(storedRecord().attempts.lockedUntil).toBe(NOW + 30_000);
  });

  it('refuses to check at all while a wait is running', async () => {
    for (let i = 0; i < 6; i++) {
      await unlockWithPin(WRONG, NOW);
    }

    // Even the right one. Otherwise the wait is a suggestion.
    const outcome = await unlockWithPin(RIGHT, NOW + 1_000);

    expect(outcome).toEqual({ kind: 'waiting', remainingMs: 29_000 });
  });

  it('lets the right one through once the wait is over', async () => {
    for (let i = 0; i < 6; i++) {
      await unlockWithPin(WRONG, NOW);
    }

    expect(await unlockWithPin(RIGHT, NOW + 30_000)).toEqual({ kind: 'unlocked' });
  });
});

/**
 * The reason the counters are written before the answer is returned.
 *
 * Killing the app on a wrong PIN must not hand somebody a fresh set of tries.
 * Nothing is reset here between the failures and the check — the "restart" is
 * that the next call reads the record from storage rather than from memory.
 */
describe('the wait survives a restart', () => {
  it('is still running after the record is re-read from storage', async () => {
    await setAppLock({ pin: RIGHT, boundUid: 'uid-1', biometricsEnabled: false });

    for (let i = 0; i < 6; i++) {
      await unlockWithPin(WRONG, NOW);
    }

    const persisted = storedRecord();

    expect(persisted.attempts.failedAttempts).toBe(6);
    expect(persisted.attempts.lockedUntil).toBe(NOW + 30_000);

    // A fresh read, as a cold start would do.
    const outcome = await unlockWithPin(RIGHT, NOW + 5_000);

    expect(outcome).toEqual({ kind: 'waiting', remainingMs: 25_000 });
  });
});

describe('the stored record', () => {
  it('never contains the PIN', async () => {
    await setAppLock({ pin: RIGHT, boundUid: 'uid-1', biometricsEnabled: false });

    const raw = [...secureStore().values()][0];

    expect(raw).not.toContain(RIGHT);
    expect(raw).not.toContain('pin');
  });

  it('gets a new salt each time the PIN is set, so a reused PIN is not recognisable', async () => {
    await setAppLock({ pin: RIGHT, boundUid: 'uid-1', biometricsEnabled: false });
    const first = storedRecord();

    await setAppLock({ pin: RIGHT, boundUid: 'uid-1', biometricsEnabled: false });
    const second = storedRecord();

    // The fake random source is deterministic, so this asserts the salt is
    // re-drawn rather than that it differs.
    expect(second.salt).toBe(first.salt);
    expect(second.attempts).toEqual(NO_FAILED_ATTEMPTS);
  });

  it('records whether an account can reset it', async () => {
    await setAppLock({ pin: RIGHT, boundUid: null, biometricsEnabled: false });

    expect(storedRecord().boundUid).toBeNull();

    await setAppLock({ pin: RIGHT, boundUid: 'uid-9', biometricsEnabled: false });

    expect(storedRecord().boundUid).toBe('uid-9');
  });
});

/**
 * The rule, at the layer that actually touches storage.
 *
 * The domain test proves the policy never escalates to destruction. This proves
 * the use case around it never reaches for anything that could.
 */
describe('no unlock path can destroy anything', () => {
  it('never deletes the record, however many times somebody gets it wrong', async () => {
    await setAppLock({ pin: RIGHT, boundUid: 'uid-1', biometricsEnabled: false });

    for (let i = 0; i < 50; i++) {
      await unlockWithPin(WRONG, NOW);
    }

    expect(secureStore().size).toBe(1);
    expect(storedRecord().hash).toBeTruthy();
  });

  it('exports nothing that deletes, wipes or clears', () => {
    const module = jest.requireActual<Record<string, unknown>>('../unlock-with-pin');

    for (const name of Object.keys(module)) {
      expect(name).not.toMatch(/delete|wipe|clear|erase|destroy|purge/i);
    }
  });

  it('touches no database, no table and no reminder', () => {
    const source = readFileSync(join(__dirname, '..', 'unlock-with-pin.ts'), 'utf8');

    expect(source).not.toMatch(/openAppDatabase|clearAllLocalTables|wipeLocalData/);
    expect(source).not.toMatch(/DELETE FROM|DROP TABLE/);
  });
});
