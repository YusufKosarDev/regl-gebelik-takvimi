import { AuthError } from '@/features/auth/domain/auth-error';
import type { CloudSyncPayloadV1 } from '@/features/privacy/domain/cloud-sync-payload-v1';
import type { ISODate } from '@/types/iso-date';

import { cloudSyncContentHash } from '../../domain/cloud-sync-hash';
import {
  CloudSyncDocumentError,
  NO_REMOTE_REVISION,
  loadRemoteSyncState,
  pushRemoteSyncState,
} from '../cloud-sync-repository';

/**
 * Firestore is faked, but its transaction is not faked away.
 *
 * The mock below keeps a document store with a version counter per path and
 * re-runs an update function whose read went stale, which is what the SDK does
 * and the only reason a compare-and-set means anything. A mock that simply ran
 * the callback once would pass every test in here while a real lost write sat
 * in the code.
 */
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_firestore: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  runTransaction: jest.fn(),
  serverTimestamp: jest.fn(() => ({ __serverTimestamp: true })),
  getFirestore: jest.fn(),
}));

jest.mock('@/features/backup/infrastructure/firestore', () => ({
  requireFirestore: jest.fn(),
}));

// Nothing about a backup may reach a log.
jest.mock('@/shared/logging', () => ({
  logEvent: jest.fn(),
  describeValue: jest.requireActual('@/shared/logging').describeValue,
  describeError: jest.requireActual('@/shared/logging').describeError,
}));

const firestore = jest.requireMock('firebase/firestore');
const infrastructure = jest.requireMock('@/features/backup/infrastructure/firestore');
const logging = jest.requireMock('@/shared/logging');

const db = { type: 'firestore' };

const date = (value: string) => value as ISODate;

const UID = 'firebase-uid-1';
const OTHER_UID = 'firebase-uid-2';
const PATH = `users/${UID}/backups/current`;
const OTHER_PATH = `users/${OTHER_UID}/backups/current`;

const DEVICE_A = 'device-aaaa-1111';
const DEVICE_B = 'device-bbbb-2222';

const STAMP = { seconds: 1789000000, nanoseconds: 0 };
const STAMP_ISO = new Date(1789000000 * 1000).toISOString();

function payload(overrides: Partial<CloudSyncPayloadV1> = {}): CloudSyncPayloadV1 {
  return {
    version: 1,
    cycleSettings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
    periodRecords: [
      {
        id: 'period-2026-09-02',
        startDate: date('2026-09-02'),
        endDate: date('2026-09-07'),
        isOngoing: false,
      },
    ],
    pregnancyProfile: null,
    avatarConfig: null,
    notificationPreferences: {
      periodReminderEnabled: true,
      pregnancyWeeklyReminderEnabled: false,
    },
    ...overrides,
  };
}

/** A payload that is plainly not the default one, for telling writes apart. */
function otherPayload(): CloudSyncPayloadV1 {
  return payload({
    cycleSettings: { averageCycleLengthDays: 31, averagePeriodLengthDays: 4 },
  });
}

/** A stored document written by a build that counts revisions. */
function envelopeDocument(
  revision: number,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  const stored = payload();

  return {
    version: 1,
    revision,
    contentHash: cloudSyncContentHash(stored),
    deviceId: DEVICE_B,
    updatedAt: STAMP,
    payload: stored,
    ...overrides,
  };
}

/** A stored document from before any of the bookkeeping existed. */
function legacyDocument(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: 1,
    payload: payload(),
    updatedAt: STAMP,
    ...overrides,
  };
}

/** Firestore's own error: a code, and a message that quotes the path. */
function firestoreError(code: string, message = `Firestore: ${code}`) {
  const error = new Error(message) as Error & { code: string };
  error.code = code;

  return error;
}

// ---------------------------------------------------------------------------
// The fake database
// ---------------------------------------------------------------------------

type Reference = { readonly path: string };

const store = new Map<string, Record<string, unknown>>();
const versions = new Map<string, number>();

/** Every operation a transaction performed, in order, for read-before-write. */
let operations: string[] = [];

/** Every committed write, so a test can see what actually landed. */
let committed: { readonly path: string; readonly data: Record<string, unknown> }[] = [];

/** How many times an update function was run, retries included. */
let attempts = 0;

/** Runs once after the next transactional read, to simulate another writer. */
let duringTransaction: (() => void) | null = null;

function versionOf(path: string): number {
  return versions.get(path) ?? 0;
}

function put(path: string, data: Record<string, unknown>): void {
  store.set(path, data);
  versions.set(path, versionOf(path) + 1);
}

function snapshotOf(path: string) {
  const data = store.get(path);

  return {
    exists: () => data !== undefined,
    data: () => data,
  };
}

/** Enough of Firestore's transaction to make a compare-and-set mean something. */
async function fakeRunTransaction<T>(
  _firestore: unknown,
  updateFunction: (transaction: unknown) => Promise<T>
): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    attempts += 1;

    const readVersions = new Map<string, number>();
    const writes: { path: string; data: Record<string, unknown> }[] = [];

    const transaction = {
      get: async (reference: Reference) => {
        operations.push(`get ${reference.path}`);
        readVersions.set(reference.path, versionOf(reference.path));

        const snapshot = snapshotOf(reference.path);

        if (duringTransaction !== null) {
          const interfere = duringTransaction;
          duringTransaction = null;
          interfere();
        }

        return snapshot;
      },
      set: (reference: Reference, data: Record<string, unknown>) => {
        operations.push(`set ${reference.path}`);
        writes.push({ path: reference.path, data });
      },
    };

    const result = await updateFunction(transaction);

    const stale = [...readVersions.entries()].some(
      ([path, version]) => versionOf(path) !== version
    );

    if (stale) {
      // What the SDK does: throw the work away and run it again on what is
      // there now. Nothing is committed from a stale attempt.
      continue;
    }

    for (const write of writes) {
      put(write.path, write.data);
      committed.push(write);
    }

    return result;
  }

  throw firestoreError('aborted');
}

beforeEach(() => {
  store.clear();
  versions.clear();
  operations = [];
  committed = [];
  attempts = 0;
  duringTransaction = null;

  infrastructure.requireFirestore.mockReset();
  infrastructure.requireFirestore.mockReturnValue(db);

  firestore.doc.mockClear();
  firestore.setDoc.mockReset();
  firestore.setDoc.mockResolvedValue(undefined);
  firestore.getDoc.mockReset();
  firestore.getDoc.mockImplementation(async (reference: Reference) => snapshotOf(reference.path));
  firestore.runTransaction.mockReset();
  firestore.runTransaction.mockImplementation(fakeRunTransaction);
  firestore.serverTimestamp.mockClear();

  logging.logEvent.mockReset();
});

// ---------------------------------------------------------------------------

describe('where the sync reads and writes', () => {
  it('is the same document the backup button writes', async () => {
    await loadRemoteSyncState(UID);

    expect(firestore.doc).toHaveBeenCalledWith(db, 'users', UID, 'backups', 'current');
  });

  it('writes to that same one', async () => {
    await pushRemoteSyncState({
      uid: UID,
      expectedRevision: NO_REMOTE_REVISION,
      payload: payload(),
      deviceId: DEVICE_A,
    });

    expect(committed.map((write) => write.path)).toEqual([PATH]);
  });

  it('puts nothing but the account id in the path', async () => {
    await loadRemoteSyncState(UID);

    const path = firestore.doc.mock.calls[0].slice(1).join('/');

    expect(path).toBe(PATH);
    expect(path).not.toMatch(/@|2026-|device-|skin-tone/);
  });

  it.each([
    ['nothing', ''],
    ['blank text', '   '],
    ['something that is not text', 7],
  ])('refuses to read for a uid that is %s', async (_label, uid) => {
    await expect(loadRemoteSyncState(uid as unknown as string)).rejects.toBeInstanceOf(AuthError);

    expect(firestore.getDoc).not.toHaveBeenCalled();
  });

  it.each([
    ['nothing', ''],
    ['blank text', '   '],
  ])('refuses to write for a uid that is %s', async (_label, uid) => {
    await expect(
      pushRemoteSyncState({
        uid: uid as unknown as string,
        expectedRevision: NO_REMOTE_REVISION,
        payload: payload(),
        deviceId: DEVICE_A,
      })
    ).rejects.toBeInstanceOf(AuthError);

    expect(firestore.runTransaction).not.toHaveBeenCalled();
  });
});

describe('reading what is in the account', () => {
  it('says nothing is there when nothing is', async () => {
    await expect(loadRemoteSyncState(UID)).resolves.toBeNull();
  });

  it('gives back the envelope a counted document holds', async () => {
    put(PATH, envelopeDocument(5));

    await expect(loadRemoteSyncState(UID)).resolves.toEqual({
      version: 1,
      revision: 5,
      contentHash: cloudSyncContentHash(payload()),
      deviceId: DEVICE_B,
      updatedAt: STAMP_ISO,
      payload: payload(),
    });
  });

  it('copes with a document the server has not stamped yet', async () => {
    put(PATH, envelopeDocument(2, { updatedAt: null }));

    await expect(loadRemoteSyncState(UID)).resolves.toMatchObject({ updatedAt: null });
  });

  it('hands out no Firestore object', async () => {
    const document = envelopeDocument(3);
    put(PATH, document);

    const remote = await loadRemoteSyncState(UID);

    expect(remote).not.toBe(document);
    expect(Object.keys(remote ?? {}).sort()).toEqual([
      'contentHash',
      'deviceId',
      'payload',
      'revision',
      'updatedAt',
      'version',
    ]);
  });

  it('hands out no snapshot, so nothing above can call exists() or data()', async () => {
    put(PATH, envelopeDocument(3));

    const remote = (await loadRemoteSyncState(UID)) as unknown as Record<string, unknown>;

    expect(remote.exists).toBeUndefined();
    expect(remote.data).toBeUndefined();
    expect(remote.ref).toBeUndefined();
    expect(remote.metadata).toBeUndefined();
  });

  it.each([
    ['a version from another build', envelopeDocument(1, { version: 2 })],
    ['no version at all', envelopeDocument(1, { version: undefined })],
    ['a document that is not one', 'everything'],
  ])('refuses %s rather than calling it no backup', async (_label, document) => {
    put(PATH, document as Record<string, unknown>);

    await expect(loadRemoteSyncState(UID)).rejects.toBeInstanceOf(CloudSyncDocumentError);
  });

  it.each([
    ['a payload that is not one', envelopeDocument(1, { payload: 'everything' })],
    ['no payload', envelopeDocument(1, { payload: undefined })],
    [
      'a payload with a corrupt record',
      envelopeDocument(1, {
        payload: payload({
          periodRecords: [{ id: 'a', startDate: date('2026-02-30'), isOngoing: false }],
        }),
      }),
    ],
  ])('refuses %s', async (_label, document) => {
    put(PATH, document);

    await expect(loadRemoteSyncState(UID)).rejects.toBeInstanceOf(CloudSyncDocumentError);
  });

  it.each([
    ['a revision that counts backwards', envelopeDocument(1, { revision: -1 })],
    ['a revision that is not a whole number', envelopeDocument(1, { revision: 2.5 })],
    ['a revision that is not a number', envelopeDocument(1, { revision: 'five' })],
    ['a content hash that is blank', envelopeDocument(1, { contentHash: '   ' })],
    ['a device id that is blank', envelopeDocument(1, { deviceId: '' })],
  ])('refuses %s', async (_label, document) => {
    put(PATH, document);

    await expect(loadRemoteSyncState(UID)).rejects.toBeInstanceOf(CloudSyncDocumentError);
  });

  it('names no stored value when it refuses', async () => {
    put(
      PATH,
      envelopeDocument(1, {
        payload: payload({
          periodRecords: [{ id: 'a', startDate: date('2026-02-30'), isOngoing: false }],
        }),
      })
    );

    const error = await loadRemoteSyncState(UID).then(
      () => {
        throw new Error('expected a rejection');
      },
      (thrown: unknown) => thrown as Error
    );

    expect(error.message).not.toMatch(/\d{4}-\d{2}-\d{2}|@/);
  });
});

describe('a document written before any of this existed', () => {
  it('reads as revision zero', async () => {
    put(PATH, legacyDocument());

    await expect(loadRemoteSyncState(UID)).resolves.toMatchObject({
      revision: NO_REMOTE_REVISION,
    });
  });

  it('gets the hash of the payload that is there', async () => {
    put(PATH, legacyDocument());

    await expect(loadRemoteSyncState(UID)).resolves.toMatchObject({
      contentHash: cloudSyncContentHash(payload()),
    });
  });

  it('is nobody’s device rather than this one', async () => {
    put(PATH, legacyDocument());

    await expect(loadRemoteSyncState(UID)).resolves.toMatchObject({ deviceId: null });
  });

  it('keeps the stamp it already had', async () => {
    put(PATH, legacyDocument());

    await expect(loadRemoteSyncState(UID)).resolves.toMatchObject({ updatedAt: STAMP_ISO });
  });

  it('is not rewritten by being read', async () => {
    const before = legacyDocument();
    put(PATH, before);
    const version = versionOf(PATH);

    await loadRemoteSyncState(UID);
    await loadRemoteSyncState(UID);

    expect(store.get(PATH)).toBe(before);
    expect(versionOf(PATH)).toBe(version);
    expect(committed).toEqual([]);
    expect(firestore.setDoc).not.toHaveBeenCalled();
    expect(firestore.runTransaction).not.toHaveBeenCalled();
  });

  it('reads the same way every time, however often it is read', async () => {
    put(PATH, legacyDocument());

    const first = await loadRemoteSyncState(UID);
    const second = await loadRemoteSyncState(UID);

    expect(first).toEqual(second);
  });

  it('is refused when its payload is corrupt, old or not', async () => {
    put(
      PATH,
      legacyDocument({
        payload: payload({
          periodRecords: [{ id: 'a', startDate: date('2026-02-30'), isOngoing: false }],
        }),
      })
    );

    await expect(loadRemoteSyncState(UID)).rejects.toBeInstanceOf(CloudSyncDocumentError);
  });
});

describe('the first write to an account', () => {
  it('stores revision one when nothing is there and nothing was expected', async () => {
    const result = await pushRemoteSyncState({
      uid: UID,
      expectedRevision: NO_REMOTE_REVISION,
      payload: payload(),
      deviceId: DEVICE_A,
    });

    expect(result).toMatchObject({ kind: 'stored' });
    expect(store.get(PATH)).toMatchObject({ revision: 1 });
  });

  it('gives back the envelope it stored, unstamped', async () => {
    const result = await pushRemoteSyncState({
      uid: UID,
      expectedRevision: NO_REMOTE_REVISION,
      payload: payload(),
      deviceId: DEVICE_A,
    });

    expect(result).toEqual({
      kind: 'stored',
      envelope: {
        version: 1,
        revision: 1,
        contentHash: cloudSyncContentHash(payload()),
        deviceId: DEVICE_A,
        updatedAt: null,
        payload: payload(),
      },
    });
  });

  it('refuses to write when a revision was expected and there is no document', async () => {
    const result = await pushRemoteSyncState({
      uid: UID,
      expectedRevision: 1,
      payload: payload(),
      deviceId: DEVICE_A,
    });

    expect(result).toEqual({ kind: 'conflict', actualRevision: NO_REMOTE_REVISION });
    expect(store.has(PATH)).toBe(false);
    expect(committed).toEqual([]);
  });

  it('writes the five document fields and a server stamp, and nothing else', async () => {
    await pushRemoteSyncState({
      uid: UID,
      expectedRevision: NO_REMOTE_REVISION,
      payload: payload(),
      deviceId: DEVICE_A,
    });

    expect(Object.keys(committed[0].data).sort()).toEqual([
      'contentHash',
      'deviceId',
      'payload',
      'revision',
      'updatedAt',
      'version',
    ]);
  });

  it('dates it by the server rather than by this phone', async () => {
    await pushRemoteSyncState({
      uid: UID,
      expectedRevision: NO_REMOTE_REVISION,
      payload: payload(),
      deviceId: DEVICE_A,
    });

    expect(firestore.serverTimestamp).toHaveBeenCalledTimes(1);
    expect(committed[0].data.updatedAt).toEqual({ __serverTimestamp: true });
  });

  it('refuses a payload the app itself would refuse, before any round trip', async () => {
    await expect(
      pushRemoteSyncState({
        uid: UID,
        expectedRevision: NO_REMOTE_REVISION,
        payload: payload({ version: 2 as 1 }),
        deviceId: DEVICE_A,
      })
    ).rejects.toThrow(/expects version 1/);

    expect(firestore.runTransaction).not.toHaveBeenCalled();
  });

  it.each([-1, 1.5, '0', null])('refuses an expected revision of %p', async (expectedRevision) => {
    await expect(
      pushRemoteSyncState({
        uid: UID,
        expectedRevision: expectedRevision as number,
        payload: payload(),
        deviceId: DEVICE_A,
      })
    ).rejects.toThrow(/whole revision/);

    expect(firestore.runTransaction).not.toHaveBeenCalled();
  });

  it.each(['', '   ', null])('refuses a device id of %p', async (deviceId) => {
    await expect(
      pushRemoteSyncState({
        uid: UID,
        expectedRevision: NO_REMOTE_REVISION,
        payload: payload(),
        deviceId: deviceId as string,
      })
    ).rejects.toThrow(/device id/);

    // A caller's own mistake, found before anything is sent anywhere.
    expect(firestore.runTransaction).not.toHaveBeenCalled();
    expect(committed).toEqual([]);
  });
});

describe('compare and set', () => {
  beforeEach(() => {
    put(PATH, envelopeDocument(5));
  });

  it('stores the next revision when the expected one is the stored one', async () => {
    const result = await pushRemoteSyncState({
      uid: UID,
      expectedRevision: 5,
      payload: otherPayload(),
      deviceId: DEVICE_A,
    });

    expect(result).toMatchObject({ kind: 'stored', envelope: { revision: 6 } });
    expect(store.get(PATH)).toMatchObject({ revision: 6 });
  });

  it.each([
    ['behind', 4],
    ['ahead', 6],
    ['far behind', 0],
  ])('refuses a caller whose expected revision is %s', async (_label, expectedRevision) => {
    const result = await pushRemoteSyncState({
      uid: UID,
      expectedRevision,
      payload: otherPayload(),
      deviceId: DEVICE_A,
    });

    expect(result).toEqual({ kind: 'conflict', actualRevision: 5 });
  });

  it('writes nothing at all when it refuses', async () => {
    const before = store.get(PATH);
    const version = versionOf(PATH);

    await pushRemoteSyncState({
      uid: UID,
      expectedRevision: 4,
      payload: otherPayload(),
      deviceId: DEVICE_A,
    });

    expect(store.get(PATH)).toBe(before);
    expect(versionOf(PATH)).toBe(version);
    expect(committed).toEqual([]);
    expect(operations).toEqual([`get ${PATH}`]);
  });

  it('reads inside the transaction before it writes inside the transaction', async () => {
    await pushRemoteSyncState({
      uid: UID,
      expectedRevision: 5,
      payload: otherPayload(),
      deviceId: DEVICE_A,
    });

    expect(operations).toEqual([`get ${PATH}`, `set ${PATH}`]);
  });

  it('writes through the transaction and never through setDoc', async () => {
    await pushRemoteSyncState({
      uid: UID,
      expectedRevision: 5,
      payload: otherPayload(),
      deviceId: DEVICE_A,
    });

    expect(firestore.runTransaction).toHaveBeenCalledTimes(1);
    expect(firestore.setDoc).not.toHaveBeenCalled();
    expect(committed).toHaveLength(1);
  });

  it('counts up by one per successful write, whoever writes', async () => {
    await pushRemoteSyncState({
      uid: UID,
      expectedRevision: 5,
      payload: otherPayload(),
      deviceId: DEVICE_A,
    });
    await pushRemoteSyncState({
      uid: UID,
      expectedRevision: 6,
      payload: payload(),
      deviceId: DEVICE_B,
    });

    expect(store.get(PATH)).toMatchObject({ revision: 7, deviceId: DEVICE_B });
  });

  it('pushes the same payload again on its own revision, without deciding not to', async () => {
    // Identical content is not this file's business: a repository that skipped
    // the write would be making a decision `decideSync` is there to make.
    const result = await pushRemoteSyncState({
      uid: UID,
      expectedRevision: 5,
      payload: payload(),
      deviceId: DEVICE_A,
    });

    expect(result).toMatchObject({ kind: 'stored', envelope: { revision: 6 } });
    expect(store.get(PATH)).toMatchObject({ revision: 6 });
  });

  it('will not overwrite a stored document it cannot read', async () => {
    put(PATH, envelopeDocument(5, { payload: 'everything' }));
    const before = store.get(PATH);

    await expect(
      pushRemoteSyncState({
        uid: UID,
        expectedRevision: 5,
        payload: payload(),
        deviceId: DEVICE_A,
      })
    ).rejects.toBeInstanceOf(CloudSyncDocumentError);

    expect(store.get(PATH)).toBe(before);
    expect(committed).toEqual([]);
  });
});

describe('two phones writing at once', () => {
  beforeEach(() => {
    put(PATH, envelopeDocument(5));
  });

  it('lets the first one through', async () => {
    const first = await pushRemoteSyncState({
      uid: UID,
      expectedRevision: 5,
      payload: otherPayload(),
      deviceId: DEVICE_A,
    });

    expect(first).toMatchObject({ kind: 'stored', envelope: { revision: 6 } });
  });

  it('tells the second one what the revision actually is now', async () => {
    await pushRemoteSyncState({
      uid: UID,
      expectedRevision: 5,
      payload: otherPayload(),
      deviceId: DEVICE_A,
    });

    const second = await pushRemoteSyncState({
      uid: UID,
      expectedRevision: 5,
      payload: payload(),
      deviceId: DEVICE_B,
    });

    expect(second).toEqual({ kind: 'conflict', actualRevision: 6 });
  });

  it('leaves the first one’s write exactly as it was', async () => {
    await pushRemoteSyncState({
      uid: UID,
      expectedRevision: 5,
      payload: otherPayload(),
      deviceId: DEVICE_A,
    });

    const stored = store.get(PATH);

    await pushRemoteSyncState({
      uid: UID,
      expectedRevision: 5,
      payload: payload(),
      deviceId: DEVICE_B,
    });

    expect(store.get(PATH)).toBe(stored);
    expect(store.get(PATH)).toMatchObject({
      revision: 6,
      deviceId: DEVICE_A,
      contentHash: cloudSyncContentHash(otherPayload()),
    });
  });

  it('refuses the one whose read went stale mid-transaction, rather than committing it', async () => {
    // The other phone's write lands after this one has read and before it
    // commits — the case a plain setDoc loses silently.
    duringTransaction = () => {
      put(
        PATH,
        envelopeDocument(6, {
          deviceId: DEVICE_B,
          contentHash: cloudSyncContentHash(otherPayload()),
          payload: otherPayload(),
        })
      );
    };

    const result = await pushRemoteSyncState({
      uid: UID,
      expectedRevision: 5,
      payload: payload(),
      deviceId: DEVICE_A,
    });

    expect(attempts).toBe(2);
    expect(result).toEqual({ kind: 'conflict', actualRevision: 6 });
    expect(store.get(PATH)).toMatchObject({ revision: 6, deviceId: DEVICE_B });
    expect(committed).toEqual([]);
  });

  it('retries and succeeds when the stale read was the only problem', async () => {
    duringTransaction = () => {
      put(PATH, envelopeDocument(5, { deviceId: DEVICE_B }));
    };

    const result = await pushRemoteSyncState({
      uid: UID,
      expectedRevision: 5,
      payload: otherPayload(),
      deviceId: DEVICE_A,
    });

    expect(attempts).toBe(2);
    expect(result).toMatchObject({ kind: 'stored', envelope: { revision: 6 } });
    expect(store.get(PATH)).toMatchObject({ revision: 6, deviceId: DEVICE_A });
  });
});

describe('a legacy document meeting a push', () => {
  beforeEach(() => {
    put(PATH, legacyDocument());
  });

  it('counts as revision zero, so the first counted write expects zero', async () => {
    const result = await pushRemoteSyncState({
      uid: UID,
      expectedRevision: NO_REMOTE_REVISION,
      payload: otherPayload(),
      deviceId: DEVICE_A,
    });

    expect(result).toMatchObject({ kind: 'stored', envelope: { revision: 1 } });
  });

  it('refuses a caller that expected it to be counted already', async () => {
    const result = await pushRemoteSyncState({
      uid: UID,
      expectedRevision: 1,
      payload: otherPayload(),
      deviceId: DEVICE_A,
    });

    expect(result).toEqual({ kind: 'conflict', actualRevision: NO_REMOTE_REVISION });
    expect(store.get(PATH)).toEqual(legacyDocument());
  });

  it('becomes a full envelope once, and only because somebody pushed', async () => {
    await pushRemoteSyncState({
      uid: UID,
      expectedRevision: NO_REMOTE_REVISION,
      payload: otherPayload(),
      deviceId: DEVICE_A,
    });

    expect(store.get(PATH)).toMatchObject({
      version: 1,
      revision: 1,
      contentHash: cloudSyncContentHash(otherPayload()),
      deviceId: DEVICE_A,
    });
  });

  it('can be read back as the envelope it became', async () => {
    await pushRemoteSyncState({
      uid: UID,
      expectedRevision: NO_REMOTE_REVISION,
      payload: otherPayload(),
      deviceId: DEVICE_A,
    });

    // The stamp is the server's, which this fake does not resolve; the rest is
    // what a second device would read.
    put(PATH, { ...(store.get(PATH) as Record<string, unknown>), updatedAt: STAMP });

    await expect(loadRemoteSyncState(UID)).resolves.toEqual({
      version: 1,
      revision: 1,
      contentHash: cloudSyncContentHash(otherPayload()),
      deviceId: DEVICE_A,
      updatedAt: STAMP_ISO,
      payload: otherPayload(),
    });
  });

  it('carries on counting from there', async () => {
    await pushRemoteSyncState({
      uid: UID,
      expectedRevision: NO_REMOTE_REVISION,
      payload: otherPayload(),
      deviceId: DEVICE_A,
    });
    await pushRemoteSyncState({
      uid: UID,
      expectedRevision: 1,
      payload: payload(),
      deviceId: DEVICE_A,
    });

    expect(store.get(PATH)).toMatchObject({ revision: 2 });
  });
});

describe('the hash that goes with the payload', () => {
  it('is the hash of what is being stored', async () => {
    await pushRemoteSyncState({
      uid: UID,
      expectedRevision: NO_REMOTE_REVISION,
      payload: otherPayload(),
      deviceId: DEVICE_A,
    });

    const stored = store.get(PATH) as { contentHash: string; payload: CloudSyncPayloadV1 };

    expect(stored.contentHash).toBe(cloudSyncContentHash(stored.payload));
  });

  it('is worked out again rather than carried over from what was there', async () => {
    put(PATH, envelopeDocument(5));

    await pushRemoteSyncState({
      uid: UID,
      expectedRevision: 5,
      payload: otherPayload(),
      deviceId: DEVICE_A,
    });

    expect(store.get(PATH)).toMatchObject({ contentHash: cloudSyncContentHash(otherPayload()) });
    expect(store.get(PATH)?.contentHash).not.toBe(cloudSyncContentHash(payload()));
  });

  it('cannot be supplied by the caller', async () => {
    await pushRemoteSyncState({
      uid: UID,
      expectedRevision: NO_REMOTE_REVISION,
      payload: payload(),
      deviceId: DEVICE_A,
      // Not part of the input type; passed here to prove a stray field is not
      // picked up by anything on the way to the document.
      contentHash: 'not-a-hash-of-anything',
    } as never);

    expect(store.get(PATH)).toMatchObject({ contentHash: cloudSyncContentHash(payload()) });
  });

  it('is what a reader compares against, unchanged by the trip', async () => {
    await pushRemoteSyncState({
      uid: UID,
      expectedRevision: NO_REMOTE_REVISION,
      payload: otherPayload(),
      deviceId: DEVICE_A,
    });

    put(PATH, { ...(store.get(PATH) as Record<string, unknown>), updatedAt: STAMP });

    const remote = await loadRemoteSyncState(UID);

    expect(remote?.contentHash).toBe(cloudSyncContentHash(remote?.payload as CloudSyncPayloadV1));
  });
});

describe('one account never reaches another', () => {
  it('reads each account from its own document', async () => {
    put(PATH, envelopeDocument(5));

    await expect(loadRemoteSyncState(OTHER_UID)).resolves.toBeNull();
    await expect(loadRemoteSyncState(UID)).resolves.toMatchObject({ revision: 5 });
  });

  it('writes each account to its own document', async () => {
    await pushRemoteSyncState({
      uid: UID,
      expectedRevision: NO_REMOTE_REVISION,
      payload: payload(),
      deviceId: DEVICE_A,
    });
    await pushRemoteSyncState({
      uid: OTHER_UID,
      expectedRevision: NO_REMOTE_REVISION,
      payload: otherPayload(),
      deviceId: DEVICE_A,
    });

    expect(store.get(PATH)).toMatchObject({ contentHash: cloudSyncContentHash(payload()) });
    expect(store.get(OTHER_PATH)).toMatchObject({
      contentHash: cloudSyncContentHash(otherPayload()),
    });
  });

  it('counts each account’s revisions separately', async () => {
    put(PATH, envelopeDocument(5));

    const result = await pushRemoteSyncState({
      uid: OTHER_UID,
      expectedRevision: NO_REMOTE_REVISION,
      payload: payload(),
      deviceId: DEVICE_A,
    });

    expect(result).toMatchObject({ envelope: { revision: 1 } });
    expect(store.get(PATH)).toMatchObject({ revision: 5 });
  });

  it('puts the account id nowhere but the path', async () => {
    await pushRemoteSyncState({
      uid: UID,
      expectedRevision: NO_REMOTE_REVISION,
      payload: payload(),
      deviceId: DEVICE_A,
    });

    expect(JSON.stringify(committed[0].data)).not.toContain(UID);
  });
});

describe('telling one failure from another', () => {
  it('reports a lost race as a result rather than as a throw', async () => {
    put(PATH, envelopeDocument(5));

    const result = await pushRemoteSyncState({
      uid: UID,
      expectedRevision: 4,
      payload: payload(),
      deviceId: DEVICE_A,
    });

    expect(result.kind).toBe('conflict');
    expect(result).not.toBeInstanceOf(Error);
  });

  it.each([
    ['permission-denied', 'invalid-credentials'],
    ['unauthenticated', 'invalid-credentials'],
    ['unavailable', 'network-failed'],
    ['deadline-exceeded', 'network-failed'],
    ['aborted', 'network-failed'],
    ['resource-exhausted', 'unknown'],
  ])('turns a read that failed with %s into %s', async (code, expected) => {
    firestore.getDoc.mockRejectedValue(firestoreError(code));

    await expect(loadRemoteSyncState(UID)).rejects.toMatchObject({ code: expected });
  });

  it.each([
    ['unavailable', 'network-failed'],
    ['permission-denied', 'invalid-credentials'],
  ])('turns a write that failed with %s into %s', async (code, expected) => {
    firestore.runTransaction.mockRejectedValue(firestoreError(code));

    await expect(
      pushRemoteSyncState({
        uid: UID,
        expectedRevision: NO_REMOTE_REVISION,
        payload: payload(),
        deviceId: DEVICE_A,
      })
    ).rejects.toMatchObject({ code: expected });
  });

  it('never reports a failed request as a lost race', async () => {
    firestore.runTransaction.mockRejectedValue(firestoreError('unavailable'));

    const outcome = await pushRemoteSyncState({
      uid: UID,
      expectedRevision: NO_REMOTE_REVISION,
      payload: payload(),
      deviceId: DEVICE_A,
    }).then(
      (result) => result,
      (error: unknown) => error
    );

    expect(outcome).toBeInstanceOf(AuthError);
    expect(outcome).not.toMatchObject({ kind: 'conflict' });
  });

  it('keeps an unreadable document apart from a failed request', async () => {
    put(PATH, envelopeDocument(1, { payload: 'everything' }));

    const error = await loadRemoteSyncState(UID).then(
      () => {
        throw new Error('expected a rejection');
      },
      (thrown: unknown) => thrown
    );

    expect(error).toBeInstanceOf(CloudSyncDocumentError);
    expect(error).not.toBeInstanceOf(AuthError);
  });

  it('keeps a caller’s own mistake apart from both', async () => {
    const error = await pushRemoteSyncState({
      uid: UID,
      expectedRevision: NO_REMOTE_REVISION,
      payload: payload({ version: 2 as 1 }),
      deviceId: DEVICE_A,
    }).then(
      () => {
        throw new Error('expected a rejection');
      },
      (thrown: unknown) => thrown
    );

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(AuthError);
    expect(error).not.toBeInstanceOf(CloudSyncDocumentError);
  });

  it('passes a build with no Firebase project through as it is', async () => {
    infrastructure.requireFirestore.mockImplementation(() => {
      throw new AuthError('not-configured');
    });

    await expect(loadRemoteSyncState(UID)).rejects.toMatchObject({ code: 'not-configured' });
    await expect(
      pushRemoteSyncState({
        uid: UID,
        expectedRevision: NO_REMOTE_REVISION,
        payload: payload(),
        deviceId: DEVICE_A,
      })
    ).rejects.toMatchObject({ code: 'not-configured' });
  });

  it.each([
    [
      'the path',
      firestoreError(
        'permission-denied',
        'Missing or insufficient permissions on users/firebase-uid-1/backups/current'
      ),
    ],
    ['a project name', firestoreError('unavailable', 'Could not reach regl-gebelik-takvimi')],
  ])('keeps %s out of what comes back', async (_label, thrown) => {
    firestore.runTransaction.mockRejectedValue(thrown);

    const error = await pushRemoteSyncState({
      uid: UID,
      expectedRevision: NO_REMOTE_REVISION,
      payload: payload(),
      deviceId: DEVICE_A,
    }).then(
      () => {
        throw new Error('expected a rejection');
      },
      (caught: unknown) => caught as Error
    );

    expect(error.message).toMatch(/^Auth failed: [a-z-]+\.$/);
    expect(error.message).not.toMatch(/users\/|firebase-uid|regl-gebelik/);
  });

  it('writes nothing to the log or the console, whatever happens', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});

    firestore.getDoc.mockRejectedValue(firestoreError('permission-denied'));
    firestore.runTransaction.mockRejectedValue(firestoreError('unavailable'));

    await loadRemoteSyncState(UID).catch(() => undefined);
    await pushRemoteSyncState({
      uid: UID,
      expectedRevision: NO_REMOTE_REVISION,
      payload: payload(),
      deviceId: DEVICE_A,
    }).catch(() => undefined);

    expect(logging.logEvent).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();

    jest.restoreAllMocks();
  });
});

describe('nothing happens on its own', () => {
  it('reads and writes nothing by being imported', () => {
    expect(firestore.getDoc).not.toHaveBeenCalled();
    expect(firestore.runTransaction).not.toHaveBeenCalled();
    expect(firestore.setDoc).not.toHaveBeenCalled();
  });

  it('subscribes to nothing, so no change is ever pushed anywhere', () => {
    expect(Object.keys(firestore)).not.toContain('onSnapshot');
  });

  it('sends nothing worked out from the payload', async () => {
    await pushRemoteSyncState({
      uid: UID,
      expectedRevision: NO_REMOTE_REVISION,
      payload: payload(),
      deviceId: DEVICE_A,
    });

    const written = JSON.stringify(committed[0].data);

    expect(written).not.toMatch(/cycleDay|phase|fertil|moodLabels|supportMessage|snapshot|widget/i);
  });
});
