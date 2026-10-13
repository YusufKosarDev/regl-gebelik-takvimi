/**
 * A zero-width space: a place the line may break, and nothing anybody sees.
 *
 * Not a hyphen and not a space. It adds a break opportunity and no glyph, no
 * width and no word.
 */
const BREAK_OPPORTUNITY = '\u200B';

/**
 * An email address with somewhere sensible to break, for showing on a screen.
 *
 * ## What it is for
 *
 * An address wider than its row has to wrap, and `@` is not a break
 * opportunity in Unicode's line-breaking rules, so Android breaks at whatever
 * punctuation happens to be in the domain. Measured on a device at the default
 * font size, in a row 870 points wide:
 *
 *   regl.wrap.test.1013@disposable
 *   -example.test
 *
 * The domain is cut in half and the half left behind opens with a hyphen,
 * which reads as part of the name it was severed from.
 *
 * ## Why not shorten it
 *
 * Truncating or ellipsising is what the export button's finding was about: an
 * address a person is checking is the one thing on that row they came to read,
 * and `regl.wrap...@dis…` answers nothing. The wrap stays; where it lands is
 * what changes.
 *
 * ## Only the visible string
 *
 * What a screen reader says is built separately, by `signedInAccountLabel`
 * from the raw address, so nothing invisible reaches it. The text is not
 * selectable either, so nothing invisible can be copied out of it.
 *
 * Pure, and total: an address with no `@`, or one that begins with it, comes
 * back unchanged rather than gaining a break in a place that means nothing.
 * The last `@` is the separator, because a local part may legally contain one
 * inside quotes.
 */
export function emailForDisplay(email: string): string {
  const separator = email.lastIndexOf('@');

  if (separator <= 0) {
    return email;
  }

  return `${email.slice(0, separator)}${BREAK_OPPORTUNITY}${email.slice(separator)}`;
}
