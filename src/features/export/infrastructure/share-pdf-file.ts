import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { logEvent } from '@/shared/logging';

import type { ExportPdfDocument } from '../application/build-export-files';
import { A4_HEIGHT_POINTS, A4_WIDTH_POINTS } from '../presentation/export-pdf';

import { EXPORT_DIRECTORY } from './export-cache';
import type { ShareOutcome } from './share-file';

/** What a receiving app needs to know it has been handed a document. */
const PDF_MIME_TYPE = 'application/pdf';

/**
 * Prints the document and offers it to whatever the person wants to send it to.
 *
 * ## Why the printed file is moved before anything else touches it
 *
 * `printToFileAsync` saves "to app's cache directory" and takes no destination.
 * `deleteExportCache()` empties `cache/exports` and `cache/Print` - and
 * `wipe-local-data.ts` calls that and nothing else. So a PDF left where the
 * printer puts it sits *beside* the folder the wipe sweeps, and "delete all my
 * data" would leave behind the most readable copy of somebody's records the app
 * can produce. `export-cache.ts` records why that is the thing to avoid: cache
 * that the OS was trusted to reclaim turned out to stay indefinitely.
 *
 * The move is therefore not tidiness. It is the only reason the wipe reaches
 * this file at all, and `share-pdf-file.test.ts` asserts the path the sheet is
 * handed rather than merely that a move happened.
 *
 * ## One reference, two possible locations
 *
 * `File.move` updates the instance's own `uri` - "it may change as a result of
 * calling some methods such as `move`" - so `printed` points at the printer's
 * folder before the move and at `exports/` after it. That is what lets a single
 * `finally` clean up whichever place the file actually ended in, including the
 * case where the move itself failed and the PDF is still sitting outside.
 *
 * ## Why A4 comes from here and the margins do not
 *
 * The paper is a print option (`export-pdf.ts` records the measurement that
 * settled it); the margins are CSS, which is what the SDK's Android note says
 * `@page` is for. Nothing in this file knows how the page looks.
 *
 * Returns `'unavailable'` rather than throwing when the device has no share
 * sheet, and prints nothing in that case - the same rule `share-file.ts` keeps,
 * because a file written for a share that cannot happen is a file nobody asked
 * for.
 */
export async function sharePdfFile(document: ExportPdfDocument): Promise<ShareOutcome> {
  if (!(await Sharing.isAvailableAsync())) {
    return 'unavailable';
  }

  const { uri } = await Print.printToFileAsync({
    html: document.html,
    width: A4_WIDTH_POINTS,
    height: A4_HEIGHT_POINTS,
  });

  const printed = new File(uri);

  try {
    const directory = new Directory(Paths.cache, EXPORT_DIRECTORY);

    if (!directory.exists) {
      directory.create();
    }

    const target = new File(directory, document.fileName);

    // Two exports on the same day produce the same name, and another app may
    // still be reading the first. Replacing it outright beats writing over it.
    if (target.exists) {
      target.delete();
    }

    await printed.move(target);

    await Sharing.shareAsync(printed.uri, {
      mimeType: PDF_MIME_TYPE,
      dialogTitle: document.fileName,
    });
  } finally {
    // The receiving app has taken what it is going to take by the time the
    // sheet resolves. A file that will not delete is logged by name and never
    // fails the share that already happened.
    //
    // The second chance is the wipe's sweep, and that sentence used to be
    // written here while being true of only one of the two places `printed`
    // can be. After a successful move it is in `exports`, which the wipe
    // emptied. After a failed move it is still in the printer's own folder,
    // which the wipe did not look in at all - so the promise was missing in
    // exactly the path this `finally` exists for. `deleteExportCache()` now
    // empties `Print` as well, which is what makes it true.
    try {
      printed.delete();
    } catch (error: unknown) {
      logEvent('data export failed', error);
    }
  }

  return 'shared';
}
