/**
 * Turning rows into comma-separated text.
 *
 * A format rule and nothing else: no language, no catalogue, no clock. The hard
 * part of CSV is not the commas, it is that a value can contain one - along with
 * a quote, a newline, or all three - and a file that gets this wrong is one that
 * opens in a spreadsheet looking almost right.
 */

/** What a value has to contain before it needs wrapping. */
const NEEDS_QUOTING = /[",\r\n]/;

/**
 * One value, quoted if it has to be.
 *
 * Quotes are doubled inside a quoted field, which is what RFC 4180 says and
 * what every spreadsheet expects. Values that need nothing are left bare, so a
 * file of plain words stays readable in a text editor.
 */
function escapeValue(value: string): string {
  return NEEDS_QUOTING.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/**
 * A header and its rows as CSV text.
 *
 * ## Line endings
 *
 * CRLF, because that is what RFC 4180 specifies and what Excel on Windows
 * expects; everything else reads it either way. The file this produces is meant
 * to be opened by a spreadsheet the person already has, not by this app.
 *
 * ## It does not check that the rows match the header
 *
 * A ragged row is a bug in whoever built the rows, and failing here would turn
 * it into an error at export time rather than where it happened. The builder
 * that feeds this has its own test for column counts.
 */
export function toCsv(
  header: readonly string[],
  rows: readonly (readonly string[])[]
): string {
  const lines = [header, ...rows].map((row) => row.map(escapeValue).join(','));

  return `${lines.join('\r\n')}\r\n`;
}
