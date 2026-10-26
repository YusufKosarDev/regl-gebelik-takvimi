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
 * The folder the printer writes into, which is not this app's choice.
 *
 * `printToFileAsync` takes no destination. `expo-print`'s `FileUtils.kt`
 * calls `generateOutputPath(context.cacheDir, "Print", ".pdf")`, so the PDF
 * lands in `<cache>/Print` - beside `exports`, not inside it.
 * `share-pdf-file.ts` moves it across immediately, and the name is here
 * because immediately is not always.
 *
 * Capitalised because that is the literal the module passes.
 */
export const PRINT_DIRECTORY = 'Print';

/**
 * Empties the export folder.
 *
 * Empties the two folders an export can leave a file in.
 *
 * The CSV written for a share is somebody's day-by-day records in plain
 * text. "Cache, so the OS may reclaim it" turned out to mean "stays
 * indefinitely on most phones", so nothing leans on the OS any more: the
 * share deletes its own file when the sheet is done, and the wipe calls this
 * so "delete all my data" cannot leave the most readable copy behind.
 *
 * Two folders, not one. `exports` is this app's, and `Print` is the
 * printer's: `printToFileAsync` writes there and `share-pdf-file.ts` moves
 * the PDF out straight away. When that move fails the PDF stays in `Print`,
 * and when the delete that follows also fails it stays there for good - a
 * typeset page of somebody's records, in the one cache folder the wipe used
 * not to look in. The window is narrow and the thing left behind is the most
 * readable copy the app can produce.
 *
 * Throws on a folder that will not delete, deliberately: the wipe runs it as
 * a best-effort step and a swallowed failure here would let it report a
 * clean wipe over a cache still holding the records.
 */
export function deleteExportCache(): void {
  for (const name of [EXPORT_DIRECTORY, PRINT_DIRECTORY]) {
    const directory = new Directory(Paths.cache, name);

    if (directory.exists) {
      directory.delete();
    }
  }
}
