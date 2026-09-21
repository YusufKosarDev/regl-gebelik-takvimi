import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';

import { AuthError, toAuthError } from '../domain/auth-error';
import type { AuthUser } from '../domain/auth-user';
import { mapFirebaseUserOrNull } from '../domain/auth-user';
import { requireFirebaseAuth } from '../infrastructure/firebase';

/**
 * Everything this app does with an account.
 *
 * The only caller of the auth SDK outside `infrastructure/firebase.ts`. It
 * speaks `AuthUser` on the way out and `AuthError` when something fails, so no
 * screen ever holds a Firebase object or a Firebase message.
 *
 * Nothing here reads or writes the cycle database, and nothing here uploads
 * anything. Signing in creates an account and a session; what a session would
 * eventually be *for* is a later step, and the boundary that decides what could
 * ever be sent is in `src/features/privacy/`.
 *
 * Credentials pass through and are not kept. An email and a password arrive as
 * arguments, go to the SDK, and are not stored, cached or logged — not on the
 * way in, and not in an error on the way out.
 */

/**
 * Who is signed in, as far as this device knows, right now.
 *
 * Synchronous and local: it reads the session the SDK restored from storage,
 * and asks nothing over the network. `null` means nobody — including on the
 * first run before the SDK has finished restoring, which is why a screen that
 * cares watches with `observeAuthUser` rather than asking once.
 */
export function getCurrentAuthUser(): AuthUser | null {
  try {
    return mapFirebaseUserOrNull(requireFirebaseAuth().currentUser);
  } catch (error) {
    throw toAuthError(error);
  }
}

/**
 * Watches who is signed in, and says how to stop watching.
 *
 * The callback is handed this app's own user, or `null`. It fires once with the
 * state as it stands and again on every change, which is what makes it the
 * right thing for a screen: a session restored from storage a moment after
 * mount arrives as a second call rather than being missed.
 *
 * The returned function unsubscribes. A screen that did not call it on unmount
 * would keep a closure over state it no longer has.
 */
export function observeAuthUser(callback: (user: AuthUser | null) => void): () => void {
  try {
    return onAuthStateChanged(requireFirebaseAuth(), (user) => {
      callback(mapFirebaseUserOrNull(user));
    });
  } catch (error) {
    throw toAuthError(error);
  }
}

/**
 * Makes an account and signs into it.
 *
 * Whatever the SDK refuses this for — an address already in use, a password it
 * considers too weak — comes back as an `AuthError` with a code. The SDK's own
 * message is dropped: it is written for a developer, and for some failures it
 * quotes what it was sent.
 */
export async function signUpWithEmail(email: string, password: string): Promise<AuthUser> {
  try {
    const credential = await createUserWithEmailAndPassword(requireFirebaseAuth(), email, password);

    return mapFirebaseUserOrNull(credential.user) as AuthUser;
  } catch (error) {
    throw toAuthError(error);
  }
}

/**
 * Signs into an account that already exists.
 *
 * A wrong password and an address with no account come back as the same code,
 * on purpose: telling them apart would answer "does this person have an
 * account here" for anyone who asked, and here that question is about a period
 * tracker.
 */
export async function signInWithEmail(email: string, password: string): Promise<AuthUser> {
  try {
    const credential = await signInWithEmailAndPassword(requireFirebaseAuth(), email, password);

    return mapFirebaseUserOrNull(credential.user) as AuthUser;
  } catch (error) {
    throw toAuthError(error);
  }
}

/**
 * Ends the session on this device.
 *
 * The SDK clears what it kept in storage. Nothing in the cycle database is
 * touched: the health data is the person's, it is on their phone, and signing
 * out of an account that has never carried any of it is no reason to delete it.
 */
export async function signOut(): Promise<void> {
  try {
    await firebaseSignOut(requireFirebaseAuth());
  } catch (error) {
    throw toAuthError(error);
  }
}

/**
 * Asks Firebase to send a password reset link to an address.
 *
 * Resolving says the request was made, and nothing more. In particular it does
 * not say that an account exists: an address with no account is answered the
 * same way as one with an account, because the alternative is a form that tells
 * anyone who types an address whether its owner tracks their period here.
 *
 * That is why `auth/user-not-found` is swallowed rather than raised. Firebase
 * itself hides it when email enumeration protection is on, and this makes the
 * answer the same either way rather than depending on a console setting.
 *
 * The address is trimmed, because a keyboard that capitalises and a paste that
 * brings a space are not the person getting their own address wrong.
 *
 * No `ActionCodeSettings`: the link goes to the page Firebase hosts, which
 * needs no deep link, no custom handler and nothing built here to receive it.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(requireFirebaseAuth(), email.trim());
  } catch (error) {
    const mapped = toAuthError(error);

    // `auth/user-not-found` lands on this code, and answering it would tell
    // the asker whose address is registered here. The other failures behind the
    // same code — a wrong password, a disabled sign-in — cannot come from a
    // request that carries no password.
    if (mapped.code === 'invalid-credentials') {
      return;
    }

    throw mapped;
  }
}

/**
 * Proves the person at the keyboard is the account holder, just now.
 *
 * Firebase refuses to delete an account on a session that has been sitting
 * around, and it is right to: a phone left unlocked on a table is exactly the
 * situation where "delete my account" should need the password again.
 *
 * Kept as its own function, and the only place `EmailAuthProvider` is named.
 * This app has one sign-in method today; when it has two, the branch belongs
 * here and nothing above this line has to learn about it.
 *
 * The password passes through and is not kept. It becomes a credential, goes to
 * the SDK, and is not stored, cached or logged — the same bargain as signing in.
 */
export async function reauthenticateWithPassword(email: string, password: string): Promise<void> {
  try {
    const auth = requireFirebaseAuth();
    const user = auth.currentUser;

    if (user === null) {
      throw new AuthError('signed-out');
    }

    await reauthenticateWithCredential(user, EmailAuthProvider.credential(email.trim(), password));
  } catch (error) {
    throw toAuthError(error);
  }
}

/**
 * Deletes the signed-in account.
 *
 * Only the account. Whatever that account had in Firestore is somebody else's
 * job to remove first — deleting the account while its backup is still there
 * would strand a document that no rule then allows anyone to read or delete,
 * because every rule in this project is written in terms of a uid that would no
 * longer exist.
 *
 * Firebase ends the session as part of this, so there is no `signOut` to call
 * afterwards; calling one would raise on a user that is already gone.
 */
export async function deleteAuthUser(): Promise<void> {
  try {
    const auth = requireFirebaseAuth();
    const user = auth.currentUser;

    if (user === null) {
      throw new AuthError('signed-out');
    }

    await deleteUser(user);
  } catch (error) {
    throw toAuthError(error);
  }
}
