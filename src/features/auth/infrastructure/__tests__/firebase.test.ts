import { AuthError } from '../../domain/auth-error';

// The SDK is faked. What this file pins is the config this app reads, that the
// app is only ever initialised once, and that the session is given somewhere to
// live — not that Firebase works.
// Held outside the factories: `jest.resetModules` between tests re-runs them,
// and fresh spies inside would leave these assertions watching an old module.
// The `mock` prefix is what lets the hoisted factory reach them.
const mockApp = {
  initializeApp: jest.fn(),
  getApp: jest.fn(),
  getApps: jest.fn((): unknown[] => []),
};

const mockAuth = {
  initializeAuth: jest.fn(),
  getReactNativePersistence: jest.fn(),
};

const mockAsyncStorage = { setItem: jest.fn(), getItem: jest.fn(), removeItem: jest.fn() };

jest.mock('firebase/app', () => mockApp);
jest.mock('firebase/auth', () => mockAuth);
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: mockAsyncStorage,
}));

const app = mockApp;
const auth = mockAuth;
const asyncStorage = mockAsyncStorage;

const VARIABLES = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
] as const;

/** Values shaped like the real ones, belonging to no project. */
const VALUES: Record<(typeof VARIABLES)[number], string> = {
  EXPO_PUBLIC_FIREBASE_API_KEY: 'test-api-key',
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'test-project.firebaseapp.com',
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'test-project',
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: 'test-project.appspot.com',
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '1234567890',
  EXPO_PUBLIC_FIREBASE_APP_ID: '1:1234567890:android:abcdef',
};

const originalEnvironment = { ...process.env };

function configure(overrides: Partial<Record<string, string | undefined>> = {}) {
  for (const name of VARIABLES) {
    const value = name in overrides ? overrides[name] : VALUES[name];

    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
}

/** Loaded per test, because the module remembers the instance it built. */
function load() {
  return require('../firebase') as typeof import('../firebase');
}

beforeEach(() => {
  jest.resetModules();

  app.initializeApp.mockReset();
  app.initializeApp.mockImplementation(() => ({ name: '[DEFAULT]' }));
  app.getApp.mockReset();
  app.getApps.mockReset();
  app.getApps.mockReturnValue([]);

  auth.initializeAuth.mockReset();
  auth.initializeAuth.mockImplementation(() => ({ currentUser: null }));
  auth.getReactNativePersistence.mockReset();
  auth.getReactNativePersistence.mockReturnValue('rn-persistence');

  configure();
});

afterEach(() => {
  process.env = { ...originalEnvironment };
});

describe('reading the config from the environment', () => {
  it('maps every variable to the field the SDK expects', () => {
    expect(load().readFirebaseConfig()).toEqual({
      apiKey: 'test-api-key',
      authDomain: 'test-project.firebaseapp.com',
      projectId: 'test-project',
      storageBucket: 'test-project.appspot.com',
      messagingSenderId: '1234567890',
      appId: '1:1234567890:android:abcdef',
    });
  });

  it('says the build is configured when every one is set', () => {
    expect(load().isFirebaseConfigured()).toBe(true);
  });

  it.each(VARIABLES)('says it is not configured without %s', (name) => {
    configure({ [name]: undefined });

    expect(load().isFirebaseConfigured()).toBe(false);
  });

  it.each(VARIABLES)('treats a blank %s as missing', (name) => {
    configure({ [name]: '   ' });

    expect(load().isFirebaseConfigured()).toBe(false);
  });
});

describe('when the build has no Firebase project', () => {
  it('names the variable to set', () => {
    configure({ EXPO_PUBLIC_FIREBASE_PROJECT_ID: undefined });

    expect(() => load().readFirebaseConfig()).toThrow(
      'Firebase is not configured. Missing environment variables: EXPO_PUBLIC_FIREBASE_PROJECT_ID.'
    );
  });

  it('names all of them when nothing is set', () => {
    for (const name of VARIABLES) {
      delete process.env[name];
    }

    expect(() => load().readFirebaseConfig()).toThrow(
      new RegExp(VARIABLES.join(', ').replace(/\./g, '\\.'))
    );
  });

  it('quotes no value, set or unset', () => {
    configure({ EXPO_PUBLIC_FIREBASE_API_KEY: undefined });

    const message = (() => {
      try {
        load().readFirebaseConfig();
        return '';
      } catch (thrown) {
        return (thrown as Error).message;
      }
    })();

    expect(message).not.toMatch(/test-project|test-api-key|1:1234567890/);
  });

  it('refuses an auth instance with a code a screen can show', () => {
    configure({ EXPO_PUBLIC_FIREBASE_APP_ID: undefined });

    const thrown = (() => {
      try {
        load().requireFirebaseAuth();
        return null;
      } catch (error) {
        return error as AuthError;
      }
    })();

    // Not `toBeInstanceOf`: `jest.resetModules` gives the module under test its
    // own copy of the error class, so the one thrown is a different constructor
    // from the one imported here while being the same class.
    expect(thrown?.name).toBe(new AuthError('unknown').name);
    expect(thrown?.code).toBe('not-configured');
  });

  it('initialises nothing when it refuses', () => {
    configure({ EXPO_PUBLIC_FIREBASE_APP_ID: undefined });

    expect(() => load().requireFirebaseAuth()).toThrow();
    expect(app.initializeApp).not.toHaveBeenCalled();
    expect(auth.initializeAuth).not.toHaveBeenCalled();
  });
});

describe('initialising the app', () => {
  it('initialises it with the config it read', () => {
    const firebase = load();

    firebase.getFirebaseApp();

    expect(app.initializeApp).toHaveBeenCalledTimes(1);
    expect(app.initializeApp).toHaveBeenCalledWith(firebase.readFirebaseConfig(), '[DEFAULT]');
  });

  it('initialises once however many times it is asked', () => {
    const firebase = load();
    const created = { name: '[DEFAULT]' };

    app.initializeApp.mockReturnValue(created);
    app.getApps.mockImplementation(() =>
      app.initializeApp.mock.calls.length > 0 ? [created] : []
    );
    app.getApp.mockReturnValue(created);

    firebase.getFirebaseApp();
    firebase.getFirebaseApp();
    firebase.getFirebaseApp();

    expect(app.initializeApp).toHaveBeenCalledTimes(1);
  });

  it('takes the app the SDK already has, even across a reload', () => {
    const existing = { name: '[DEFAULT]' };
    app.getApps.mockReturnValue([existing]);
    app.getApp.mockReturnValue(existing);

    // A fresh module, as a fast refresh leaves it, with the SDK's registry
    // still holding the app from before.
    expect(load().getFirebaseApp()).toBe(existing);
    expect(app.initializeApp).not.toHaveBeenCalled();
  });
});

describe('keeping the session across restarts', () => {
  it('initialises auth with React Native persistence', () => {
    load().getFirebaseAuth();

    expect(auth.initializeAuth).toHaveBeenCalledTimes(1);
    expect(auth.initializeAuth.mock.calls[0][1]).toEqual({ persistence: 'rn-persistence' });
  });

  it('hands the session to AsyncStorage, which this app already ships', () => {
    load().getFirebaseAuth();

    expect(auth.getReactNativePersistence).toHaveBeenCalledWith(asyncStorage);
  });

  it('does not fall back to a session that lives in memory', () => {
    const firebase = load();

    firebase.getFirebaseAuth();

    // `getAuth` would hand back an in-memory session on React Native, which is
    // a sign-in that a restart undoes.
    expect(Object.keys(auth)).not.toContain('getAuth');
  });

  it('initialises auth once however many times it is asked', () => {
    const firebase = load();
    const created = { name: '[DEFAULT]' };

    app.initializeApp.mockReturnValue(created);
    app.getApps.mockImplementation(() =>
      app.initializeApp.mock.calls.length > 0 ? [created] : []
    );
    app.getApp.mockReturnValue(created);

    const first = firebase.getFirebaseAuth();
    const second = firebase.getFirebaseAuth();

    expect(auth.initializeAuth).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it('builds a new one when the app it belonged to is gone', () => {
    const firebase = load();
    const first = { name: '[DEFAULT]' };
    const second = { name: '[DEFAULT]' };

    app.getApps.mockReturnValue([first]);
    app.getApp.mockReturnValue(first);
    firebase.getFirebaseAuth();

    app.getApps.mockReturnValue([second]);
    app.getApp.mockReturnValue(second);
    firebase.getFirebaseAuth();

    expect(auth.initializeAuth).toHaveBeenCalledTimes(2);
  });

  it('gives the same instance to a caller that asked for it safely', () => {
    const firebase = load();
    const created = { name: '[DEFAULT]' };

    app.initializeApp.mockReturnValue(created);
    app.getApps.mockImplementation(() =>
      app.initializeApp.mock.calls.length > 0 ? [created] : []
    );
    app.getApp.mockReturnValue(created);

    expect(firebase.requireFirebaseAuth()).toBe(firebase.getFirebaseAuth());
    expect(auth.initializeAuth).toHaveBeenCalledTimes(1);
  });
});

describe('what this file does not do', () => {
  it('sends nothing anywhere by being loaded', () => {
    load();

    expect(app.initializeApp).not.toHaveBeenCalled();
    expect(auth.initializeAuth).not.toHaveBeenCalled();
  });

  it('writes no value anywhere', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});

    load().getFirebaseAuth();

    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();

    jest.restoreAllMocks();
  });

  it('puts nothing of its own into storage', () => {
    load().getFirebaseAuth();

    // The SDK writes its own session; this app writes nothing beside it.
    expect(asyncStorage.setItem).not.toHaveBeenCalled();
  });
});
