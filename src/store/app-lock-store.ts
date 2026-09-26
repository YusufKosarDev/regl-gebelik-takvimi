import { create } from 'zustand';

import { readLockRecord } from '@/features/app-lock/infrastructure/lock-record-store';

/**
 * Whether the lock is set, and whether it is currently closed.
 *
 * Its own store rather than a corner of `app-store`, for one reason that
 * matters: `app-store` persists through `app-state-storage`, which is
 * AsyncStorage. The lock record must not be there — it belongs in SecureStore,
 * behind the Keystore. Keeping them apart means there is no arrangement of this
 * file that could write a hash into AsyncStorage by accident.
 *
 * `enabled` is read from the record at startup. `locked` is runtime only: it is
 * where the app currently is, not something to remember across launches, and a
 * cold start always begins locked when a lock is set.
 *
 * `unreadable` carries the one thing the person has to be told (§
 * `LOCK_UNREADABLE_MESSAGE`). It is cleared once said, so the message appears
 * on the launch it happened and not on every one after.
 */

type AppLockStore = {
  readonly enabled: boolean;
  readonly locked: boolean;
  readonly hydrated: boolean;
  /** The stored lock could not be read, so it was turned off. Say so once. */
  readonly unreadable: boolean;

  readonly hydrate: () => Promise<void>;
  readonly lock: () => void;
  readonly unlock: () => void;
  /** After setting or changing a PIN: enabled, and already past the lock. */
  readonly markEnabled: () => void;
  readonly markDisabled: () => void;
  readonly acknowledgeUnreadable: () => void;
};

export const useAppLockStore = create<AppLockStore>((set) => ({
  enabled: false,
  locked: false,
  hydrated: false,
  unreadable: false,

  /**
   * Reads the record once at startup.
   *
   * Never rejects. An unreadable record has already been turned into "no lock"
   * by the store below it, and failing the whole app launch because a key store
   * misbehaved is exactly the outcome that decision exists to avoid.
   */
  hydrate: async () => {
    const read = await readLockRecord();

    set({
      enabled: read.kind === 'record',
      // A cold start is locked whenever there is a lock. The grace window is
      // about coming back, and a launch has nothing to come back from.
      locked: read.kind === 'record',
      unreadable: read.kind === 'unreadable',
      hydrated: true,
    });
  },

  lock: () => {
    set({ locked: true });
  },

  unlock: () => {
    set({ locked: false });
  },

  markEnabled: () => {
    set({ enabled: true, locked: false });
  },

  markDisabled: () => {
    set({ enabled: false, locked: false });
  },

  acknowledgeUnreadable: () => {
    set({ unreadable: false });
  },
}));
