import { useEffect } from 'react';
import { AppState } from 'react-native';

import { getCurrentAuthUser, observeAuthUser } from '@/features/auth/data/auth-repository';
import { openAppDatabase } from '@/storage/db';
import { logEvent } from '@/shared/logging';

import {
  flushPendingAutomaticSync,
  requestAutomaticSync,
  setAutomaticSyncContext,
} from './automatic-sync-scheduler';

/**
 * Wires the scheduler to the two things only a running app knows: who is signed
 * in, and whether it is on screen.
 *
 * Mounted once, at the root, so the triggers do not depend on which screen
 * somebody happens to be looking at — an edit made on the history screen should
 * still reach the account after they navigate away.
 *
 * `AppState` comes from react-native itself. Nothing here schedules work for
 * when the app is closed, and there is no timer: `background` is a chance to
 * flush what is already waiting, not a chance to start something new.
 */
export function useAutomaticSync(): void {
  useEffect(() => {
    let active = true;

    /** Points the scheduler at the current account, or at nothing. */
    const adopt = (uid: string | null) => {
      if (!active) {
        return;
      }

      if (uid === null) {
        setAutomaticSyncContext(null);

        return;
      }

      openAppDatabase()
        .then((db) => {
          if (!active) {
            return;
          }

          setAutomaticSyncContext({ db, uid });

          // Signing in is the largest gap there is: this phone may have been
          // out of date for as long as the session was gone.
          void requestAutomaticSync('sign-in');
        })
        .catch((error: unknown) => {
          logEvent('automatic sync failed', error);
        });
    };

    // The watcher fires once with the state as it stands, so there is no need
    // to ask separately — but a build with no Firebase project throws instead
    // of answering, and that is a state rather than a fault.
    let unsubscribe: (() => void) | null = null;

    try {
      unsubscribe = observeAuthUser((user) => {
        adopt(user?.uid ?? null);
      });
    } catch {
      // No project: nothing to sync with, and nothing to watch.
      setAutomaticSyncContext(null);
    }

    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void requestAutomaticSync('foreground');

        return;
      }

      // Going away. Anything still inside its debounce would otherwise wait
      // for the next launch — which, for somebody who records a period and
      // puts the phone down, is the ordinary case rather than the edge one.
      void flushPendingAutomaticSync();
    });

    return () => {
      active = false;
      unsubscribe?.();
      subscription.remove();
      setAutomaticSyncContext(null);
    };
  }, []);
}

/** Kept exported so a caller that already knows the session can skip the watch. */
export function currentUidOrNull(): string | null {
  try {
    return getCurrentAuthUser()?.uid ?? null;
  } catch {
    return null;
  }
}
