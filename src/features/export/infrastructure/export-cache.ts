import { Directory, Paths } from 'expo-file-system';

/**
 * The folder the share sheet is fed from.
 *
 * A subfolder of the cache rather than the cache root, so the app's own
 * exports are distinguishable from anything else cached and emptying them is
 * one call — this one.
 */
export const EXPORT_DIRECTORY = 'exports';

/**
 * Empties the export folder.
 *
 * The CSV written for a share is somebody's day-by-day records in plain
 * text. "Cache, so the OS may reclaim it" turned out to mean "stays
 * indefinitely on most phones", so nothing leans on the OS any more: the
 * share deletes its own file when the sheet is done, and the wipe calls this
 * so "delete all my data" cannot leave the most readable copy behind.
 *
 * Throws on a folder that will not delete, deliberately: the wipe runs it as
 * a best-effort step and a swallowed failure here would let it report a
 * clean wipe over a cache still holding the records.
 */
export function deleteExportCache(): void {
  const directory = new Directory(Paths.cache, EXPORT_DIRECTORY);

  if (directory.exists) {
    directory.delete();
  }
}
