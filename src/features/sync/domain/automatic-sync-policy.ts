import { describeValue } from '@/shared/logging';

/**
 * Whether an automatic sync may run, worked out from facts and nothing else.
 *
 * No clock of its own, no storage, no network. Everything it needs arrives as
 * an argument, which is what makes the rule that decides whether a period
 * history leaves a phone by itself a thing that can be proved by reading it.
 *
 * Every refusal has a name. "It did not run" is not an answer anybody can act
 * on — not a test, not a screen, and not somebody wondering why their second
 * phone is out of date — so each `skip` says which rule stopped it.
 */

/** What kicked this off. Each has its own minimum spacing. */
export type AutomaticSyncTrigger =
  /** The app came back to the front. */
  | 'foreground'
  /** The app is going away and an edit is still waiting to be sent. */
  | 'background-flush'
  /** Somebody just signed in. */
  | 'sign-in'
  /** The switch was just turned on. */
  | 'enabled'
  /** The debounce after an edit elapsed. */
  | 'local-change';

export type AutomaticSyncSkipReason =
  /** The switch is off. This is the ordinary one. */
  | 'disabled'
  /** Nobody is signed in. */
  | 'signed-out'
  /** This build has no Firebase project. */
  | 'not-configured'
  /** An account deletion is part-way through for this account. */
  | 'deletion-pending'
  /** A conflict is waiting for a person. Nothing automatic may run past it. */
  | 'conflict-unresolved'
  /** A wipe, a restore or a conflict resolution is running. */
  | 'suspended'
  /** One is already running; the caller should join it rather than start another. */
  | 'in-flight'
  /** Too soon after the last attempt for this trigger. */
  | 'too-soon';

export type AutomaticSyncDecision =
  | { readonly kind: 'run' }
  | { readonly kind: 'skip'; readonly reason: AutomaticSyncSkipReason };

/**
 * How long a trigger waits after the last attempt before it may run again.
 *
 * Foreground is the one that needs a floor: opening and closing the app a few
 * times in a minute is ordinary behaviour and should not be ordinary traffic.
 * An edit has its own debounce before it ever gets here, and this is the
 * ceiling on top of that.
 *
 * Signing in, turning the switch on and the flush on the way out are all things
 * a person just did, once. Making them wait would be the app ignoring an
 * instruction it was given a moment ago.
 */
export const MINIMUM_INTERVAL_MS: Readonly<Record<AutomaticSyncTrigger, number>> = {
  foreground: 5 * 60 * 1000,
  'local-change': 2 * 60 * 1000,
  'sign-in': 0,
  enabled: 0,
  'background-flush': 0,
};

/** How long an edit waits for the next one before a sync is scheduled. */
export const LOCAL_CHANGE_DEBOUNCE_MS = 30 * 1000;

export type AutomaticSyncPolicyInput = {
  readonly trigger: AutomaticSyncTrigger;
  readonly automaticSyncEnabled: boolean;
  /** `null` when nobody is signed in. */
  readonly uid: string | null;
  readonly firebaseConfigured: boolean;
  readonly deletionPending: boolean;
  readonly conflictUnresolved: boolean;
  /** A wipe, restore or resolution is holding the gate. */
  readonly suspended: boolean;
  /** A sync is already running. */
  readonly inFlight: boolean;
  readonly nowMs: number;
  /** When the last attempt started, or `null` if there has not been one. */
  readonly lastAttemptAtMs: number | null;
};

/**
 * The order the rules are asked in, and it matters.
 *
 * The states that mean "never, for now" come before the ones that mean "not
 * yet". A refusal because the switch is off is the truth about an app that is
 * not syncing at all; reporting `too-soon` for it would suggest it would have
 * gone in four minutes.
 *
 * `conflict-unresolved` sits high for the same reason it exists: an automatic
 * sync that ran past a conflict would find the same conflict again, and the
 * only thing it could do with it is announce it a second time.
 */
export function decideAutomaticSync(input: AutomaticSyncPolicyInput): AutomaticSyncDecision {
  if (typeof input.nowMs !== 'number' || !Number.isFinite(input.nowMs)) {
    throw new Error(`decideAutomaticSync needs a clock reading: ${describeValue(input.nowMs)}.`);
  }

  if (!input.automaticSyncEnabled) {
    return { kind: 'skip', reason: 'disabled' };
  }

  if (!input.firebaseConfigured) {
    return { kind: 'skip', reason: 'not-configured' };
  }

  if (typeof input.uid !== 'string' || input.uid.trim() === '') {
    return { kind: 'skip', reason: 'signed-out' };
  }

  if (input.deletionPending) {
    return { kind: 'skip', reason: 'deletion-pending' };
  }

  if (input.conflictUnresolved) {
    return { kind: 'skip', reason: 'conflict-unresolved' };
  }

  if (input.suspended) {
    return { kind: 'skip', reason: 'suspended' };
  }

  if (input.inFlight) {
    return { kind: 'skip', reason: 'in-flight' };
  }

  const minimum = MINIMUM_INTERVAL_MS[input.trigger] ?? 0;

  if (minimum > 0 && input.lastAttemptAtMs !== null) {
    if (input.nowMs - input.lastAttemptAtMs < minimum) {
      return { kind: 'skip', reason: 'too-soon' };
    }
  }

  return { kind: 'run' };
}
