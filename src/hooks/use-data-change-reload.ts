import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

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
 * Two triggers, one mechanism:
 *
 *   - gaining focus, which covers arriving at the screen and coming back to it
 *   - an announcement from the change notifier while the screen is focused,
 *     which covers data arriving under somebody who is already looking
 *
 * The subscription lives and dies with focus, so a screen sitting in the
 * navigation stack does no work and cannot set state — it re-reads when it is
 * next looked at, which is the first moment the answer matters.
 */

/**
 * What a screen's reload does, and how to call it off.
 *
 * `origin` is `null` for the read that happens because the screen was opened,
 * which no notice should be attached to: nobody's work was interrupted.
 *
 * Returning a cancel function is optional but expected of any reload that sets
 * state after an await. Every one handed out is called when focus is lost, so a
 * read still in flight cannot land on a screen that has gone.
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

      return () => {
        unsubscribe();

        for (const cancel of cancels) {
          cancel();
        }

        cancels.clear();
      };
    }, [reload])
  );
}
