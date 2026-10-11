/**
 * How tall the hero is, given the space the scroll view actually has.
 *
 * ## Why this is a function and not two lines in the screen
 *
 * It was two lines in the screen, and they were wrong for three stages
 * running. The hero is meant to be exactly one viewport so that nothing below
 * it is visible until somebody scrolls - but it sits inside a content
 * container that opens with `topInset` of padding, and one whole viewport
 * plus that padding does not fit in one viewport. The overhang was the
 * padding, exactly, and it fell on the last thing in the hero: the arc.
 *
 * It showed for one cycle day at each end of the month, because only the
 * selected dot at the very ends of the parabola hangs low enough to be cut.
 * One of those is day 1 - the day a period has just been logged, and the day
 * the app is most likely to be opened.
 *
 * The first attempt at a fix was a constant at the foot of the hero, read off
 * a screenshot. It took the overhang from sixty-four points to sixteen, which
 * looked right with a mid-cycle day selected and was still wrong. A number
 * chosen by eye cannot be checked by anything; this can.
 */
export const HERO_MIN_HEIGHT = 420;

export function heroHeightFor({
  viewport,
  topInset,
  isPregnancyView,
}: {
  /** The scroll view's measured height. Zero before it has been laid out. */
  readonly viewport: number;
  /** The padding the scroll content puts above the hero. */
  readonly topInset: number;
  readonly isPregnancyView: boolean;
}): number | undefined {
  // Undefined rather than a guess: the hero is content-sized for one frame,
  // which nobody sees, where a wrong fixed height is a control nobody can
  // reach. The pregnancy view has no hero at all - holding the height there
  // gave it an empty screen above its own content.
  if (isPregnancyView || viewport <= 0) {
    return undefined;
  }

  return Math.max(viewport - topInset, HERO_MIN_HEIGHT);
}
