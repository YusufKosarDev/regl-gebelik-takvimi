/**
 * Says what a value is without saying what it holds.
 *
 * Used where a message has to explain that something was the wrong shape —
 * a corrupt row, a refused argument — without putting the value in the text.
 * The values this app handles are period dates, a due date, an avatar and the
 * messages built from them, and every one of those is health data or close
 * enough to it. A message that quotes one can end up in a crash report, a log
 * file or a screenshot of a red box, so nothing quotes one.
 *
 * What comes back is the kind of thing it was, which is all a reader needs to
 * tell "the column held a number" from "the column held nothing".
 */
export function describeValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return 'an array';
  }

  switch (typeof value) {
    case 'undefined':
      return 'undefined';
    case 'string':
      // Not the text, and not its length either: the length of a support
      // message or an avatar id narrows down which one it was.
      return 'text';
    case 'number':
      return 'a number';
    case 'boolean':
      return 'a boolean';
    case 'bigint':
      return 'a bigint';
    case 'symbol':
      return 'a symbol';
    case 'function':
      return 'a function';
    default:
      return 'an object';
  }
}
