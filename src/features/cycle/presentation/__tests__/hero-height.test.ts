import { readFileSync } from 'fs';
import { join } from 'path';

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

/**
 * The floor is a floor, and the screen applies it as one.
 *
 * ## What this can and cannot see
 *
 * Nothing in Jest measures text, so whether the sentence fits inside one
 * viewport at 200% is not checkable here - that is a device measurement and it
 * is on the list as one. What is checkable is the thing that made the overflow
 * paint instead of scroll: the hero declaring an exact `height`, and
 * `sky-hero` asking for `flexBasis: 0` so its content never demanded room.
 *
 * Both are read out of the source, the way `no-raw-logging.test.ts` reads for
 * a `console.log`. A behavioural test would have been greener and emptier:
 * the element tree is identical either way and only the pixels differ, which
 * is exactly how this shipped.
 */
describe('the screen applies the floor as a floor', () => {
  const screenSource = readFileSync(
    join(__dirname, '..', '..', '..', '..', 'app', '(app)', '(tabs)', 'index.tsx'),
    'utf8'
  );
  const heroSource = readFileSync(
    join(__dirname, '..', '..', 'components', 'sky-hero.tsx'),
    'utf8'
  );

  it('gives the hero a minHeight', () => {
    expect(screenSource).toMatch(/minHeight:\s*heroHeight/);
  });

  it('never gives the hero an exact height again', () => {
    // The one-line regression. `height: heroHeight` pins the box, the content
    // overflows it at a large font size, and React Native paints the overflow
    // over the tab bar rather than growing the box.
    expect(screenSource).not.toMatch(/\bheight:\s*heroHeight/);
  });

  it.each(['root', 'centre'])(
    'lets the hero content ask for the room it needs (%s)',
    (block) => {
      // `flex: 1` is `flexBasis: 0`. With the floor in place but these two
      // still refusing to demand their own height, nothing would have changed.
      //
      // Only these two. `dateBlock` is `flex: 1` inside a row, where it
      // divides width rather than refusing height, and banning the shorthand
      // everywhere would have failed on it for no reason.
      const declaration = new RegExp(`\\b${block}:\\s*\\{[^}]*\\}`, 's');
      // Comments stripped first: the note explaining why `flex: 1` is wrong
      // contains the words `flex: 1`, and matched itself.
      const body = (declaration.exec(heroSource)?.[0] ?? '').replace(/\/\/[^\n]*/g, '');

      expect(body).not.toBe('');
      expect(body).toMatch(/flexBasis:\s*'auto'/);
      expect(body).not.toMatch(/flex:\s*1/);
    }
  );
});
