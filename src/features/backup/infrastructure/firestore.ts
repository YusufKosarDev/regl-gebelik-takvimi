import type { Firestore } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';

import { AuthError } from '@/features/auth/domain/auth-error';
import { getFirebaseApp, isFirebaseConfigured } from '@/features/auth/infrastructure/firebase';

/**
 * The one place this app talks to Firestore.
 *
 * The app instance is the one the auth feature already built, so there is a
 * single Firebase app in the process and a single place the config comes from.
 *
 * `getFirestore` is enough on its own: unlike auth there is no session to
 * persist here, and the offline cache the SDK keeps is its own business.
 *
 * Nothing else from Firebase is imported anywhere in this app — no Storage, no
 * Functions, no Analytics, no Crashlytics — and a test reads the source to keep
 * it that way.
 */

/**
 * The database, or an `AuthError` a screen can show.
 *
 * A build with no Firebase project has no database either, and that arrives as
 * the same kind of thing as "that password was wrong" rather than as a stray
 * exception: the account screen already knows how to say it.
 */
export function requireFirestore(): Firestore {
  if (!isFirebaseConfigured()) {
    throw new AuthError('not-configured');
  }

  return getFirestore(getFirebaseApp());
}
