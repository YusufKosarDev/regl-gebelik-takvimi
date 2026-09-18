import { AuthError } from '../../domain/auth-error';
import {
  getCurrentAuthUser,
  observeAuthUser,
  signInWithEmail,
  signOut,
  signUpWithEmail,
} from '../auth-repository';

// The SDK and this app's own Firebase file are faked, so these tests are about
// what crosses the boundary: what goes to the SDK, what comes back, and what an
// error turns into.
jest.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  onAuthStateChanged: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock('../../infrastructure/firebase', () => ({
  requireFirebaseAuth: jest.fn(),
  getFirebaseAuth: jest.fn(),
  isFirebaseConfigured: jest.fn(() => true),
}));

// Nothing about an account may reach the cycle database, and nothing may be
// written to a log. Both are faked so the tests can say so.
jest.mock('@/features/cycle/data/cycle-repository', () => ({
  loadCycleProfile: jest.fn(),
  saveCycleProfile: jest.fn(),
}));

jest.mock('@/features/privacy/application/build-cloud-sync-payload-v1', () => ({
  buildCloudSyncPayloadV1: jest.fn(),
}));

jest.mock('@/shared/logging', () => ({
  logEvent: jest.fn(),
  describeValue: jest.requireActual('@/shared/logging').describeValue,
  describeError: jest.requireActual('@/shared/logging').describeError,
}));

const sdk = jest.requireMock('firebase/auth');
const firebase = jest.requireMock('../../infrastructure/firebase');
const cycleRepository = jest.requireMock('@/features/cycle/data/cycle-repository');
const cloudSync = jest.requireMock('@/features/privacy/application/build-cloud-sync-payload-v1');
const logging = jest.requireMock('@/shared/logging');

const EMAIL = 'someone@example.com';
const PASSWORD = 'a-very-secret-password';

/** As much of a Firebase `User` as the SDK hands back. */
function firebaseUser(overrides: Record<string, unknown> = {}) {
  return {
    uid: 'firebase-uid-1',
    email: EMAIL,
    displayName: 'Someone',
    refreshToken: 'a-refresh-token',
    providerData: [{ providerId: 'password', email: EMAIL }],
    ...overrides,
  };
}

/** The SDK's own error: a code, and prose that quotes what it was sent. */
function sdkError(code: string, message = `Firebase: Error (${code}).`) {
  const error = new Error(message) as Error & { code: string };
  error.code = code;

  return error;
}

let auth: { currentUser: unknown };

beforeEach(() => {
  auth = { currentUser: null };

  firebase.requireFirebaseAuth.mockReset();
  firebase.requireFirebaseAuth.mockReturnValue(auth);

  sdk.createUserWithEmailAndPassword.mockReset();
  sdk.createUserWithEmailAndPassword.mockResolvedValue({ user: firebaseUser() });
  sdk.signInWithEmailAndPassword.mockReset();
  sdk.signInWithEmailAndPassword.mockResolvedValue({ user: firebaseUser() });
  sdk.onAuthStateChanged.mockReset();
  sdk.onAuthStateChanged.mockReturnValue(jest.fn());
  sdk.signOut.mockReset();
  sdk.signOut.mockResolvedValue(undefined);

  cycleRepository.loadCycleProfile.mockReset();
  cycleRepository.saveCycleProfile.mockReset();
  cloudSync.buildCloudSyncPayloadV1.mockReset();
  logging.logEvent.mockReset();
});

describe('getCurrentAuthUser', () => {
  it('says nobody when there is no session', () => {
    expect(getCurrentAuthUser()).toBeNull();
  });

  it('gives this app its own user when there is one', () => {
    auth.currentUser = firebaseUser();

    expect(getCurrentAuthUser()).toEqual({ uid: 'firebase-uid-1', email: EMAIL });
  });

  it('gives nothing else about them', () => {
    auth.currentUser = firebaseUser();

    expect(Object.keys(getCurrentAuthUser() ?? {})).toEqual(['uid', 'email']);
  });

  it('asks nothing over the network', () => {
    getCurrentAuthUser();

    expect(sdk.signInWithEmailAndPassword).not.toHaveBeenCalled();
    expect(sdk.onAuthStateChanged).not.toHaveBeenCalled();
  });

  it('turns a build with no Firebase project into an auth error', () => {
    firebase.requireFirebaseAuth.mockImplementation(() => {
      throw new AuthError('not-configured');
    });

    expect(() => getCurrentAuthUser()).toThrow('Auth failed: not-configured.');
  });
});

describe('signUpWithEmail', () => {
  it('sends the address and password to the SDK, and nowhere else', async () => {
    await signUpWithEmail(EMAIL, PASSWORD);

    expect(sdk.createUserWithEmailAndPassword).toHaveBeenCalledWith(auth, EMAIL, PASSWORD);
    expect(sdk.createUserWithEmailAndPassword).toHaveBeenCalledTimes(1);
  });

  it('gives back this app’s own user', async () => {
    await expect(signUpWithEmail(EMAIL, PASSWORD)).resolves.toEqual({
      uid: 'firebase-uid-1',
      email: EMAIL,
    });
  });

  it('carries no token back with it', async () => {
    const user = await signUpWithEmail(EMAIL, PASSWORD);

    expect(JSON.stringify(user)).not.toMatch(/refresh|token|provider/i);
  });

  it.each([
    ['auth/email-already-in-use', 'email-already-in-use'],
    ['auth/weak-password', 'weak-password'],
    ['auth/invalid-email', 'invalid-email'],
    ['auth/network-request-failed', 'network-failed'],
  ])('turns %s into %s', async (code, expected) => {
    sdk.createUserWithEmailAndPassword.mockRejectedValue(sdkError(code));

    await expect(signUpWithEmail(EMAIL, PASSWORD)).rejects.toMatchObject({ code: expected });
  });
});

describe('signInWithEmail', () => {
  it('sends the address and password to the SDK', async () => {
    await signInWithEmail(EMAIL, PASSWORD);

    expect(sdk.signInWithEmailAndPassword).toHaveBeenCalledWith(auth, EMAIL, PASSWORD);
  });

  it('gives back this app’s own user', async () => {
    await expect(signInWithEmail(EMAIL, PASSWORD)).resolves.toEqual({
      uid: 'firebase-uid-1',
      email: EMAIL,
    });
  });

  it('gives back a user with no email when the account has none', async () => {
    sdk.signInWithEmailAndPassword.mockResolvedValue({ user: firebaseUser({ email: null }) });

    await expect(signInWithEmail(EMAIL, PASSWORD)).resolves.toEqual({
      uid: 'firebase-uid-1',
      email: null,
    });
  });

  it.each([
    ['auth/wrong-password', 'invalid-credentials'],
    ['auth/user-not-found', 'invalid-credentials'],
    ['auth/invalid-credential', 'invalid-credentials'],
    ['auth/too-many-requests', 'too-many-requests'],
  ])('turns %s into %s', async (code, expected) => {
    sdk.signInWithEmailAndPassword.mockRejectedValue(sdkError(code));

    await expect(signInWithEmail(EMAIL, PASSWORD)).rejects.toMatchObject({ code: expected });
  });

  it('calls a failure it has never seen unknown rather than passing it on', async () => {
    sdk.signInWithEmailAndPassword.mockRejectedValue(new Error('something the SDK made up'));

    await expect(signInWithEmail(EMAIL, PASSWORD)).rejects.toMatchObject({ code: 'unknown' });
  });
});

describe('signOut', () => {
  it('ends the session', async () => {
    await signOut();

    expect(sdk.signOut).toHaveBeenCalledWith(auth);
  });

  it('touches nothing in the cycle database', async () => {
    await signOut();

    expect(cycleRepository.loadCycleProfile).not.toHaveBeenCalled();
    expect(cycleRepository.saveCycleProfile).not.toHaveBeenCalled();
  });

  it('turns a failure into an auth error', async () => {
    sdk.signOut.mockRejectedValue(sdkError('auth/network-request-failed'));

    await expect(signOut()).rejects.toMatchObject({ code: 'network-failed' });
  });
});

describe('observeAuthUser', () => {
  /** Runs the callback the repository handed the SDK. */
  function emit(user: unknown) {
    sdk.onAuthStateChanged.mock.calls[0][1](user);
  }

  it('watches the auth instance', () => {
    observeAuthUser(jest.fn());

    expect(sdk.onAuthStateChanged).toHaveBeenCalledTimes(1);
    expect(sdk.onAuthStateChanged.mock.calls[0][0]).toBe(auth);
  });

  it('hands on this app’s own user', () => {
    const seen = jest.fn();

    observeAuthUser(seen);
    emit(firebaseUser());

    expect(seen).toHaveBeenCalledWith({ uid: 'firebase-uid-1', email: EMAIL });
  });

  it('hands on null when nobody is signed in', () => {
    const seen = jest.fn();

    observeAuthUser(seen);
    emit(null);

    expect(seen).toHaveBeenCalledWith(null);
  });

  it('keeps handing on changes', () => {
    const seen = jest.fn();

    observeAuthUser(seen);
    emit(null);
    emit(firebaseUser());
    emit(null);

    expect(seen).toHaveBeenCalledTimes(3);
    expect(seen.mock.calls.map(([user]) => user)).toEqual([
      null,
      { uid: 'firebase-uid-1', email: EMAIL },
      null,
    ]);
  });

  it('never hands on a raw SDK user', () => {
    const seen = jest.fn();
    const user = firebaseUser();

    observeAuthUser(seen);
    emit(user);

    expect(seen.mock.calls[0][0]).not.toBe(user);
    expect(seen.mock.calls[0][0]).not.toHaveProperty('refreshToken');
  });

  it('gives back the SDK’s way of stopping', () => {
    const unsubscribe = jest.fn();
    sdk.onAuthStateChanged.mockReturnValue(unsubscribe);

    observeAuthUser(jest.fn())();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('turns a build with no Firebase project into an auth error', () => {
    firebase.requireFirebaseAuth.mockImplementation(() => {
      throw new AuthError('not-configured');
    });

    expect(() => observeAuthUser(jest.fn())).toThrow('Auth failed: not-configured.');
  });
});

describe('what the repository never lets out', () => {
  const failures = [
    ['a wrong password', sdkError('auth/wrong-password', `The password is invalid for ${EMAIL}.`)],
    ['a weak password', sdkError('auth/weak-password', `Password ${PASSWORD} is too weak.`)],
    ['an unmapped failure', sdkError('auth/internal-error', `Internal error for ${EMAIL}.`)],
  ] as const;

  it.each(failures)('keeps the address and password out of the error for %s', async (_l, thrown) => {
    sdk.signInWithEmailAndPassword.mockRejectedValue(thrown);

    const error = await signInWithEmail(EMAIL, PASSWORD).then(
      () => {
        throw new Error('expected a rejection');
      },
      (caught: unknown) => caught as Error
    );

    expect(error.message).not.toMatch(/someone@example\.com|a-very-secret-password/);
    expect(error.message).toMatch(/^Auth failed: [a-z-]+\.$/);
  });

  it('writes nothing to the log, whatever happens', async () => {
    sdk.signInWithEmailAndPassword.mockRejectedValue(failures[0][1]);
    sdk.createUserWithEmailAndPassword.mockRejectedValue(failures[1][1]);

    await signInWithEmail(EMAIL, PASSWORD).catch(() => undefined);
    await signUpWithEmail(EMAIL, PASSWORD).catch(() => undefined);
    await signOut();
    getCurrentAuthUser();

    expect(logging.logEvent).not.toHaveBeenCalled();
  });

  it('writes nothing to the console either', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});

    sdk.signInWithEmailAndPassword.mockRejectedValue(failures[0][1]);
    await signInWithEmail(EMAIL, PASSWORD).catch(() => undefined);

    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();

    jest.restoreAllMocks();
  });

  it('keeps the password nowhere after the call', async () => {
    const user = await signUpWithEmail(EMAIL, PASSWORD);

    expect(JSON.stringify(user)).not.toContain(PASSWORD);
  });
});

describe('what the repository never reaches for', () => {
  it('builds no cloud sync payload, because nothing is being sent', async () => {
    await signUpWithEmail(EMAIL, PASSWORD);
    await signInWithEmail(EMAIL, PASSWORD);
    await signOut();
    getCurrentAuthUser();
    observeAuthUser(jest.fn());

    expect(cloudSync.buildCloudSyncPayloadV1).not.toHaveBeenCalled();
  });

  it('reads no health data', async () => {
    await signInWithEmail(EMAIL, PASSWORD);

    expect(cycleRepository.loadCycleProfile).not.toHaveBeenCalled();
  });

  it('writes no health data', async () => {
    await signUpWithEmail(EMAIL, PASSWORD);

    expect(cycleRepository.saveCycleProfile).not.toHaveBeenCalled();
  });
});
