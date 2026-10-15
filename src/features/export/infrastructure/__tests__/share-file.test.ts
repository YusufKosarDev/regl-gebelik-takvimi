import type { ExportFile } from '../../application/build-export-files';
import { shareTextFile } from '../share-file';

/**
 * The exported file does not outlive the share.
 *
 * What goes to the sheet is a day-by-day CSV of somebody's records. It used
 * to stay in the cache until the OS felt like reclaiming it — which on most
 * phones is never — surviving even "delete all my data". Now the file is
 * deleted the moment the share sheet is done with it, whatever the sheet
 * came back with.
 */

const state = {
  calls: [] as string[],
  failDelete: false,
};

jest.mock('expo-file-system', () => {
  class Directory {
    get exists(): boolean {
      return true;
    }

    create(): void {
      state.calls.push('dir-create');
    }
  }

  class File {
    readonly uri = 'file:///cache/exports/export.csv';

    get exists(): boolean {
      return false;
    }

    create(): void {
      state.calls.push('create');
    }

    write(_contents: string): void {
      state.calls.push('write');
    }

    delete(): void {
      if (state.failDelete) {
        throw new Error('EBUSY');
      }

      state.calls.push('delete');
    }
  }

  return { Directory, File, Paths: { cache: 'file:///cache' } };
});

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

jest.mock('@/shared/logging', () => ({
  logEvent: jest.fn(),
  describeValue: jest.requireActual('@/shared/logging').describeValue,
  describeError: jest.requireActual('@/shared/logging').describeError,
}));

const sharing = jest.requireMock('expo-sharing') as {
  isAvailableAsync: jest.Mock;
  shareAsync: jest.Mock;
};
const logging = jest.requireMock('@/shared/logging') as { logEvent: jest.Mock };

const file: ExportFile = {
  fileName: 'export.csv',
  mimeType: 'text/csv',
  contents: 'date,flow\n2026-09-02,light\n',
};

beforeEach(() => {
  state.calls = [];
  state.failDelete = false;

  sharing.isAvailableAsync.mockReset();
  sharing.isAvailableAsync.mockResolvedValue(true);
  sharing.shareAsync.mockReset();
  sharing.shareAsync.mockImplementation(async () => {
    state.calls.push('share');
  });
  logging.logEvent.mockReset();
});

describe('shareTextFile', () => {
  it('deletes the file once the share sheet is done with it', async () => {
    await shareTextFile(file);

    expect(state.calls).toEqual(['create', 'write', 'share', 'delete']);
  });

  it('deletes it even when the share itself failed', async () => {
    sharing.shareAsync.mockRejectedValue(new Error('sheet dismissed'));

    await expect(shareTextFile(file)).rejects.toThrow();

    expect(state.calls).toContain('delete');
  });

  it('still reports the share when only the cleanup failed', async () => {
    // The person shared their file; a cache that would not empty is logged by
    // name for the wipe to catch, not turned into a failure of what worked.
    state.failDelete = true;

    expect(await shareTextFile(file)).toBe('shared');
    expect(logging.logEvent).toHaveBeenCalledWith('data export failed', expect.anything());
  });

  it('writes nothing at all when the device has no share sheet', async () => {
    sharing.isAvailableAsync.mockResolvedValue(false);

    expect(await shareTextFile(file)).toBe('unavailable');
    expect(state.calls).toEqual([]);
  });
});
