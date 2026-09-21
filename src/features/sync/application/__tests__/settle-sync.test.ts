import { clearUnresolvedConflict } from '../../infrastructure/unresolved-conflict';
import { saveLastSyncAt } from '../../infrastructure/last-sync-at';
import { isSettledSyncOutcome, recordSyncSettled } from '../settle-sync';

jest.mock('../../infrastructure/last-sync-at', () => ({ saveLastSyncAt: jest.fn() }));
jest.mock('../../infrastructure/unresolved-conflict', () => ({
  clearUnresolvedConflict: jest.fn(),
}));

const saveLastSyncAtMock = saveLastSyncAt as jest.MockedFunction<typeof saveLastSyncAt>;
const clearUnresolvedConflictMock = clearUnresolvedConflict as jest.MockedFunction<
  typeof clearUnresolvedConflict
>;

const now = () => '2026-09-21T10:00:00.000Z';

beforeEach(() => {
  jest.clearAllMocks();

  saveLastSyncAtMock.mockResolvedValue(undefined);
  clearUnresolvedConflictMock.mockResolvedValue(undefined);
});

describe('which outcomes settle anything', () => {
  it.each([['noop'], ['pushed'], ['pulled'], ['merged']])(
    '%s means the phone and the account agree',
    (kind) => {
      expect(isSettledSyncOutcome(kind)).toBe(true);
    }
  );

  it.each([['conflict'], ['retry-required'], ['error']])('%s settles nothing', (kind) => {
    // A conflict is the opposite of agreement, and the other two mean nothing
    // was written at all. None of them may clear a note or move a clock.
    expect(isSettledSyncOutcome(kind)).toBe(false);
  });

  it('does not treat an unknown kind as settled', () => {
    expect(isSettledSyncOutcome('something-new')).toBe(false);
  });
});

describe('recording a settled sync', () => {
  it('writes down when it happened', () => {
    // The line under the switch used to move only for syncs the scheduler ran,
    // so pressing the button left it showing a time from before the sync.
    return recordSyncSettled({ uid: 'uid-1', now }).then(() => {
      expect(saveLastSyncAtMock).toHaveBeenCalledWith('2026-09-21T10:00:00.000Z');
    });
  });

  it('drops a note about a disagreement that no longer exists', async () => {
    // The note used to be cleared only by the conflict screen, so a conflict
    // that resolved itself left the notice up and automatic sync stopped.
    await recordSyncSettled({ uid: 'uid-1', now });

    expect(clearUnresolvedConflictMock).toHaveBeenCalledTimes(1);
  });

  it('clears whether or not there was one to clear', async () => {
    // Reading first would be a round-trip to decide whether to do something
    // that is idempotent anyway.
    await recordSyncSettled({ uid: 'uid-1', now });
    await recordSyncSettled({ uid: 'uid-1', now });

    expect(clearUnresolvedConflictMock).toHaveBeenCalledTimes(2);
  });
});

describe('when the bookkeeping itself fails', () => {
  it('still clears the note when the timestamp could not be written', async () => {
    // The data has already moved. A worse status line is not a worse outcome,
    // and it must not stop the note being dropped.
    saveLastSyncAtMock.mockRejectedValue(new Error('storage gone'));

    await expect(recordSyncSettled({ uid: 'uid-1', now })).resolves.toBeUndefined();
    expect(clearUnresolvedConflictMock).toHaveBeenCalledTimes(1);
  });

  it('does not throw when the note could not be cleared', async () => {
    clearUnresolvedConflictMock.mockRejectedValue(new Error('storage gone'));

    await expect(recordSyncSettled({ uid: 'uid-1', now })).resolves.toBeUndefined();
  });

  it('does not throw when neither could be done', async () => {
    saveLastSyncAtMock.mockRejectedValue(new Error('storage gone'));
    clearUnresolvedConflictMock.mockRejectedValue(new Error('storage gone'));

    await expect(recordSyncSettled({ uid: 'uid-1', now })).resolves.toBeUndefined();
  });
});
