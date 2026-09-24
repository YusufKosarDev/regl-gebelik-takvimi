import type { CloudSyncPayloadV1 } from '@/features/privacy/domain/cloud-sync-payload-v1';

// jest.mock is hoisted above these by babel, so the mocks are in place.
import { OutdatedAppError } from '../../domain/outdated-app-error';
import { saveCloudBackup } from '../cloud-backup-repository';

/**
 * The write refuses what it cannot reproduce.
 *
 * `saveCloudBackup` is the manual "Yedek oluştur" button, and it replaces the
 * whole document. Before this guard it did so blind: a phone running an older
 * build would have written its own payload over one a newer phone wrote, and
 * whatever the newer one added would be gone.
 *
 * Firestore is faked down to the two calls the guard depends on — reading the
 * document inside a transaction, and setting it — because what is under test is
 * the decision, not the SDK.
 */

const mockTransactionGet = jest.fn();
const mockTransactionSet = jest.fn();

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => ({})),
  deleteDoc: jest.fn(),
  getDoc: jest.fn(),
  serverTimestamp: jest.fn(() => 'server-time'),
  runTransaction: jest.fn(async (_firestore: unknown, body: (t: unknown) => Promise<unknown>) =>
    body({ get: mockTransactionGet, set: mockTransactionSet })
  ),
}));

jest.mock('@/features/backup/infrastructure/firestore', () => ({
  requireFirestore: jest.fn(() => ({})),
}));

const USER = { uid: 'uid-1', email: 'someone@example.com' } as never;

function payload(): CloudSyncPayloadV1 {
  return {
    version: 1,
    cycleSettings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
    periodRecords: [],
    pregnancyProfile: null,
    avatarConfig: null,
    notificationPreferences: {
      periodReminderEnabled: false,
      pregnancyWeeklyReminderEnabled: false,
    },
    dailyEntries: [],
  };
}

/** What the transaction read finds in the document. */
function stored(document: unknown): void {
  mockTransactionGet.mockResolvedValue({ exists: () => document !== null, data: () => document });
}

beforeEach(() => {
  mockTransactionGet.mockReset();
  mockTransactionSet.mockReset();
});

describe('when the stored backup holds a field this build does not know', () => {
  beforeEach(() => {
    stored({ version: 1, payload: { ...payload(), somethingFromALaterBuild: [{ noted: 'on the 14th' }] } });
  });

  it('refuses rather than writing', async () => {
    await expect(saveCloudBackup(USER, payload())).rejects.toBeInstanceOf(OutdatedAppError);
  });

  it('writes nothing at all', async () => {
    // The important half. A refusal that had already written would be worse
    // than no refusal, because it would look handled.
    await expect(saveCloudBackup(USER, payload())).rejects.toThrow();

    expect(mockTransactionSet).not.toHaveBeenCalled();
  });

  it('names the field it protected, for a log line and a test', async () => {
    const error = await saveCloudBackup(USER, payload()).catch((thrown: unknown) => thrown);

    expect((error as OutdatedAppError).unknownFields).toEqual(['somethingFromALaterBuild']);
  });

  it('says nothing about what is in the field', async () => {
    // The message travels into logs. What is in that field is a period history.
    const error = await saveCloudBackup(USER, payload()).catch((thrown: unknown) => thrown);

    expect((error as Error).message).not.toContain('2026-10-14');
  });
});

describe('when the outgoing payload carries the unknown field', () => {
  it('writes, because nothing would be dropped', async () => {
    // This is the merge path: the field was carried through, so storing it
    // loses nothing and the guard has no reason to stand in the way.
    stored({ version: 1, payload: { ...payload(), somethingFromALaterBuild: [{ noted: 'on the 14th' }] } });

    const carrying = { ...payload(), somethingFromALaterBuild: [{ noted: 'on the 14th' }] } as CloudSyncPayloadV1;

    await saveCloudBackup(USER, carrying);

    expect(mockTransactionSet).toHaveBeenCalledTimes(1);
  });
});

describe('when there is nothing to protect', () => {
  it('writes over a document this build fully understands', async () => {
    stored({ version: 1, payload: payload() });

    await saveCloudBackup(USER, payload());

    expect(mockTransactionSet).toHaveBeenCalledTimes(1);
  });

  it('writes when there is no document yet', async () => {
    stored(null);

    await saveCloudBackup(USER, payload());

    expect(mockTransactionSet).toHaveBeenCalledTimes(1);
  });

  it('writes when the stored document is not shaped like one', async () => {
    // A malformed document has no fields worth protecting, and the read path
    // is where it gets its proper error. The guard does not become a parser.
    stored({ version: 1, payload: 'not a payload' });

    await saveCloudBackup(USER, payload());

    expect(mockTransactionSet).toHaveBeenCalledTimes(1);
  });
});
