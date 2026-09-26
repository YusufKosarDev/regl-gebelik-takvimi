import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { shouldLockOnForeground } from '../domain/lock-decision';

import { useAppLockStore } from '@/store/app-lock-store';

/**
 * Closes the lock when somebody comes back to a phone they left.
 *
 * Mounted once, at the root, beside `useAutomaticSync` — for the same reason:
 * which screen happens to be open is not what decides this.
 *
 * ## The loop this is written around
 *
 * On several Android devices the OS biometric sheet drives the activity to
 * `background`. A naive listener reads that as "they left", locks, and the
 * fingerprint prompt it was showing now belongs to a screen that has been
 * replaced — so unlocking becomes impossible.
 *
 * `authenticationInProgress` is the guard, and it is a ref rather than state on
 * purpose: it is read inside a listener that was registered once, and a piece of
 * state would be captured at its value on registration.
 */

/** Set while the OS biometric sheet is up. Module-level: one app, one sheet. */
const authenticating = { current: false };

/** Called by the biometric path around its own prompt. */
export function setAuthenticationInProgress(value: boolean): void {
  authenticating.current = value;
}

export function useAppLock(): void {
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        const { enabled, locked, lock } = useAppLockStore.getState();

        // Read at the moment it is needed rather than captured: the listener
        // is registered once and lives as long as the app does.
        if (
          !locked &&
          shouldLockOnForeground(
            {
              enabled,
              backgroundedAt: backgroundedAt.current,
              authenticationInProgress: authenticating.current,
            },
            Date.now()
          )
        ) {
          lock();
        }

        backgroundedAt.current = null;

        return;
      }

      // Android reports `background`; iOS also reports `inactive` on its way
      // there. The first one that arrives is when they left.
      if (backgroundedAt.current === null) {
        backgroundedAt.current = Date.now();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);
}
