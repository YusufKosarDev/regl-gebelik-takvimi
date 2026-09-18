import { useEffect, useState } from 'react';

import type { AuthUser } from '../domain/auth-user';
import { observeAuthUser } from '../data/auth-repository';
import { isFirebaseConfigured } from '../infrastructure/firebase';

/**
 * Who is signed in, for a screen to render.
 *
 * Four states rather than a user and a boolean. "Nobody is signed in" and "we
 * have not finished asking" look the same as a `null` user and read the same
 * to an `if`, and a screen that could not tell them apart would flash a sign-in
 * form at someone who is already signed in, every time the app opened.
 *
 * `not-configured` is a real state, not an error. A build with no Firebase
 * project is an app with no accounts, which is a thing this app is happy to
 * be: everything it does with a cycle, a pregnancy and an avatar works without
 * one, because none of that has ever left the device.
 */
export type AuthState =
  | { readonly status: 'loading'; readonly user: null }
  | { readonly status: 'not-configured'; readonly user: null }
  | { readonly status: 'signed-out'; readonly user: null }
  | { readonly status: 'signed-in'; readonly user: AuthUser };

const LOADING: AuthState = { status: 'loading', user: null };
const NOT_CONFIGURED: AuthState = { status: 'not-configured', user: null };
const SIGNED_OUT: AuthState = { status: 'signed-out', user: null };

/**
 * Watches the session and re-renders when it changes.
 *
 * The session itself is the SDK's to keep — it restores one from storage on
 * start and refreshes its own token — so nothing is stored here. This holds
 * what the last notification said and no more, which is why signing out in one
 * place updates every screen watching.
 *
 * The subscription is torn down on unmount. A callback still holding a
 * `setState` for a screen that is gone is the ordinary way a React app starts
 * warning about updates on unmounted components, and the ordinary fix is this
 * one.
 *
 * Only this app's own `AuthUser` ever comes out. The raw `User` does not reach
 * the hook, let alone the screen.
 */
export function useAuthState(): AuthState {
  const [state, setState] = useState<AuthState>(() =>
    isFirebaseConfigured() ? LOADING : NOT_CONFIGURED
  );

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setState(NOT_CONFIGURED);

      return undefined;
    }

    let isActive = true;

    try {
      const unsubscribe = observeAuthUser((user) => {
        if (!isActive) {
          return;
        }

        setState(user === null ? SIGNED_OUT : { status: 'signed-in', user });
      });

      return () => {
        isActive = false;
        unsubscribe();
      };
    } catch {
      // The only thing `observeAuthUser` refuses for is a build with no
      // project, and that is a state rather than something to show an error
      // about. Nothing is written down: the thrown value is the SDK's.
      setState(NOT_CONFIGURED);

      return undefined;
    }
  }, []);

  return state;
}
