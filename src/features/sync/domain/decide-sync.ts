/**
 * What a sync should do next, worked out from three facts and nothing else.
 *
 * No database, no network, no clock. This decides; somebody else carries it
 * out. That split is the point: the rule that decides whether to overwrite
 * someone's period history is the one piece that has to be provable, and a
 * function that reads nothing and writes nothing can be proved by reading it.
 *
 * Revisions rather than timestamps. A timestamp says when a write reached a
 * server, which is not when the edit was made, and depends on clocks this app
 * does not control; a revision only has to count. `updatedAt` stays what it is
 * — something to show a person — and takes no part in this.
 */

/** What was last synced on this device, for this account. */
export type CloudSyncBase = {
  readonly revision: number;
  readonly contentHash: string;
};

/** What is on the phone now. */
export type CloudSyncLocalState = {
  readonly contentHash: string;
};

/** What is in the account now, or `null` when there is no backup. */
export type CloudSyncRemoteState = {
  readonly revision: number;
  readonly contentHash: string;
};

export type CloudSyncDecision = 'noop' | 'push' | 'pull' | 'conflict';

export type CloudSyncInput = {
  /** `null` before this device has ever synced this account. */
  readonly base: CloudSyncBase | null;
  readonly local: CloudSyncLocalState;
  /** `null` when the account holds no backup. */
  readonly remote: CloudSyncRemoteState | null;
};

/**
 * Whether the account holds something other than what was last synced.
 *
 * The revision answers this on its own when everything is well behaved. The
 * hash is checked too, because "well behaved" is an assumption about every
 * client that will ever write to that document, including an older build and
 * anything edited by hand in a console. A document that changed without its
 * revision moving would otherwise be invisible.
 */
function hasRemoteChanged(base: CloudSyncBase, remote: CloudSyncRemoteState): boolean {
  return remote.revision !== base.revision || remote.contentHash !== base.contentHash;
}

/**
 * What to do next.
 *
 * The table:
 *
 *   local changed | remote changed | decision
 *   --------------|----------------|---------
 *   no            | no             | noop
 *   yes           | no             | push
 *   no            | yes            | pull
 *   yes           | yes            | conflict
 *
 * Two cases sit in front of that table.
 *
 * The first: both sides already hold the same thing. That can happen after a
 * push whose acknowledgement was lost, or when two devices made the same edit.
 * There is nothing to carry either way, so it is `noop` — asking someone to
 * resolve a conflict between two identical histories would be a question with
 * no answer. The caller should move its base forward to the remote revision.
 *
 * The second: there is no base, because this device has not synced this account
 * before. Nothing can be said to have changed when there is nothing to have
 * changed from, so the two sides are compared directly: identical is `noop`,
 * different is `conflict`, and an account with no backup at all is `push`.
 * Never `pull` — replacing what is on the phone is not something to decide
 * without a base to justify it.
 *
 * Nothing here is allowed to answer `pull` or `push` in a way that discards
 * data the other side has and this one does not know about. Where that cannot
 * be ruled out, the answer is `conflict`, and a person decides.
 */
export function decideSync(input: CloudSyncInput): CloudSyncDecision {
  const { base, local, remote } = input;

  if (remote === null) {
    // Nothing in the account: either it was never written, or it is gone. What
    // is on the phone is the only copy of it, so it is offered rather than
    // dropped — and `pull` here would mean emptying the phone to match nothing.
    return 'push';
  }

  // Already agreed, whatever the base thinks.
  if (local.contentHash === remote.contentHash) {
    return 'noop';
  }

  if (base === null) {
    // No base to measure from, and the two sides differ: the only honest answer
    // is that somebody has to look.
    return 'conflict';
  }

  const localChanged = local.contentHash !== base.contentHash;
  const remoteChanged = hasRemoteChanged(base, remote);

  if (localChanged && remoteChanged) {
    return 'conflict';
  }

  if (localChanged) {
    return 'push';
  }

  if (remoteChanged) {
    return 'pull';
  }

  // Unreachable as the predicates stand: "neither changed" means both sides
  // match the base, and two sides that match the base match each other, which
  // returned above. It is written down anyway so that a later change to either
  // predicate cannot quietly turn this corner into a push or a pull — the two
  // answers that overwrite something.
  return 'conflict';
}
