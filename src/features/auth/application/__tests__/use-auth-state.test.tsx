import { act, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import type { AuthUser } from '../../domain/auth-user';
import type { AuthState } from '../use-auth-state';
import { useAuthState } from '../use-auth-state';

jest.mock('../../data/auth-repository', () => ({
  observeAuthUser: jest.fn(),
  getCurrentAuthUser: jest.fn(),
  signInWithEmail: jest.fn(),
  signUpWithEmail: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock('../../infrastructure/firebase', () => ({
  isFirebaseConfigured: jest.fn(() => true),
  requireFirebaseAuth: jest.fn(),
  getFirebaseAuth: jest.fn(),
}));

const repository = jest.requireMock('../../data/auth-repository');
const firebase = jest.requireMock('../../infrastructure/firebase');

const USER: AuthUser = { uid: 'firebase-uid-1', email: 'someone@example.com' };

let unsubscribe: jest.Mock;
let notify: (user: AuthUser | null) => void;

/** Renders the hook and reports what it said, render by render. */
async function renderHook() {
  const states: AuthState[] = [];

  function Probe() {
    const state = useAuthState();
    states.push(state);

    return <Text>{state.status}</Text>;
  }

  return { states, screen: await render(<Probe />) };
}

beforeEach(() => {
  unsubscribe = jest.fn();
  notify = () => undefined;

  repository.observeAuthUser.mockReset();
  repository.observeAuthUser.mockImplementation((callback: (user: AuthUser | null) => void) => {
    notify = callback;

    return unsubscribe;
  });

  firebase.isFirebaseConfigured.mockReset();
  firebase.isFirebaseConfigured.mockReturnValue(true);
});

describe('useAuthState while it is still asking', () => {
  it('starts as loading rather than as signed out', async () => {
    const { states } = await renderHook();

    expect(states[0]).toEqual({ status: 'loading', user: null });
  });

  it('holds there until the session says something', async () => {
    const { screen } = await renderHook();

    expect(await screen.findByText('loading')).toBeTruthy();
  });
});

describe('useAuthState once the session has spoken', () => {
  it('says signed out when there is nobody', async () => {
    const { screen } = await renderHook();

    await act(async () => {
      notify(null);
    });

    expect(await screen.findByText('signed-out')).toBeTruthy();
  });

  it('says signed in, with this app’s own user', async () => {
    const { states, screen } = await renderHook();

    await act(async () => {
      notify(USER);
    });

    expect(await screen.findByText('signed-in')).toBeTruthy();
    expect(states[states.length - 1]).toEqual({ status: 'signed-in', user: USER });
  });

  it('follows the session as it changes', async () => {
    const { states, screen } = await renderHook();

    await act(async () => {
      notify(null);
    });
    await act(async () => {
      notify(USER);
    });
    await act(async () => {
      notify(null);
    });

    expect(await screen.findByText('signed-out')).toBeTruthy();
    expect(states.map((state) => state.status)).toEqual([
      'loading',
      'signed-out',
      'signed-in',
      'signed-out',
    ]);
  });

  it('watches once per mount', async () => {
    await renderHook();

    expect(repository.observeAuthUser).toHaveBeenCalledTimes(1);
  });
});

describe('useAuthState when the screen goes away', () => {
  it('stops watching', async () => {
    const { screen } = await renderHook();

    await screen.unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('ignores anything the session says afterwards', async () => {
    const { states, screen } = await renderHook();

    await screen.unmount();
    const seen = states.length;

    await act(async () => {
      notify(USER);
    });

    expect(states).toHaveLength(seen);
  });
});

describe('useAuthState in a build with no Firebase project', () => {
  beforeEach(() => {
    firebase.isFirebaseConfigured.mockReturnValue(false);
  });

  it('says so instead of loading forever', async () => {
    const { screen } = await renderHook();

    expect(await screen.findByText('not-configured')).toBeTruthy();
  });

  it('watches nothing', async () => {
    await renderHook();

    expect(repository.observeAuthUser).not.toHaveBeenCalled();
  });

  it('says so when the watch itself refuses', async () => {
    firebase.isFirebaseConfigured.mockReturnValue(true);
    repository.observeAuthUser.mockImplementation(() => {
      throw new Error('Auth failed: not-configured.');
    });

    const { screen } = await renderHook();

    expect(await screen.findByText('not-configured')).toBeTruthy();
  });

  it('writes nothing about it', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});

    await renderHook();

    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();

    jest.restoreAllMocks();
  });
});

describe('what the hook never hands out', () => {
  it('passes on nothing but uid and email', async () => {
    const { states } = await renderHook();

    await act(async () => {
      notify(USER);
    });

    const last = states[states.length - 1];

    expect(last.user === null ? [] : Object.keys(last.user)).toEqual(['uid', 'email']);
  });

  it('never holds a password or a token, because it is never given one', async () => {
    const { states } = await renderHook();

    await act(async () => {
      notify(USER);
    });

    expect(JSON.stringify(states)).not.toMatch(/token|password|refresh/i);
  });
});
