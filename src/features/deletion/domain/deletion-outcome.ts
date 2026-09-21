/**
 * What a deletion came to.
 *
 * Deleting is not one action. An account deletion touches an account, a cloud
 * document and, if asked, everything on the phone, and each of those can fail
 * on its own while the ones before it have already happened. A boolean would
 * turn "your account is gone but your records are still here" into the same
 * answer as "nothing happened", which is the one thing a person in the middle
 * of this must not be told.
 *
 * So: an outcome names how far it got. Screens turn that into a sentence and
 * tests assert on it, and neither has to read a stack trace to find out.
 */

/**
 * Why a deletion stopped.
 *
 * Coarse on purpose, and it deliberately mirrors `AuthErrorCode` where the two
 * overlap: what a person can do about "the network is gone" is the same whether
 * it happened signing in or deleting.
 */
export const DELETION_FAILURES = [
  /** This build has no Firebase project, so there is no account to delete. */
  'not-configured',
  /** Nobody is signed in. */
  'signed-out',
  /** The password did not match. */
  'invalid-credentials',
  /** Firebase wants the sign-in repeated before it will delete. */
  'requires-recent-login',
  /** It never reached the server. */
  'network-failed',
  /** Too many attempts, too quickly. */
  'too-many-requests',
  /** The backup document could not be removed. Nothing else was attempted. */
  'cloud-delete-failed',
  /** The backup is gone but the account is not. Safe to retry. */
  'account-delete-failed',
  /** The phone's own database refused. */
  'local-failed',
  'unknown',
] as const;

export type DeletionFailure = (typeof DELETION_FAILURES)[number];

export function isDeletionFailure(value: unknown): value is DeletionFailure {
  return typeof value === 'string' && (DELETION_FAILURES as readonly string[]).includes(value);
}

/**
 * What a local wipe came to.
 *
 * `partial` is its own answer rather than a failure. The tables are emptied in
 * one transaction, so by the time anything else runs the records are already
 * gone for good; a reminder that would not cancel or a widget that would not
 * redraw is worth saying out loud, but it is not worth telling somebody their
 * data is still there when it is not.
 */
export type LocalWipeOutcome =
  | { readonly kind: 'wiped' }
  | { readonly kind: 'partial' }
  | { readonly kind: 'failed'; readonly reason: DeletionFailure };

/**
 * What an account deletion came to.
 *
 * The two successes are different enough to need different words on screen:
 * one leaves a phone full of records, the other leaves an empty app on its way
 * back to onboarding.
 */
export type AccountDeletionOutcome =
  /** Account and cloud backup gone; records on this phone kept. */
  | { readonly kind: 'deleted' }
  /**
   * The account was already gone before this attempt started.
   *
   * Its own outcome rather than a failure or a plain `deleted`: nothing was
   * deleted just now, but there is also nothing left to delete, and the person
   * asking has been signed out of a session that pointed at nothing. Telling
   * them their password was wrong — which is what the raw Firebase error says —
   * would send them hunting for a mistake they did not make.
   */
  | { readonly kind: 'already-deleted' }
  /** Account, cloud backup and everything on this phone gone. */
  | { readonly kind: 'deleted-and-wiped' }
  /** The account is gone, but the local wipe that was asked for did not finish. */
  | { readonly kind: 'deleted-wipe-failed' }
  | { readonly kind: 'failed'; readonly reason: DeletionFailure };
