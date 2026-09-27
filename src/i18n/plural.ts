/**
 * Choosing between one and many.
 *
 * ## Why this is four lines and not a plural engine
 *
 * Both languages this app ships have exactly two plural categories and one
 * boundary: `n === 1`. Turkish arguably has fewer — "3 belirti", not
 * "3 belirtiler" — which the catalogues express by simply not calling this.
 *
 * The alternative was a library, and the current generation of them mandates
 * `Intl`. Hermes projects Android's own ICU, whose version varies by device, so
 * a plural engine would mean either shipping CLDR polyfills or accepting
 * output that differs between phones. For one boundary, in a health app, that
 * is a bad trade.
 *
 * ## Both branches are values, not templates
 *
 * The caller has already interpolated. That is what makes "1 symptom" and
 * "2 symptoms" expressible alongside Turkish's single form, and it is why the
 * English catalogue is free to have a different shape from the Turkish one
 * rather than being forced through the same placeholder.
 */
export function plural(count: number, one: string, other: string): string {
  return count === 1 ? one : other;
}
