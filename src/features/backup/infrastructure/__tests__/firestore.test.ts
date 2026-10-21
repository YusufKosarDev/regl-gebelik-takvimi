import { AuthError } from '@/features/auth/domain/auth-error';

import { requireFirestore } from '../firestore';

/**
 * The one place this app talks to Firestore.
 *
 * ## Why this file exists
 *
 * The adapter held **0% coverage**, and it has exactly one rule: a build with no
 * Firebase project has no database either, and that has to arrive as the same
 * kind of thing as "that password was wrong" rather than as a stray exception
 * with a stack. The account screen already knows how to say `not-configured`;
 * it does not know what to do with whatever the SDK throws when asked for a
 * database that does not exist.
 *
 * Small, and worth pinning anyway: it is the difference between a screen that
 * explains itself and a screen that crashes, on every build without the
 * environment variables — which is Expo Go, and CI.
 *
 * It also pins that the app instance is the one the auth feature already built,
 * so there is a single Firebase app in the process and a single place the
 * config comes from.
 */

// The factories build their own spies and the handles come back through
// `jest.requireMock`, which is this repo's usual shape — and here it is the only
// one that works: `jest.mock` is hoisted above the imports, and the import of
// the module under test pulls the faked module in straight away, so a factory
// closing over a `const` declared below would run while that `const` is still
// in its temporal dead zone.
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
}));

jest.mock('@/features/auth/infrastructure/firebase', () => ({
  isFirebaseConfigured: jest.fn(),
  getFirebaseApp: jest.fn(),
}));

const sdk = jest.requireMock('firebase/firestore');
const firebase = jest.requireMock('@/features/auth/infrastructure/firebase');

const getFirestore = sdk.getFirestore as jest.Mock;
const isFirebaseConfigured = firebase.isFirebaseConfigured as jest.Mock;
const getFirebaseApp = firebase.getFirebaseApp as jest.Mock;

const DATABASE = { marker: 'the-one-database' };
const APP = { name: '[DEFAULT]' };

beforeEach(() => {
  getFirestore.mockReset();
  getFirestore.mockReturnValue(DATABASE);
  getFirebaseApp.mockReset();
  getFirebaseApp.mockReturnValue(APP);
  isFirebaseConfigured.mockReset();
  isFirebaseConfigured.mockReturnValue(true);
});

describe('a build with a Firebase project', () => {
  it('answers with the database', () => {
    expect(requireFirestore()).toBe(DATABASE);
  });

  it('builds it on the app the auth feature already made', () => {
    requireFirestore();

    // Not a second `initializeApp`: one app in the process, one place the
    // config comes from.
    expect(getFirebaseApp).toHaveBeenCalledTimes(1);
    expect(getFirestore).toHaveBeenCalledWith(APP);
  });
});

describe('a build with no Firebase project', () => {
  beforeEach(() => {
    isFirebaseConfigured.mockReturnValue(false);
  });

  it('refuses with something a screen can show', () => {
    expect(() => requireFirestore()).toThrow(AuthError);
  });

  it('names the reason as not-configured', () => {
    try {
      requireFirestore();
      throw new Error('requireFirestore should have refused.');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(AuthError);
      expect((error as AuthError).code).toBe('not-configured');
    }
  });

  it('does not reach the SDK at all', () => {
    expect(() => requireFirestore()).toThrow();

    // Asking for a database on an app that was never initialised is where the
    // stray exception came from. The check is before the call, not around it.
    expect(getFirestore).not.toHaveBeenCalled();
    expect(getFirebaseApp).not.toHaveBeenCalled();
  });
});
