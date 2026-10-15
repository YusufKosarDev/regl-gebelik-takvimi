import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { logEvent } from '@/shared/logging';

import type { ExportFile } from '../application/build-export-files';

import { EXPORT_DIRECTORY } from './export-cache';

export type ShareOutcome = 'shared' | 'unavailable';

/**
 * Writes a file and offers it to whatever the person wants to send it to.
 *
 * Written into the cache (`export-cache.ts` names the folder), handed to the
 * sheet, and deleted when the sheet is done — whatever the sheet came back
 * with. Waiting for the OS to reclaim the cache turned out to mean the file
 * staying indefinitely, through "delete all my data" included, and a
 * day-by-day CSV of somebody's records is the last file that should.
 *
 * ## Why the plain `file://` URI and not `contentUri`
 *
 * This was written the other way round first, because `File.contentUri` is
 * documented as "a content URI to the file that can be shared to external
 * applications", which sounds exactly like this case. On a device it fails with
 * `ERR_SHARING_INVALID_ARGS`.
 *
 * The reason is in the merged manifest: the two libraries register *different*
 * providers - `expo.modules.filesystem.FileSystemFileProvider` and
 * `expo.modules.sharing.SharingFileProvider`, on separate authorities.
 * `contentUri` is minted by the first; `shareAsync` validates against the
 * second and mints its own. So it wants the `file://` URI and does the
 * content-URI conversion itself, which is also why the app does not need a
 * FileProvider of its own.
 *
 * The SDK 57 documentation for `shareAsync` says only "local file URL" and does
 * not settle the question either way, which is why this was checked on a device
 * rather than reasoned about.
 *
 * ## Why the old file is removed first
 *
 * Two exports on the same day produce the same name. Writing over a file that
 * another app may still be reading is worse than replacing it outright, and
 * `create()` refuses an existing path.
 *
 * Returns `'unavailable'` rather than throwing when the device has no share
 * sheet - that is a fact about the device, not a failure, and the screen says
 * something different about it.
 */
export async function shareTextFile(file: ExportFile): Promise<ShareOutcome> {
  if (!(await Sharing.isAvailableAsync())) {
    return 'unavailable';
  }

  const directory = new Directory(Paths.cache, EXPORT_DIRECTORY);

  if (!directory.exists) {
    directory.create();
  }

  const target = new File(directory, file.fileName);

  if (target.exists) {
    target.delete();
  }

  target.create();
  target.write(file.contents);

  try {
    await Sharing.shareAsync(target.uri, {
      mimeType: file.mimeType,
      dialogTitle: file.fileName,
    });
  } finally {
    // The receiving app has taken what it is going to take by the time the
    // sheet resolves. A file that will not delete is logged by name — the
    // wipe's own sweep is the second chance — and never fails the share that
    // already happened.
    try {
      target.delete();
    } catch (error: unknown) {
      logEvent('data export failed', error);
    }
  }

  return 'shared';
}
