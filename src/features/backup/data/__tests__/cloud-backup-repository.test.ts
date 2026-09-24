import { AuthError } from '@/features/auth/domain/auth-error';
import type { AuthUser } from '@/features/auth/domain/auth-user';
import type { CloudSyncPayloadV1 } from '@/features/privacy/domain/cloud-sync-payload-v1';
import type { ISODate } from '@/types/iso-date';

import {
  BACKUP_COLLECTION,
  BACKUP_DOCUMENT_ID,
  BACKUP_ROOT_COLLECTION,
  deleteCloudBackup,
  loadCloudBackup,
  saveCloudBackup,
} from '../cloud-backup-repository';

// Firestore is faked. What this file pins is the path, what is written, what
// comes back, and what an error turns into — not that Firestore works.
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((...args: unknown[]) => ({ path: args.slice(1).join('/') })),
  deleteDoc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  serverTimestamp: jest.fn(() => ({ __serverTimestamp: true })),
  getFirestore: jest.fn(),
  /**
   * A save is a read and a write in one transaction now, because it has to
   * refuse to overwrite a field this build cannot reproduce.
   *
   * The write is still routed through the `setDoc` spy, so every assertion
   * below about what reaches the document reads the same as it did before.
   * It is applied after the body rather than during it, so a `setDoc` that
   * was told to reject still rejects the whole save.
   */
  runTransaction: jest.fn(async (_firestore: unknown, body: (t: unknown) => Promise<unknown>) => {
    const writes: unknown[][] = [];

    await body({
      get: (...args: unknown[]) => (jest.requireMock('firebase/firestore') as any).getDoc(...args),
      set: (...args: unknown[]) => {
        writes.push(args);
      },
    });

    for (const write of writes) {
      await (jest.requireMock('firebase/firestore') as any).setDoc(...write);
    }
  }),
}));

jest.mock('../../infrastructure/firestore', () => ({
  requireFirestore: jest.fn(),
}));

// Nothing about a backup may reach a log.
jest.mock('@/shared/logging', () => ({
  logEvent: jest.fn(),
  describeValue: jest.requireActual('@/shared/logging').describeValue,
  describeError: jest.requireActual('@/shared/logging').describeError,
}));

const firestore = jest.requireMock('firebase/firestore');
const infrastructure = jest.requireMock('../../infrastructure/firestore');
const logging = jest.requireMock('@/shared/logging');

const date = (value: string) => value as ISODate;

const USER: AuthUser = { uid: 'firebase-uid-1', email: 'someone@example.com' };
const OTHER: AuthUser = { uid: 'firebase-uid-2', email: 'someone-else@example.com' };

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

/** A stored document, as Firestore would hand it back. */
function storedDocument(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    payload: payload(),
    updatedAt: { seconds: 1789000000, nanoseconds: 0 },
    ...overrides,
  };
}

function snapshot(data: unknown | null) {
  return {
    exists: () => data !== null,
    data: () => data,
  };
}

/** Firestore's own error: a code, and a message that quotes the path. */
function firestoreError(code: string, message = `Firestore: ${code}`) {
  const error = new Error(message) as Error & { code: string };
  error.code = code;

  return error;
}

const db = { type: 'firestore' };

beforeEach(() => {
  infrastructure.requireFirestore.mockReset();
  infrastructure.requireFirestore.mockReturnValue(db);

  firestore.doc.mockClear();
  firestore.setDoc.mockReset();
  firestore.setDoc.mockResolvedValue(undefined);
  firestore.getDoc.mockReset();
  firestore.getDoc.mockResolvedValue(snapshot(null));
  firestore.runTransaction.mockClear();
  firestore.serverTimestamp.mockClear();

  logging.logEvent.mockReset();
});

describe('where a backup is kept', () => {
  it('is one document, named so a second backup replaces the first', () => {
    expect(BACKUP_ROOT_COLLECTION).toBe('users');
    expect(BACKUP_COLLECTION).toBe('backups');
    expect(BACKUP_DOCUMENT_ID).toBe('current');
  });

  it('writes to users/{uid}/backups/current', async () => {
    await saveCloudBackup(USER, payload());

    expect(firestore.doc).toHaveBeenCalledWith(db, 'users', USER.uid, 'backups', 'current');
  });

  it('reads from the same place', async () => {
    await loadCloudBackup(USER);

    expect(firestore.doc).toHaveBeenCalledWith(db, 'users', USER.uid, 'backups', 'current');
  });

  it('puts nothing but the account id in the path', async () => {
    await saveCloudBackup(USER, payload());

    const path = firestore.doc.mock.calls[0].slice(1).join('/');

    expect(path).toBe('users/firebase-uid-1/backups/current');
    expect(path).not.toMatch(/@|2026-|skin-tone/);
  });

  it('keeps one account out of another’s', async () => {
    await saveCloudBackup(USER, payload());
    await saveCloudBackup(OTHER, payload());

    expect(firestore.doc.mock.calls[0][2]).toBe('firebase-uid-1');
    expect(firestore.doc.mock.calls[1][2]).toBe('firebase-uid-2');
  });

  it.each([
    ['nobody', null],
    ['a user with no uid', { email: 'someone@example.com' }],
    ['a blank uid', { uid: '   ' }],
    ['a uid that is not text', { uid: 7 }],
  ])('refuses to write for %s', async (_label, user) => {
    await expect(saveCloudBackup(user as unknown as AuthUser, payload())).rejects.toBeInstanceOf(
      AuthError
    );

    expect(firestore.setDoc).not.toHaveBeenCalled();
  });

  it.each([
    ['nobody', null],
    ['a user with no uid', { email: 'someone@example.com' }],
  ])('refuses to read for %s', async (_label, user) => {
    await expect(loadCloudBackup(user as unknown as AuthUser)).rejects.toBeInstanceOf(AuthError);

    expect(firestore.getDoc).not.toHaveBeenCalled();
  });
});

describe('saveCloudBackup', () => {
  it('writes the payload under a version and a server time', async () => {
    await saveCloudBackup(USER, payload());

    expect(firestore.setDoc).toHaveBeenCalledTimes(1);
    expect(firestore.setDoc.mock.calls[0][1]).toEqual({
      version: 1,
      payload: payload(),
      updatedAt: { __serverTimestamp: true },
    });
  });

  it('dates it by the server rather than by this phone', async () => {
    await saveCloudBackup(USER, payload());

    expect(firestore.serverTimestamp).toHaveBeenCalledTimes(1);
  });

  it('writes those three fields and nothing else', async () => {
    await saveCloudBackup(USER, payload());

    expect(Object.keys(firestore.setDoc.mock.calls[0][1]).sort()).toEqual([
      'payload',
      'updatedAt',
      'version',
    ]);
  });

  it('refuses a payload the app itself would refuse', async () => {
    await expect(
      saveCloudBackup(USER, payload({ version: 2 as 1 }))
    ).rejects.toThrow(/expects version 1/);

    expect(firestore.setDoc).not.toHaveBeenCalled();
  });

  it('refuses a payload with a corrupt record, before sending it anywhere', async () => {
    await expect(
      saveCloudBackup(
        USER,
        payload({
          periodRecords: [{ id: 'a', startDate: date('2026-02-30'), isOngoing: false }],
        })
      )
    ).rejects.toThrow(/invalid startDate/);

    expect(firestore.setDoc).not.toHaveBeenCalled();
  });

  it('sends nothing worked out from the payload', async () => {
    await saveCloudBackup(USER, payload());

    const written = JSON.stringify(firestore.setDoc.mock.calls[0][1]);

    expect(written).not.toMatch(/cycleDay|phase|fertil|moodLabels|supportMessage|snapshot|widget/i);
  });

  it('sends no notification queue, app mode or device state', async () => {
    await saveCloudBackup(USER, payload());

    const written = JSON.stringify(firestore.setDoc.mock.calls[0][1]);

    expect(written).not.toMatch(/reminder-v1|identifier|scheduled|mode|token/i);
  });
});

describe('loadCloudBackup', () => {
  it('says nothing is there when nothing is', async () => {
    await expect(loadCloudBackup(USER)).resolves.toBeNull();
  });

  it('gives back this app’s own backup', async () => {
    firestore.getDoc.mockResolvedValue(snapshot(storedDocument()));

    await expect(loadCloudBackup(USER)).resolves.toEqual({
      version: 1,
      payload: payload(),
      updatedAt: new Date(1789000000 * 1000).toISOString(),
    });
  });

  it('hands out no Firestore object', async () => {
    const document = storedDocument();
    firestore.getDoc.mockResolvedValue(snapshot(document));

    const backup = await loadCloudBackup(USER);

    expect(backup).not.toBe(document);
    expect(Object.keys(backup ?? {}).sort()).toEqual(['payload', 'updatedAt', 'version']);
  });

  it('copes with a document the server has not stamped yet', async () => {
    firestore.getDoc.mockResolvedValue(snapshot(storedDocument({ updatedAt: null })));

    await expect(loadCloudBackup(USER)).resolves.toMatchObject({ updatedAt: null });
  });

  it.each([
    ['a version from another build', storedDocument({ version: 2 })],
    ['no version at all', storedDocument({ version: undefined })],
  ])('refuses %s', async (_label, document) => {
    firestore.getDoc.mockResolvedValue(snapshot(document));

    await expect(loadCloudBackup(USER)).rejects.toThrow(/expects version 1/);
  });

  it.each([
    ['a payload that is not one', storedDocument({ payload: 'everything' })],
    ['no payload', storedDocument({ payload: undefined })],
    [
      'a payload with a corrupt record',
      storedDocument({
        payload: payload({
          periodRecords: [{ id: 'a', startDate: date('2026-02-30'), isOngoing: false }],
        }),
      }),
    ],
    [
      'two records with the same id',
      storedDocument({
        payload: payload({
          periodRecords: [
            {
              id: 'period-2026-09-02',
              startDate: date('2026-09-02'),
              isOngoing: false,
            },
            {
              id: 'period-2026-09-02',
              startDate: date('2026-10-02'),
              isOngoing: false,
            },
          ],
        }),
      }),
    ],
  ])('refuses %s rather than calling it no backup', async (_label, document) => {
    firestore.getDoc.mockResolvedValue(snapshot(document));

    await expect(loadCloudBackup(USER)).rejects.toThrow();
  });

  it('names no stored value when it refuses', async () => {
    firestore.getDoc.mockResolvedValue(
      snapshot(
        storedDocument({
          payload: payload({
            periodRecords: [{ id: 'a', startDate: date('2026-02-30'), isOngoing: false }],
          }),
        })
      )
    );

    const error = await loadCloudBackup(USER).then(
      () => {
        throw new Error('expected a rejection');
      },
      (thrown: unknown) => thrown as Error
    );

    expect(error.message).not.toMatch(/\d{4}-\d{2}-\d{2}|@/);
  });
});

describe('what a Firestore failure turns into', () => {
  it.each([
    ['permission-denied', 'invalid-credentials'],
    ['unauthenticated', 'invalid-credentials'],
    ['unavailable', 'network-failed'],
    ['deadline-exceeded', 'network-failed'],
    ['aborted', 'network-failed'],
    ['resource-exhausted', 'unknown'],
  ])('turns %s into %s', async (code, expected) => {
    firestore.setDoc.mockRejectedValue(firestoreError(code));

    await expect(saveCloudBackup(USER, payload())).rejects.toMatchObject({ code: expected });
  });

  it('turns a failure with no code into unknown', async () => {
    firestore.getDoc.mockRejectedValue(new Error('something the SDK made up'));

    await expect(loadCloudBackup(USER)).rejects.toMatchObject({ code: 'unknown' });
  });

  it('passes a build with no Firebase project through as it is', async () => {
    infrastructure.requireFirestore.mockImplementation(() => {
      throw new AuthError('not-configured');
    });

    await expect(saveCloudBackup(USER, payload())).rejects.toMatchObject({
      code: 'not-configured',
    });
  });

  it.each([
    [
      'the path',
      firestoreError(
        'permission-denied',
        'Missing or insufficient permissions on users/firebase-uid-1/backups/current',
      ),
    ],
    ['a project name', firestoreError('unavailable', 'Could not reach regl-gebelik-takvimi')],
  ])('keeps %s out of what comes back', async (_label, thrown) => {
    firestore.setDoc.mockRejectedValue(thrown);

    const error = await saveCloudBackup(USER, payload()).then(
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

    firestore.setDoc.mockRejectedValue(firestoreError('permission-denied'));
    firestore.getDoc.mockRejectedValue(firestoreError('unavailable'));

    await saveCloudBackup(USER, payload()).catch(() => undefined);
    await loadCloudBackup(USER).catch(() => undefined);

    expect(logging.logEvent).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();

    jest.restoreAllMocks();
  });
});

describe('nothing happens on its own', () => {
  it('reads nothing by being imported', () => {
    expect(firestore.getDoc).not.toHaveBeenCalled();
    expect(firestore.setDoc).not.toHaveBeenCalled();
  });

  it('subscribes to nothing, so no change is ever pushed anywhere', () => {
    expect(Object.keys(firestore)).not.toContain('onSnapshot');
  });

  it('writes once per call and no more', async () => {
    await saveCloudBackup(USER, payload());
    await saveCloudBackup(USER, payload());

    expect(firestore.setDoc).toHaveBeenCalledTimes(2);
  });
});

describe('deleting a backup', () => {
  const firestore = jest.requireMock('firebase/firestore') as { deleteDoc: jest.Mock };

  beforeEach(() => {
    firestore.deleteDoc.mockReset();
  });

  it('targets that account’s one document', async () => {
    firestore.deleteDoc.mockResolvedValue(undefined);

    await deleteCloudBackup(USER);

    const [reference] = firestore.deleteDoc.mock.calls[0] as [{ path: string }];

    expect(reference.path).toBe(
      [BACKUP_ROOT_COLLECTION, USER.uid, BACKUP_COLLECTION, BACKUP_DOCUMENT_ID].join('/')
    );
  });

  it('succeeds when there is nothing there, which is what makes a retry safe', async () => {
    // Firestore treats deleting an absent document as done. An account deletion
    // that failed after this step can be retried from the top.
    firestore.deleteDoc.mockResolvedValue(undefined);

    await expect(deleteCloudBackup(USER)).resolves.toBeUndefined();
    await expect(deleteCloudBackup(USER)).resolves.toBeUndefined();
  });

  it('refuses a user with no uid rather than writing to a path nobody owns', async () => {
    await expect(deleteCloudBackup({ uid: '', email: null } as AuthUser)).rejects.toBeInstanceOf(
      AuthError
    );
    expect(firestore.deleteDoc).not.toHaveBeenCalled();
  });

  it('turns a refusal into an AuthError carrying no Firestore message', async () => {
    firestore.deleteDoc.mockRejectedValue(
      Object.assign(new Error('PERMISSION_DENIED for uid-1'), { code: 'permission-denied' })
    );

    await expect(deleteCloudBackup(USER)).rejects.toBeInstanceOf(AuthError);
  });
});
