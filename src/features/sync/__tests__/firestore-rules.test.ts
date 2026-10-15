import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * What the published security rules promise, pinned as text.
 *
 * This is a text pin, not a behaviour test: the repo has no rules emulator,
 * so what these tests can hold still is that the clauses exist, not that
 * Firestore enforces them. The limit is real and worth stating — a clause can
 * be present and wrong — but a deleted or renamed clause is exactly the kind
 * of quiet regression a text pin does catch, and the clauses themselves were
 * reviewed against every client write path when they were written.
 *
 * The client paths the rules have to stay compatible with:
 *
 *   - `pushRemoteSyncState` writes `expectedRevision + 1`, so a first counted
 *     write lands on 1 and every later one counts up by one.
 *   - `saveCloudBackup` counts up from the stored revision inside its
 *     transaction, and treats a stored revision it cannot read as 0 — so its
 *     write lands on 1 in exactly the cases the rules' legacy branch allows.
 *   - `deleteCloudBackup` deletes, which account deletion depends on.
 */

const rules = readFileSync(join(__dirname, '..', '..', '..', '..', 'firestore.rules'), 'utf8');

describe('the one rule there is', () => {
  it('still scopes everything to the owner', () => {
    expect(rules).toMatch(/request\.auth != null/);
    expect(rules).toMatch(/request\.auth\.uid == userId/);
  });

  it('matches only the backup document path', () => {
    expect(rules).toMatch(/\/users\/\{userId\}\/backups\/\{docId\}/);
  });
});

describe('what a write must look like', () => {
  it('requires the envelope shape: version 1, a counted revision, a hash, a payload', () => {
    expect(rules).toMatch(/version == 1/);
    expect(rules).toMatch(/revision is int/);
    expect(rules).toMatch(/revision >= 1/);
    expect(rules).toMatch(/contentHash is string/);
    expect(rules).toMatch(/payload is map/);
  });

  it('requires every update to count up by exactly one', () => {
    expect(rules).toMatch(/revision == resource\.data\.revision \+ 1/);
  });

  it('lets a legacy or unreadable stored revision be replaced only by revision one', () => {
    // The branch `saveCloudBackup` and `pushRemoteSyncState` both rely on:
    // a stored document with no (readable) revision counts as 0, so the next
    // write is 1.
    expect(rules).toMatch(/'revision' in resource\.data/);
    expect(rules).toMatch(/revision == 1/);
  });

  it('starts a fresh account at revision one', () => {
    expect(rules).toMatch(/allow create[\s\S]*?revision == 1/);
  });

  it('still lets the owner delete, which account deletion depends on', () => {
    expect(rules).toMatch(/allow delete/);
  });
});
