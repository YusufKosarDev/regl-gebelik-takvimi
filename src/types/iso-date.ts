declare const isoDateBrand: unique symbol;

/**
 * A calendar date in `YYYY-MM-DD` form, with no time and no timezone.
 *
 * The brand is compile-time only: values must be produced by `toISODate` or
 * `formatLocalDate` so an arbitrary string cannot silently flow into date math.
 */
export type ISODate = string & { readonly [isoDateBrand]: true };
