import { HERO_MIN_HEIGHT, heroHeightFor } from '../hero-height';

/**
 * The hero has to fit in the viewport, with the padding above it.
 *
 * This is the arithmetic that was wrong from the first stage of the sky work
 * to the fourth, and nothing could see it: the suite was green, the screen
 * looked right, and the defect appeared on exactly two days of the month.
 */

/** Measured on the device this was found on: 914.29 window, 51.81 + 24 inset. */
const VIEWPORT = 838.48;
const TOP_INSET = 64;

describe('the hero and the padding above it fit in one viewport', () => {
  it.each([
    ['a phone', 838.48, 64],
    ['a short screen', 600, 64],
    ['no padding at all', 838.48, 0],
    ['a tall tablet', 1180, 64],
  ])('%s', (_name, viewport, topInset) => {
    const height = heroHeightFor({ viewport, topInset, isPregnancyView: false });

    expect(height).not.toBeUndefined();
    expect((height as number) + topInset).toBeLessThanOrEqual(viewport);
  });

  it('leaves nothing of the next block showing', () => {
    // The whole point of the hero: a hero at 90% of the screen shows a slice
    // of what is underneath, which reads as the layout being broken rather
    // than as an invitation to scroll.
    const height = heroHeightFor({
      viewport: VIEWPORT,
      topInset: TOP_INSET,
      isPregnancyView: false,
    });

    expect(height).toBe(VIEWPORT - TOP_INSET);
  });
});

describe('when there is not enough room to be exact', () => {
  it('keeps a floor rather than collapsing', () => {
    // A very short viewport - a small phone in landscape, or a split screen.
    // Better a hero that scrolls than one squeezed to nothing.
    const height = heroHeightFor({ viewport: 300, topInset: 64, isPregnancyView: false });

    expect(height).toBe(HERO_MIN_HEIGHT);
  });
});

describe('before anything has been measured', () => {
  it('has no opinion', () => {
    // Content-sized for one frame is invisible. A fixed height guessed from
    // the window is a control nobody can reach.
    expect(heroHeightFor({ viewport: 0, topInset: 64, isPregnancyView: false })).toBeUndefined();
  });
});

describe('the pregnancy view', () => {
  it('has no hero to make room for', () => {
    // No cycle day, no phase, no arc. Holding the height there gave it a whole
    // empty screen above its own content, which had to be scrolled past.
    expect(
      heroHeightFor({ viewport: VIEWPORT, topInset: TOP_INSET, isPregnancyView: true })
    ).toBeUndefined();
  });
});
