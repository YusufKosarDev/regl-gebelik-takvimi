/**
 * Where each day sits on the arc, and which day a finger is on.
 *
 * ## One module because they have to agree
 *
 * The first version had the component placing dots around a circle with
 * `sin`/`cos` while this file turned an x into a day with a linear ratio. Two
 * different mappings for one arc: the dot a finger landed on was not the day it
 * selected, and nothing would have told us except doing it on a phone.
 *
 * Both now come from the same `t`, so the dot under the finger is the day that
 * is chosen, by construction rather than by being careful.
 *
 * ## Why a parabola and not a circle
 *
 * A circular arc wide enough to hold 28 days was 310dp either side of centre on
 * a 393dp screen and 166dp tall in a 72dp box - two thirds of it was outside
 * the container and clipped away. Fitting a circle inside a short, wide box
 * means an enormous radius and a span so narrow the curve disappears.
 *
 * A parabola is defined by the box instead: `x` spans the track, `y` is zero in
 * the middle and `sag` at the ends, and nothing can fall outside either. The
 * curve is chosen by how it looks rather than by what a radius forces.
 *
 * ## The curve says something
 *
 * The high point is the middle of the cycle and the low points are its ends,
 * which is where the sun is at midday and at night. The field already draws the
 * cycle as one day; the arc now draws the same day as a path across the sky,
 * and the selected dot rides it.
 */

/** How much of the width the track spans, centred. */
export const ARC_TRACK_FRACTION = 0.86;

/** Where one day sits, in points from the left and top of the arc's box. */
export type ArcPoint = {
  readonly left: number;
  readonly top: number;
};

/**
 * How far along the track a day sits, 0 to 1.
 *
 * One day is placed in the middle rather than at the left end: a single dot has
 * no "along" to be.
 */
function fractionFor(index: number, dayCount: number): number {
  return dayCount <= 1 ? 0.5 : index / (dayCount - 1);
}

/** Every day's position, in order. */
export function arcPoints({
  width,
  dayCount,
  sag,
  trackFraction = ARC_TRACK_FRACTION,
}: {
  readonly width: number;
  readonly dayCount: number;
  /** How far the ends hang below the middle. */
  readonly sag: number;
  readonly trackFraction?: number;
}): readonly ArcPoint[] {
  const usable = width * trackFraction;
  const start = (width - usable) / 2;

  return Array.from({ length: Math.max(dayCount, 0) }, (_unused, index) => {
    const t = fractionFor(index, dayCount);
    const fromCentre = t * 2 - 1;

    return {
      left: start + usable * t,
      top: sag * fromCentre * fromCentre,
    };
  });
}

/**
 * Which day of the cycle a finger is on.
 *
 * ## Why horizontal position and not angle
 *
 * The finger travels left to right and the curve is shallow, so x is
 * unambiguous. Measuring an angle from a centre would make the ends of the arc
 * harder to reach than the middle - the same travel covers more days out there
 * - and the ends are day one and the last day, which are the two somebody is
 * most likely to be reaching for.
 *
 * ## The track is narrower than the screen
 *
 * A finger cannot comfortably reach the last pixel of either edge, so the track
 * is inset and anything past it holds at the first or last day. Dragging off
 * the end of the arc stops there rather than wrapping.
 */
export function arcDayAt({
  x,
  width,
  dayCount,
  trackFraction = ARC_TRACK_FRACTION,
}: {
  /** Where the finger is, in points from the left edge of the arc. */
  readonly x: number;
  readonly width: number;
  readonly dayCount: number;
  readonly trackFraction?: number;
}): number | null {
  if (dayCount <= 0) {
    return null;
  }

  if (dayCount === 1) {
    return 0;
  }

  const usable = width * trackFraction;
  const start = (width - usable) / 2;
  const travelled = usable === 0 ? 0 : (x - start) / usable;
  const clamped = Math.min(1, Math.max(0, travelled));

  return Math.round(clamped * (dayCount - 1));
}
