import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { ExportFile } from '../application/build-export-files';

/**
 * Where an export is written before it is handed to the share sheet.
 *
 * The cache directory, not documents: the file exists to be passed to another
 * app and has no life of its own afterwards. Android is free to reclaim it, and
 * that is the right outcome - a folder quietly filling with copies of somebody's
 * health records is the opposite of what this feature is for.
 *
 * A subfolder rather than the cache root so the app's own exports are
 * distinguishable from anything else cached, and so clearing them is one call.
 */
const EXPORT_DIRECTORY = 'exports';

export type ShareOutcome = 'shared' | 'unavailable';

/**
 * Writes a file and offers it to whatever the person wants to send it to.
 *
 * The only place `expo-file-system` and `expo-sharing` are used. Everything
 * above this builds strings; this is the part that touches the device, which is
 * why it is the only file in the feature with no unit test - there is nothing
 * here but two library calls and the decision of which URI to hand over.
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

  await Sharing.shareAsync(target.uri, {
    mimeType: file.mimeType,
    dialogTitle: file.fileName,
  });

  return 'shared';
}
