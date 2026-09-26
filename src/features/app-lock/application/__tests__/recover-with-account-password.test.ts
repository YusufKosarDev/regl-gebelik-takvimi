import { AuthError } from '@/features/auth/domain/auth-error';

import { recoverWithAccountPassword } from '../recover-with-account-password';
import { setAppLock } from '../set-app-lock';
import { unlockWithPin } from '../unlock-with-pin';

/**
 * Getting back in with the account password.
 *
 * The uid check is the security of this whole path, and it has its own block:
 * a valid password for *some* account must not open *this* phone.
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
    Uint8Array.from({ length: count }, (_, index) => index)
  ),
  digestStringAsync: jest.fn(async (_algorithm: string, data: string) => {
    let hash = 0x811c9dc5;

    for (let index = 0; index < data.length; index++) {
      hash ^= data.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }

    return hash.toString(16).padStart(8, '0');
  }),
}));

jest.mock('@/features/auth/data/auth-repository', () => ({
  signInWithEmail: jest.fn(),
}));

const auth = jest.requireMock('@/features/auth/data/auth-repository');
const secureStore = () => (globalThis as Record<string, unknown>).__secureStore as Map<string, string>;

const PIN = '424242';
const WRONG = '131313';
const NOW = 1_800_000_000_000;

beforeEach(() => {
  secureStore().clear();
  auth.signInWithEmail.mockReset();
});

describe('the happy path', () => {
  beforeEach(async () => {
    await setAppLock({ pin: PIN, boundUid: 'uid-1', biometricsEnabled: false });
    auth.signInWithEmail.mockResolvedValue({ uid: 'uid-1', email: 'a@b.com' });
  });

  it('recovers with the right password for the bound account', async () => {
    expect(await recoverWithAccountPassword('a@b.com', 'correct-horse')).toEqual({
      kind: 'recovered',
    });
  });

  // Off, not reset to something the person does not know.
  it('leaves the lock off rather than setting a new PIN', async () => {
    await recoverWithAccountPassword('a@b.com', 'correct-horse');

    expect(secureStore().size).toBe(0);
    expect(await unlockWithPin(PIN, NOW)).toEqual({ kind: 'no-lock' });
  });

  // The person who has been locked out is the one most likely to be partway
  // through a wait, and a wait must never trap somebody out of their records.
  it('works partway through a lockout wait', async () => {
    for (let i = 0; i < 8; i++) {
      await unlockWithPin(WRONG, NOW);
    }

    expect(await recoverWithAccountPassword('a@b.com', 'correct-horse')).toEqual({
      kind: 'recovered',
    });
  });
});

/**
 * The check the whole path rests on.
 *
 * Without it, anybody could open anybody's phone by signing in with their own
 * account.
 */
describe('a different account', () => {
  beforeEach(async () => {
    await setAppLock({ pin: PIN, boundUid: 'uid-1', biometricsEnabled: false });
  });

  it('is refused even with a password that signs in perfectly well', async () => {
    auth.signInWithEmail.mockResolvedValue({ uid: 'uid-2', email: 'someone@else.com' });

    expect(await recoverWithAccountPassword('someone@else.com', 'their-password')).toEqual({
      kind: 'wrong-account',
    });
  });

  it('leaves the lock exactly where it was', async () => {
    auth.signInWithEmail.mockResolvedValue({ uid: 'uid-2', email: 'someone@else.com' });

    await recoverWithAccountPassword('someone@else.com', 'their-password');

    expect(secureStore().size).toBe(1);
    expect(await unlockWithPin(PIN, NOW)).toEqual({ kind: 'unlocked' });
  });
});

describe('when it cannot work', () => {
  it('reports the auth failure for a wrong password', async () => {
    await setAppLock({ pin: PIN, boundUid: 'uid-1', biometricsEnabled: false });
    auth.signInWithEmail.mockRejectedValue(new AuthError('invalid-credentials'));

    expect(await recoverWithAccountPassword('a@b.com', 'nope')).toEqual({
      kind: 'failed',
      code: 'invalid-credentials',
    });
  });

  // There is no offline route, and this is how the screen learns to say so.
  it('reports the network failure rather than a generic one', async () => {
    await setAppLock({ pin: PIN, boundUid: 'uid-1', biometricsEnabled: false });
    auth.signInWithEmail.mockRejectedValue(new AuthError('network-failed'));

    expect(await recoverWithAccountPassword('a@b.com', 'correct-horse')).toEqual({
      kind: 'failed',
      code: 'network-failed',
    });
  });

  it('leaves the lock on when the sign-in fails', async () => {
    await setAppLock({ pin: PIN, boundUid: 'uid-1', biometricsEnabled: false });
    auth.signInWithEmail.mockRejectedValue(new AuthError('network-failed'));

    await recoverWithAccountPassword('a@b.com', 'correct-horse');

    expect(secureStore().size).toBe(1);
  });

  // The person who was warned at setup. The screen does not offer this route.
  it('refuses a lock that was set without an account', async () => {
    await setAppLock({ pin: PIN, boundUid: null, biometricsEnabled: false });

    expect(await recoverWithAccountPassword('a@b.com', 'correct-horse')).toEqual({
      kind: 'not-recoverable',
    });
    expect(auth.signInWithEmail).not.toHaveBeenCalled();
    expect(secureStore().size).toBe(1);
  });
});

/**
 * Recovering is not a reason to lose anything.
 *
 * The one thing this deletes is the lock record.
 */
describe('recovery destroys nothing but the lock', () => {
  it('touches no database, no table and no reminder', () => {
    const source = jest
      .requireActual<typeof import('fs')>('fs')
      .readFileSync(
        jest.requireActual<typeof import('path')>('path').join(
          __dirname,
          '..',
          'recover-with-account-password.ts'
        ),
        'utf8'
      );

    expect(source).not.toMatch(/openAppDatabase|clearAllLocalTables|wipeLocalData/);
    expect(source).not.toMatch(/DELETE FROM|DROP TABLE/);
  });
});
