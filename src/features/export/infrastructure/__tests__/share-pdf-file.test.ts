import type { ExportPdfDocument } from '../../application/build-export-files';
import { A4_HEIGHT_POINTS, A4_WIDTH_POINTS } from '../../presentation/export-pdf';
import { EXPORT_DIRECTORY } from '../export-cache';
import { sharePdfFile } from '../share-pdf-file';

/**
 * The printed document does not escape the folder the wipe empties.
 *
 * ## The hazard this file exists for
 *
 * `printToFileAsync` is documented as saving "to app's cache directory" and
 * takes no destination. `deleteExportCache()` empties exactly one folder -
 * `cache/exports` - and `wipe-local-data.ts` calls that and nothing else. Left
 * as it comes out of the printer, the PDF would sit beside that folder rather
 * than in it, and "delete all my data" would leave behind the most readable
 * copy of somebody's records the app can produce: a typeset page, not a CSV.
 *
 * `export-cache.ts` already records why that is the thing to avoid - "'Cache,
 * so the OS may reclaim it' turned out to mean 'stays indefinitely on most
 * phones'". So the move into `exports/` is the point of this file, and the
 * tests below are mostly about the ways it could fail to happen.
 */

type Recorded = { readonly call: string; readonly uri?: string };

const mockState = {
  calls: [] as Recorded[],
  /** Where the printer says it put the PDF, outside `exports/`. */
  printedUri: 'file:///cache/Print/abc123.pdf',
  failMove: false,
  failDelete: false,
  existing: new Set<string>(),
  directoryExists: true,
};

function mockRecord(call: string, uri?: string): void {
  mockState.calls.push(uri === undefined ? { call } : { call, uri });
}

/** Just the names, for the order assertions. */
const names = (): readonly string[] => mockState.calls.map((entry) => entry.call);

jest.mock('expo-file-system', () => {
  /**
   * Joins the way the real `File` and `Directory` constructors do.
   *
   * One separator between segments and nothing done to the segments
   * themselves. A pass over the finished string to tidy up repeated slashes
   * eats the `///` after the scheme - `file://cache/...` is a different path
   * from `file:///cache/...`, and a mock that produced the wrong one would
   * make itself the thing under test.
   */
  const join = (...segments: unknown[]): string =>
    segments
      .map((segment) =>
        typeof segment === 'string' ? segment : (segment as { uri: string }).uri
      )
      .reduce(
        (joined, segment) =>
          joined === ''
            ? segment
            : `${joined.replace(/\/+$/, '')}/${segment.replace(/^\/+/, '')}`,
        ''
      );

  class Directory {
    readonly uri: string;

    constructor(...segments: unknown[]) {
      this.uri = join(...segments);
    }

    get exists(): boolean {
      return mockState.directoryExists;
    }

    create(): void {
      mockRecord('dir-create', this.uri);
      mockState.directoryExists = true;
    }
  }

  class File {
    uri: string;

    constructor(...segments: unknown[]) {
      this.uri = join(...segments);
    }

    get exists(): boolean {
      return mockState.existing.has(this.uri);
    }

    async move(destination: { uri: string }): Promise<void> {
      if (mockState.failMove) {
        throw new Error('ENOSPC');
      }

      mockRecord('move', destination.uri);
      // The real `File` updates its own `uri` to the new location, which is
      // what lets one reference clean up whichever place the file ended in.
      this.uri = destination.uri;
    }

    delete(): void {
      if (mockState.failDelete) {
        throw new Error('EBUSY');
      }

      mockRecord('delete', this.uri);
    }
  }

  return { Directory, File, Paths: { cache: 'file:///cache' } };
});

jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

jest.mock('@/shared/logging', () => ({
  logEvent: jest.fn(),
  describeValue: jest.requireActual('@/shared/logging').describeValue,
  describeError: jest.requireActual('@/shared/logging').describeError,
}));

const print = jest.requireMock('expo-print') as { printToFileAsync: jest.Mock };
const sharing = jest.requireMock('expo-sharing') as {
  isAvailableAsync: jest.Mock;
  shareAsync: jest.Mock;
};
const logging = jest.requireMock('@/shared/logging') as { logEvent: jest.Mock };

const document: ExportPdfDocument = {
  fileName: 'regl-ozeti-2026-10-23.pdf',
  html: '<!DOCTYPE html><html lang="tr"><body>Şişkinlik</body></html>',
};

beforeEach(() => {
  mockState.calls = [];
  mockState.printedUri = 'file:///cache/Print/abc123.pdf';
  mockState.failMove = false;
  mockState.failDelete = false;
  mockState.existing = new Set();
  mockState.directoryExists = true;

  print.printToFileAsync.mockReset();
  print.printToFileAsync.mockImplementation(async () => {
    mockRecord('print');

    return { uri: mockState.printedUri, numberOfPages: 2 };
  });

  sharing.isAvailableAsync.mockReset();
  sharing.isAvailableAsync.mockResolvedValue(true);
  sharing.shareAsync.mockReset();
  sharing.shareAsync.mockImplementation(async (uri: string) => {
    mockRecord('share', uri);
  });

  logging.logEvent.mockReset();
});

describe('where the PDF ends up', () => {
  /**
   * The requirement, stated as the path the share sheet is handed.
   *
   * Not "a move happened" - that would pass with a move to anywhere. The URI
   * the sheet receives has to be inside the one folder the wipe empties.
   */
  it('is shared from inside the folder the wipe empties', async () => {
    await sharePdfFile(document);

    const shared = mockState.calls.find((entry) => entry.call === 'share');

    expect(shared?.uri).toBe(`file:///cache/${EXPORT_DIRECTORY}/${document.fileName}`);
  });

  it('is moved there before the sheet sees it, not after', async () => {
    await sharePdfFile(document);

    expect(names()).toEqual(['print', 'move', 'share', 'delete']);
  });

  it('is never shared from where the printer left it', async () => {
    await sharePdfFile(document);

    for (const entry of mockState.calls) {
      if (entry.call === 'share') {
        expect(entry.uri).not.toBe(mockState.printedUri);
      }
    }
  });

  it('creates the folder when this is the first export', async () => {
    mockState.directoryExists = false;

    await sharePdfFile(document);

    expect(names()).toContain('dir-create');
  });
});

describe('when the move fails', () => {
  /**
   * The failure that would otherwise leave the document behind.
   *
   * If the move does not happen the PDF is still on the device, in the
   * printer's own folder, where nothing will ever sweep it. So a failed move
   * has to take the printed file with it.
   */
  it('deletes the printed file rather than leaving it outside the folder', async () => {
    mockState.failMove = true;

    await expect(sharePdfFile(document)).rejects.toThrow('ENOSPC');

    const deleted = mockState.calls.find((entry) => entry.call === 'delete');

    expect(deleted?.uri).toBe(mockState.printedUri);
  });

  it('does not share anything', async () => {
    mockState.failMove = true;

    await expect(sharePdfFile(document)).rejects.toThrow();

    expect(names()).not.toContain('share');
  });
});

describe('after the sheet is done', () => {
  it('deletes the document from the folder', async () => {
    await sharePdfFile(document);

    const deleted = mockState.calls.filter((entry) => entry.call === 'delete');

    expect(deleted).toHaveLength(1);
    expect(deleted[0].uri).toBe(`file:///cache/${EXPORT_DIRECTORY}/${document.fileName}`);
  });

  it('deletes it even when the share itself failed', async () => {
    sharing.shareAsync.mockRejectedValue(new Error('sheet dismissed'));

    await expect(sharePdfFile(document)).rejects.toThrow();

    expect(names()).toContain('delete');
  });

  it('still reports the share when only the cleanup failed', async () => {
    // The person shared their document; a file that will not delete is logged
    // by name for the wipe to catch, not turned into a failure of what worked.
    mockState.failDelete = true;

    expect(await sharePdfFile(document)).toBe('shared');
    expect(logging.logEvent).toHaveBeenCalledWith('data export failed', expect.anything());
  });

  it('replaces an earlier export of the same day rather than writing over it', async () => {
    // Two exports on one day produce the same name, and another app may still
    // be reading the first.
    mockState.existing.add(`file:///cache/${EXPORT_DIRECTORY}/${document.fileName}`);

    await sharePdfFile(document);

    expect(names()).toEqual(['print', 'delete', 'move', 'share', 'delete']);
  });
});

describe('the print itself', () => {
  it('asks for A4 rather than taking the US Letter default', async () => {
    await sharePdfFile(document);

    expect(print.printToFileAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        html: document.html,
        width: A4_WIDTH_POINTS,
        height: A4_HEIGHT_POINTS,
      })
    );
  });

  it('prints nothing at all when the device has no share sheet', async () => {
    // The same rule `share-file.ts` keeps: a device with no sheet is a fact
    // about the device, and nothing should be written for a share that cannot
    // happen.
    sharing.isAvailableAsync.mockResolvedValue(false);

    expect(await sharePdfFile(document)).toBe('unavailable');
    expect(names()).toEqual([]);
  });
});
