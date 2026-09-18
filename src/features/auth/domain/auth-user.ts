import { describeValue } from '@/shared/logging';

/**
 * A signed-in person, as this app is willing to know them.
 *
 * Two fields. A Firebase `User` also carries a display name, a photo URL, a
 * phone number, the provider that vouched for them, when they last signed in
 * and a token — none of which this app has a use for, and all of which would
 * start being read by whatever it was handed to. What a sync needs is something
 * to file data under (`uid`) and something to show the person so they can tell
 * which account they are in (`email`).
 *
 * `email` is nullable because an account can exist without one, and because
 * anonymous sign-in would have none at all. A screen that has to say "signed in
 * as" needs to cope with not knowing.
 *
 * Nothing here is a credential. There is no password, no token and no refresh
 * token in this type, and there is nowhere in this app that keeps one: that is
 * the SDK's business, in its own storage.
 */
export type AuthUser = {
  readonly uid: string;
  readonly email: string | null;
};

/** The shape of the part of a Firebase `User` this app reads. */
export type FirebaseUserLike = {
  readonly uid?: unknown;
  readonly email?: unknown;
};

/**
 * Turns whatever the SDK handed back into the two fields this app uses.
 *
 * The boundary is the point. A raw `User` passed inwards would let any screen
 * reach for a token or a provider id, and would tie every layer that touched it
 * to Firebase being the thing that signs people in.
 *
 * A missing `uid` raises rather than being defaulted: an account with no id is
 * not an account, and inventing one would file someone's data under a name
 * nobody can look up again. An `email` that is absent, or is not text, becomes
 * `null`, because "we do not know it" is a real answer and the app already has
 * to handle it.
 *
 * Pure: nothing is mutated and no value is written anywhere.
 */
export function mapFirebaseUser(user: FirebaseUserLike): AuthUser {
  if (typeof user !== 'object' || user === null) {
    throw new Error(`mapFirebaseUser received something that is not a user: ${describeValue(user)}.`);
  }

  if (typeof user.uid !== 'string' || user.uid.trim() === '') {
    throw new Error(`mapFirebaseUser received a user with no uid: ${describeValue(user.uid)}.`);
  }

  return {
    uid: user.uid,
    email: typeof user.email === 'string' ? user.email : null,
  };
}

/**
 * The same mapping for a caller that may have nothing.
 *
 * `null` in, `null` out: "nobody is signed in" travels through the app as a
 * `null` user rather than as a thrown error, because it is the ordinary state
 * of someone who has not signed in.
 */
export function mapFirebaseUserOrNull(user: FirebaseUserLike | null | undefined): AuthUser | null {
  return user === null || user === undefined ? null : mapFirebaseUser(user);
}
