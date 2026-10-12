import { scrollOffsetToReveal } from '../reveal-in-view';

/**
 * Where a panel that just opened has to be scrolled to, and when not to move.
 *
 * ## What is asserted and what is not
 *
 * This is the decision, not the scrolling. Every number here arrives measured
 * on a device, and nothing in Jest can tell you whether `measureLayout`
 * reported the right ones or whether `scrollTo` moved anything - so none of
 * that is pretended at. A test that asserted `scrollTo` had been called would
 * prove the call and not the outcome, and this project has already found six
 * green tests that proved nothing.
 *
 * What is checkable is the arithmetic that decides the destination, and the
 * one rule with the most ways to go wrong: when to stay still.
 *
 * The outcome - that the confirm and the cancel are reachable after a panel
 * opens, at the default font size and at 200% - is a device check, and is
 * written down as one.
 */

/** A panel comfortably inside a viewport with a tab bar over the bottom. */
const FITS = {
  panelTop: 100,
  panelHeight: 200,
  viewportHeight: 800,
  scrollOffset: 0,
  bottomInset: 48,
};

describe('a panel that is already usable', () => {
  it('does not move the screen', () => {
    expect(scrollOffsetToReveal(FITS)).toBeNull();
  });

  it('does not move when the panel ends exactly on the bar', () => {
    // The boundary in the direction that matters: one pixel further down is a
    // panel whose last row is under the bar.
    expect(
      scrollOffsetToReveal({ ...FITS, panelTop: 0, panelHeight: 800 - 48 })
    ).toBeNull();
  });

  it('moves when the panel ends one pixel under the bar', () => {
    expect(scrollOffsetToReveal({ ...FITS, panelTop: 0, panelHeight: 800 - 48 + 1 })).toBe(1);
  });

  it('does not move for a panel the bar would have hidden if the bar were ignored', () => {
    // The whole reason `bottomInset` is a parameter. Without it this panel
    // looks like it fits - it ends at 790 inside an 800 viewport - and its
    // last ten pixels are under the bar.
    const underTheBar = { ...FITS, panelTop: 500, panelHeight: 290 };

    expect(scrollOffsetToReveal({ ...underTheBar, bottomInset: 0 })).toBeNull();
    expect(scrollOffsetToReveal(underTheBar)).not.toBeNull();
  });
});

describe('a panel hanging below the fold', () => {
  it('puts its bottom edge on the top edge of the bar', () => {
    // Panel 600..900 in a viewport showing 0..752. Its bottom must land on
    // 752, so the content moves to 900 - 752.
    expect(
      scrollOffsetToReveal({ ...FITS, panelTop: 600, panelHeight: 300 })
    ).toBe(900 - (800 - 48));
  });

  it('shows the end of a panel taller than the screen, not its beginning', () => {
    // The controls are at the end. A panel of 1,200 in a readable 752 cannot
    // be shown whole, and the half worth showing is the one with the confirm
    // and the cancel in it.
    const offset = scrollOffsetToReveal({ ...FITS, panelTop: 0, panelHeight: 1200 });

    expect(offset).toBe(1200 - 752);

    // Stated as the property rather than the number: the panel's bottom is at
    // the bottom of what can be read.
    expect((offset ?? 0) + (800 - 48)).toBe(1200);
  });

  it('accounts for where the screen is already scrolled to', () => {
    // The same panel, reached from two different scroll positions, lands in
    // the same place - the destination is absolute, not a delta.
    const panel = { ...FITS, panelTop: 1000, panelHeight: 400 };

    expect(scrollOffsetToReveal({ ...panel, scrollOffset: 0 })).toBe(1400 - 752);
    expect(scrollOffsetToReveal({ ...panel, scrollOffset: 300 })).toBe(1400 - 752);
  });
});

describe('a panel above the top of the viewport', () => {
  it('brings its top back down to the top edge', () => {
    // Somebody opened a panel and scrolled past it.
    expect(
      scrollOffsetToReveal({ ...FITS, panelTop: 100, panelHeight: 200, scrollOffset: 500 })
    ).toBe(100);
  });

  it('never scrolls above the start of the content', () => {
    expect(
      scrollOffsetToReveal({ ...FITS, panelTop: -50, panelHeight: 100, scrollOffset: 200 })
    ).toBe(0);
  });
});

describe('measurements that have not arrived yet', () => {
  it('stays still when the viewport has no height', () => {
    // The first layout pass, before anything has been measured. Scrolling on a
    // guess here would be a jump nobody asked for.
    expect(scrollOffsetToReveal({ ...FITS, viewportHeight: 0 })).toBeNull();
  });

  it('stays still when the bar would cover the whole viewport', () => {
    expect(scrollOffsetToReveal({ ...FITS, viewportHeight: 40, bottomInset: 48 })).toBeNull();
  });
});

describe('at a large font setting', () => {
  it('reserves the room the bar actually takes, which grows with the text', () => {
    // `tabBarInsetFor` caps at 1.4, so the bar is 67 rather than 48 at 200%.
    // The same panel that fitted at the default size no longer does, and the
    // screen has to move for it.
    const atDefault = { ...FITS, panelTop: 400, panelHeight: 352, bottomInset: 48 };
    const atLargest = { ...atDefault, bottomInset: 48 * 1.4 };

    expect(scrollOffsetToReveal(atDefault)).toBeNull();
    expect(scrollOffsetToReveal(atLargest)).toBeGreaterThan(0);
  });
});
