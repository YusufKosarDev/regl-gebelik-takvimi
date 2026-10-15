import { EXPORT_DIRECTORY, deleteExportCache } from '../export-cache';

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

    expect(state.deleted).toEqual([`file:///cache/${EXPORT_DIRECTORY}`]);
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
