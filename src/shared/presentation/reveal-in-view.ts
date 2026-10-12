/**
 * Where to scroll so a panel that just opened can be used, or `null`.
 *
 * ## The defect this is the decision for
 *
 * Six confirmations in this app open in place: pressing the button swaps it
 * for a panel below. Nothing scrolls, so on a screen that was already near the
 * bottom the panel opens off-screen. Found on a device on the two destructive
 * ones - "Delete my account" and "Delete all my data" - where what appears is
 * the heading "You are about to delete your account" and nothing else. The
 * password field, the confirm and the cancel are all below the fold, so
 * somebody has been told a deletion is under way and shown no way to go on and
 * no way to retreat.
 *
 * ## It aligns the bottom, not the top
 *
 * The controls are at the end of a panel and the heading is at the start, so
 * the bottom edge is the one that has to be reachable. A panel taller than the
 * viewport therefore opens with its heading above the top - which is the right
 * trade, because a confirm and a cancel nobody can reach is the defect and a
 * heading nobody can see is a paragraph they already read on the button.
 *
 * ## Nothing moves when it already fits
 *
 * `null` means do not scroll. A screen that jumps when it did not need to is a
 * new defect, and the common case at the default font size is a panel that was
 * always fully visible. The two states that do move are the panel hanging
 * below the fold and - rarer, from scrolling up after opening one - the panel
 * sitting above the top of the viewport.
 *
 * ## The bar is not part of the viewport
 *
 * On the two tab screens the bar floats over the content rather than sitting
 * under it, so the bottom of the viewport is not the bottom of what can be
 * read. `bottomInset` is what the caller reserves for it - `tabBarInsetFor` at
 * the current font scale - and is zero on the pushed screens, which have no
 * bar.
 *
 * Pure: no clock, no refs, no platform. Every number arrives measured.
 */
export type RevealInput = {
  /** The panel's top edge, in the scroll view's content coordinates. */
  readonly panelTop: number;
  readonly panelHeight: number;
  /** The scroll view's own height on screen. */
  readonly viewportHeight: number;
  /** How far the content is currently scrolled. */
  readonly scrollOffset: number;
  /** What floats over the bottom of the viewport and hides content under it. */
  readonly bottomInset: number;
};

export function scrollOffsetToReveal(input: RevealInput): number | null {
  const { panelTop, panelHeight, viewportHeight, scrollOffset, bottomInset } = input;

  // A viewport that has not been measured yet, or one the bar would swallow
  // whole. Either way there is no offset that helps and guessing one would
  // move the screen for nothing.
  const readableHeight = viewportHeight - bottomInset;

  if (readableHeight <= 0) {
    return null;
  }

  const panelBottom = panelTop + panelHeight;
  const readableTop = scrollOffset;
  const readableBottom = scrollOffset + readableHeight;

  // Already usable. The whole panel is between the top of the viewport and the
  // top of whatever floats over the bottom of it.
  if (panelTop >= readableTop && panelBottom <= readableBottom) {
    return null;
  }

  // Above the viewport: bring its top down to the top edge. This is the case
  // where somebody opened a panel and then scrolled away from it.
  if (panelTop < readableTop && panelBottom <= readableBottom) {
    return Math.max(0, panelTop);
  }

  // Below the fold, which is the defect. Put the panel's bottom edge on the
  // top edge of the bar, so the confirm and the cancel are both clear of it.
  // Never past the start of the content: a short panel near the top of a long
  // screen must not pull the screen upwards past its own beginning.
  return Math.max(0, panelBottom - readableHeight);
}
