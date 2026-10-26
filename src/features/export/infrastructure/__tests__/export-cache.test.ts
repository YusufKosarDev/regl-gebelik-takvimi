import { EXPORT_DIRECTORY, PRINT_DIRECTORY, deleteExportCache } from '../export-cache';

/**
 * The folder the share sheet is fed from, emptied on demand.
 *
 * The CSV written for a share is somebody's day-by-day records in plain text.
 * "Cache, so the OS may reclaim it" turned out to mean "stays indefinitely on
 * most phones", so the app no longer leans on the OS: the share deletes its
 * own file afterwards, and the wipe calls this to keep the promise its panel
 * makes.
 */

const state = {
  exists: true,
  deleted: [] as string[],
  failDelete: false,
};

jest.mock('expo-file-system', () => {
  class Directory {
    private readonly parts: string[];

    constructor(...parts: string[]) {
      this.parts = parts;
    }

    get exists(): boolean {
      return state.exists;
    }

    delete(): void {
      if (state.failDelete) {
        throw new Error('EBUSY');
      }

      state.deleted.push(this.parts.join('/'));
    }
  }

  return { Directory, Paths: { cache: 'file:///cache' } };
});

beforeEach(() => {
  state.exists = true;
  state.deleted = [];
  state.failDelete = false;
});

describe('deleteExportCache', () => {
  it('removes the exports folder when it is there', () => {
    deleteExportCache();

    expect(state.deleted).toContain(`file:///cache/${EXPORT_DIRECTORY}`);
  });

  /**
   * And the printer's own folder, which is not inside `exports`.
   *
   * `printToFileAsync` writes to `<cache>/Print` - read off
   * `expo-print`'s `FileUtils.kt`, which calls
   * `generateOutputPath(context.cacheDir, "Print", ".pdf")` - and
   * `share-pdf-file.ts` moves the result into `exports` straight away.
   *
   * Straight away is not always. If the move fails the PDF is still in
   * `Print`, and if the delete that follows also fails it stays there. That
   * file is a typeset page of somebody's records, and before this the wipe
   * swept one folder and never looked in the other - so `share-pdf-file.ts`
   * promised "the wipe's own sweep is the second chance" for a path where
   * there was no sweep.
   */
  it("removes the printer folder too, where a failed move leaves a PDF", () => {
    deleteExportCache();

    expect(state.deleted).toContain(`file:///cache/${PRINT_DIRECTORY}`);
  });

  it('empties both folders, not one or the other', () => {
    deleteExportCache();

    expect(state.deleted).toHaveLength(2);
  });

  it('names the printer folder the printer actually uses', () => {
    // Capitalised, because `expo-print` passes the literal "Print".
    expect(PRINT_DIRECTORY).toBe('Print');
  });

  it('does nothing when there is nothing to remove', () => {
    state.exists = false;

    deleteExportCache();

    expect(state.deleted).toEqual([]);
  });

  it('lets a failure out, so the wipe can report itself partial', () => {
    state.failDelete = true;

    expect(() => deleteExportCache()).toThrow();
  });
});
