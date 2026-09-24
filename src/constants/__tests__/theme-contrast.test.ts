import { Brand, Colors } from '@/constants/theme';

/**
 * The accent is the one colour in this app that carries text, and it is the
 * easiest thing to break by eye: every lavender looks fine next to another
 * lavender. These hold the ratios rather than the hex values, so the palette
 * can still be retuned - it just cannot be retuned below WCAG AA.
 */

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };

  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.1 contrast ratio, whichever way round the two are given. */
function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);

  return (lighter + 0.05) / (darker + 0.05);
}

/** 4.5:1 for text, 3:1 for a boundary or an icon. */
const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;

describe('the contrast formula itself', () => {
  it('agrees with the two ends of the scale', () => {
    // Without this, every assertion below could be passing on a broken formula.
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 2);
    expect(contrast('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  });

  it('does not care which way round the pair is given', () => {
    expect(contrast('#7160AB', '#ffffff')).toBeCloseTo(contrast('#ffffff', '#7160AB'), 10);
  });
});

describe.each([
  ['light', Colors.light],
  ['dark', Colors.dark],
] as const)('%s mode', (_mode, palette) => {
  it('can put a label on a primary button', () => {
    expect(contrast(palette.primary, palette.onPrimary)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('can use the accent as link text on the screen', () => {
    expect(contrast(palette.primary, palette.background)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('can use the accent as link text on a card', () => {
    // The About screen's rows sit on the screen, but a card is one refactor
    // away and the accent should survive it.
    expect(contrast(palette.primary, palette.backgroundElement)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('shows a filled button against what is behind it', () => {
    // 1.4.11: the button has to be findable, not only readable.
    expect(contrast(palette.primary, palette.background)).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });

  it('shows which way a switch is set', () => {
    // The thumb against the track is what says on or off.
    expect(contrast(palette.switchThumbOn, palette.switchTrackOn)).toBeGreaterThanOrEqual(
      AA_NON_TEXT
    );
  });

  it('keeps a switch findable on the card it sits on', () => {
    // Android draws the thumb slightly proud of the track, so at least one of
    // the two has to hold against the card behind it. A dark thumb on a dark
    // card turned the control into a lavender half-pill once already.
    const visible = Math.max(
      contrast(palette.switchThumbOn, palette.backgroundElement),
      contrast(palette.switchTrackOn, palette.backgroundElement)
    );

    expect(visible).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });

  it('keeps ordinary text readable, which the accent must not quietly change', () => {
    expect(contrast(palette.text, palette.background)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(palette.textSecondary, palette.background)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

describe('the brand palette', () => {
  it('keeps the artwork colour out of the interface', () => {
    // Brand.main is the icon's background, not the accent. It reads at 3.72:1
    // on white. If somebody ever sets primary to it, this is the failure that
    // explains why not.
    expect(contrast(Brand.main, '#ffffff')).toBeLessThan(AA_TEXT);
    expect(Colors.light.primary).not.toBe(Brand.main);
    expect(Colors.dark.primary).not.toBe(Brand.main);
  });

  it('carries the mark against the icon background', () => {
    // The crescent and its disc both sit on the gradient, which runs between
    // main and deep. The mark has to hold against the lighter end.
    expect(contrast(Brand.light, Brand.main)).toBeGreaterThanOrEqual(AA_NON_TEXT);
    expect(contrast(Brand.mid, Brand.main)).toBeGreaterThan(1.3);
  });

  it('is what the splash screens are built from', () => {
    // Light splash: Brand.deep on Brand.light. Dark splash: the reverse.
    expect(contrast(Brand.deep, Brand.light)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});
