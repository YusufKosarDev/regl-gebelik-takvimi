import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';

/**
 * The rules, running against a real rules engine.
 *
 * `src/features/sync/__tests__/firestore-rules.test.ts` pins the TEXT of the
 * rules and says so in its own header: without an emulator it cannot prove
 * behaviour. This file is that missing half. Every test here is a claim the
 * clients already rely on - ownership, the counted envelope, one past the
 * stored revision, the legacy document accepting only revision 1 - proved by
 * asking the engine rather than by reading the file.
 *
 * Runs only inside `firebase emulators:exec` (see `npm run test:rules`); the
 * app's Jest config ignores this directory on purpose.
 */

const OWNER = 'uid-owner';
const STRANGER = 'uid-stranger';

/** The envelope every current write path produces. */
function counted(revision: number) {
  return { version: 1, revision, contentHash: 'hash-abc', payload: { cycle: true } };
}

let env: RulesTestEnvironment;

function backupDocFor(uid: string, asUid: string | null) {
  const firestore =
    asUid === null ? env.unauthenticatedContext().firestore() : env.authenticatedContext(asUid).firestore();

  return doc(firestore, `users/${uid}/backups/current`);
}

/** Writes a document as the server would see it, past the rules. */
async function seed(data: Record<string, unknown>): Promise<void> {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), `users/${OWNER}/backups/current`), data);
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-regl-rules',
    firestore: {
      rules: readFileSync(join(__dirname, '..', 'firestore.rules'), 'utf8'),
    },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

describe('ownership', () => {
  it('lets the owner read their own backup', async () => {
    await seed(counted(1));

    await assertSucceeds(getDoc(backupDocFor(OWNER, OWNER)));
  });

  it('refuses another account the read', async () => {
    await seed(counted(1));

    await assertFails(getDoc(backupDocFor(OWNER, STRANGER)));
  });

  it('refuses anyone signed out', async () => {
    await seed(counted(1));

    await assertFails(getDoc(backupDocFor(OWNER, null)));
  });

  it('refuses another account the write, even a perfectly counted one', async () => {
    await seed(counted(1));

    await assertFails(setDoc(backupDocFor(OWNER, STRANGER), counted(2)));
  });

  it('refuses another account the delete', async () => {
    await seed(counted(1));

    await assertFails(deleteDoc(backupDocFor(OWNER, STRANGER)));
  });

  it('lets the owner delete, which "Hesabı sil" depends on', async () => {
    await seed(counted(1));

    await assertSucceeds(deleteDoc(backupDocFor(OWNER, OWNER)));
  });

  it('allows nobody to list the users collection', async () => {
    await seed(counted(1));

    const firestore = env.authenticatedContext(STRANGER).firestore();

    await assertFails(getDocs(collection(firestore, 'users')));
  });
});

describe('creating the first backup', () => {
  it('accepts a counted envelope at revision 1', async () => {
    await assertSucceeds(setDoc(backupDocFor(OWNER, OWNER), counted(1)));
  });

  it('refuses a first write that claims a later revision', async () => {
    await assertFails(setDoc(backupDocFor(OWNER, OWNER), counted(2)));
  });

  it.each([
    ['no revision at all', { version: 1, contentHash: 'h', payload: {} }],
    ['a revision that is not a number', { ...counted(1), revision: '1' }],
    ['a wrong version', { ...counted(1), version: 2 }],
    ['no content hash', { version: 1, revision: 1, payload: {} }],
    ['a payload that is not a map', { ...counted(1), payload: 'rows' }],
    ['the legacy shape', { version: 1, payload: {}, updatedAt: '2026-01-01T00:00:00.000Z' }],
  ])('refuses %s', async (_name, data) => {
    await assertFails(setDoc(backupDocFor(OWNER, OWNER), data));
  });
});

describe('counting up from what is stored', () => {
  it('accepts exactly one past the stored revision', async () => {
    await seed(counted(3));

    await assertSucceeds(setDoc(backupDocFor(OWNER, OWNER), counted(4)));
  });

  it('refuses a skip ahead', async () => {
    await seed(counted(3));

    await assertFails(setDoc(backupDocFor(OWNER, OWNER), counted(5)));
  });

  it('refuses writing the same revision again', async () => {
    // Two devices computing from the same base: the loser of this compare is
    // exactly the conflict the clients are built to notice.
    await seed(counted(3));

    await assertFails(setDoc(backupDocFor(OWNER, OWNER), counted(3)));
  });

  it('refuses going backwards', async () => {
    await seed(counted(3));

    await assertFails(setDoc(backupDocFor(OWNER, OWNER), counted(2)));
  });
});

describe('the legacy document', () => {
  // Written by builds older than the counter: no revision to count from.
  // Every client reads that as 0, so the one write allowed over it is 1.
  const LEGACY = { version: 1, payload: { cycle: true }, updatedAt: '2026-01-01T00:00:00.000Z' };

  it('accepts revision 1 over a document with no readable revision', async () => {
    await seed(LEGACY);

    await assertSucceeds(setDoc(backupDocFor(OWNER, OWNER), counted(1)));
  });

  it('refuses any other revision over it', async () => {
    await seed(LEGACY);

    await assertFails(setDoc(backupDocFor(OWNER, OWNER), counted(2)));
  });

  it('treats a stored revision of the wrong type as legacy too', async () => {
    await seed({ ...LEGACY, revision: 'three' });

    // The refusal is asked first: once revision 1 lands, 2 becomes the next
    // honest count and would succeed for the wrong reason.
    await assertFails(setDoc(backupDocFor(OWNER, OWNER), counted(2)));
    await assertSucceeds(setDoc(backupDocFor(OWNER, OWNER), counted(1)));
  });
});
