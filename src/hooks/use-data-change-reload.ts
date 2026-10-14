import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { AppState } from 'react-native';

import type { LocalDataChangeOrigin } from '@/shared/data-change/local-data-change';
import { onLocalDataChanged } from '@/shared/data-change/local-data-change';

/**
 * Keeps a screen showing what is in the database rather than what was in it.
 *
 * Every screen that reads synced data used to read it once, on mount. That was
 * correct while nothing could change data except the screen in front of you.
 * A sync can, and does: a pull replaces the phone's data while somebody is
 * looking at a screen showing the old version — and, worse, while a form holds
 * the old version ready to be saved back over it.
 *
 * Three triggers, one mechanism:
 *
 *   - gaining navigation focus, which covers arriving at the screen and coming
 *     back to it from elsewhere in the app
 *   - the app returning to the foreground while this screen is the focused one,
 *     which covers everything that changed while somebody was in another app
 *   - an announcement from the change notifier while the screen is focused,
 *     which covers data arriving under somebody who is already looking
 *
 * The subscriptions live and die with focus, so a screen sitting in the
 * navigation stack does no work and cannot set state — it re-reads when it is
 * next looked at, which is the first moment the answer matters.
 *
 * ## The second trigger is not the first one wearing a different hat
 *
 * `useFocusEffect` is React Navigation's focus, and navigation does not move
 * when Android does. Backgrounding the app and resuming it leaves the same
 * screen focused the whole way through, so no focus effect runs and nothing is
 * re-read. For a long time this hook's own description said focus "covers
 * coming back to it", and the settings screen said the same thing about
 * returning from system settings. Both were describing an event nobody was
 * listening for.
 *
 * Measured on a device rather than argued about. With the period reminder on
 * and notifications turned off in Android's settings, the settings screen
 * correctly said so and offered its "open notification settings" button.
 * Turning notifications back on there and pressing Back came home to a screen
 * still insisting they were off — and to an empty queue: `dumpsys alarm`
 * counted no reminders for the package. Switching to another tab and back
 * rebuilt both of them. The stale sentence is recoverable by anyone who
 * happens to change tabs; the empty queue is not recoverable by somebody who
 * does not, and they are the person who did exactly what the app asked.
 *
 * `use-app-lock`, `use-automatic-sync` and `use-motion-allowed` were already
 * listening to `AppState` for their own versions of this. This is the fourth.
 *
 * ## What the resume read costs
 *
 * One screen's read per return, because only the focused screen is subscribed.
 * The price is the one focus already charges: a form holding unsaved edits is
 * replaced by what is stored. The reasoning beside `settings`'s own `load` is
 * what settles that — losing an unsaved edit is recoverable by retyping it,
 * and losing a saved record from another phone is not — and a resume is that
 * same argument rather than a new one.
 */

/**
 * What a screen's reload does, and how to call it off.
 *
 * `origin` is `null` for the read that happens because the screen was opened,
 * which no notice should be attached to: nobody's work was interrupted. A
 * resume passes `null` too, and for the same reason — coming back to the app is
 * an arrival, not an interruption.
 *
 * Returning a cancel function is optional but expected of any reload that sets
 * state after an await. Every one handed out is called when focus is lost, so a
 * read still in flight cannot land on a screen that has gone.
 *
 * ## Seven screens implement this, under three different names
 *
 * `settings`, `history`, `avatar`, `daily-log-history` and
 * `pregnancy-settings` call the flag `cancelled`; `index` calls it
 * `isActive`; `calendar` calls it `active`. All seven are the same thing -
 * a closure flag checked before every `setState` and flipped by the function
 * returned here - and all seven are correct.
 *
 * Written down because the inconsistency is not harmless. A sweep for
 * unguarded reloads grepped for `cancelled`, reported the two busiest screens
 * as unguarded, and was wrong about both; the names are why. If you are
 * checking whether a screen guards its reload, read the cleanup it returns
 * rather than searching for a word.
 */
export type DataChangeReload = (
  origin: LocalDataChangeOrigin | null
) => (() => void) | void;

/**
 * `reload` must be stable, or the subscription is torn down and rebuilt on
 * every render. Callers wrap theirs in `useCallback`.
 */
export function useDataChangeReload(reload: DataChangeReload): void {
  useFocusEffect(
    useCallback(() => {
      // One per read started while focused. An announcement can arrive while
      // the previous read is still in flight, and both have to be cancellable.
      const cancels = new Set<() => void>();

      const run = (origin: LocalDataChangeOrigin | null) => {
        const cancel = reload(origin);

        if (typeof cancel === 'function') {
          cancels.add(cancel);
        }
      };

      run(null);

      const unsubscribe = onLocalDataChanged(run);

      /*
       * Whether the app has actually been away since this screen gained focus.
       *
       * `change` reports states that are not a trip out of the app, and a read
       * per blip would be work nobody asked for. The question a resume answers
       * is "did anything change while we were gone", which needs a gone to have
       * happened — so the listener arms on the way out and fires on the way in.
       */
      let wasAway = AppState.currentState !== 'active';

      const appState = AppState.addEventListener('change', (next) => {
        if (next !== 'active') {
          wasAway = true;

          return;
        }

        if (!wasAway) {
          return;
        }

        wasAway = false;

        run(null);
      });

      return () => {
        unsubscribe();
        appState.remove();

        for (const cancel of cancels) {
          cancel();
        }

        cancels.clear();
      };
    }, [reload])
  );
}
