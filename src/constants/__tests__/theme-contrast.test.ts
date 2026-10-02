import { Brand, Colors, CyclePhaseColors } from '@/constants/theme';

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

  it('lets a card read as a card', () => {
    // Not a WCAG floor - a card is not text and not a control boundary, so
    // nothing above catches this. It is here because lifting the dark page off
    // pure black nearly cost it: the plum surface on the plum page read at
    // 1.135 where the old grey on black read at 1.320, and a palette change
    // that flattens every card into the page is a regression wearing a new
    // colour. Both surfaces were lifted instead. Light mode is the looser of
    // the two at 1.137, so the floor is set under it rather than at it.
    const SURFACE_SEPARATION = 1.1;

    expect(contrast(palette.backgroundElement, palette.background)).toBeGreaterThan(
      SURFACE_SEPARATION
    );
    expect(contrast(palette.backgroundSelected, palette.backgroundElement)).toBeGreaterThan(
      SURFACE_SEPARATION
    );
  });

  it('draws a primary link in the accent rather than in a colour of its own', () => {
    // `ThemedText` used to hardcode '#3c87f7' for the linkPrimary type: a blue
    // from no palette, identical in both schemes. The ratios it needs are the
    // accent's own, asserted above; this is the reminder of why they have to
    // hold on both the page and a card.
    expect(contrast(palette.primary, palette.background)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(palette.primary, palette.backgroundElement)).toBeGreaterThanOrEqual(AA_TEXT);
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

describe('the cycle phase palette', () => {
  /** The four phases, as the pair of tokens each one owns. */
  const PHASES = ['menstrual', 'follicular', 'ovulatory', 'luteal'] as const;

  it('carries the day number on every soft fill', () => {
    // A calendar square is a fill with a date sitting on it. The fill is light
    // for that reason and not for a decorative one, which is easy to forget
    // while picking a prettier colour.
    for (const phase of PHASES) {
      const light = CyclePhaseColors.light[`${phase}Soft`];
      const dark = CyclePhaseColors.dark[`${phase}Soft`];

      expect([phase, contrast(Colors.light.text, light) >= AA_TEXT]).toEqual([phase, true]);
      expect([phase, contrast(Colors.dark.text, dark) >= AA_TEXT]).toEqual([phase, true]);
    }
  });

  it('shows every accent against the page it is drawn on', () => {
    // Dots, marks and outlines are graphics rather than text, so three to one.
    // The teal was darkened twice to clear this; the first two candidates read
    // beautifully and failed.
    for (const phase of PHASES) {
      const light = CyclePhaseColors.light[`${phase}Accent`];
      const dark = CyclePhaseColors.dark[`${phase}Accent`];

      expect([phase, contrast(light, Colors.light.background) >= AA_NON_TEXT]).toEqual([
        phase,
        true,
      ]);
      expect([phase, contrast(dark, Colors.dark.background) >= AA_NON_TEXT]).toEqual([
        phase,
        true,
      ]);
    }
  });

  it('shows every accent against a soft fill of the same phase', () => {
    // A mark is drawn inside the square it belongs to, so it has to hold
    // against that square and not only against the page.
    for (const phase of PHASES) {
      expect([
        phase,
        contrast(
          CyclePhaseColors.light[`${phase}Accent`],
          CyclePhaseColors.light[`${phase}Soft`]
        ) >= AA_NON_TEXT,
      ]).toEqual([phase, true]);
    }
  });

  it('tells the four phases apart by lightness, not only by hue', () => {
    // Nobody should have to rely on colour vision to read this calendar. The
    // letters and shapes are the first guarantee of that; this is the second.
    //
    // Both schemes, because the first pass only held light mode and the dark
    // accents it let through sat inside 0.002 of each other - a dark calendar
    // that was readable by hue alone, which is the thing this test exists to
    // prevent. Light mode is the harder half: an accent also has to clear 3:1
    // on white, which caps it around 0.30 and leaves all four to fit in that
    // band. Dark mode has no such ceiling and spreads twice as far.
    for (const scheme of ['light', 'dark'] as const) {
      const lightnesses = PHASES.map((phase) =>
        luminance(CyclePhaseColors[scheme][`${phase}Accent`])
      );

      for (let i = 0; i < lightnesses.length; i += 1) {
        for (let j = i + 1; j < lightnesses.length; j += 1) {
          expect([scheme, Math.abs(lightnesses[i] - lightnesses[j]) > 0.01]).toEqual([
            scheme,
            true,
          ]);
        }
      }
    }
  });

  it('keeps the longest phase in the brand family', () => {
    // The luteal phase is the longest one, so it gets the colour the app
    // already wears - but not `Brand.main` itself, which is light enough to
    // collide with the teal in the test above. It sits between the interface
    // accent and the artwork colour, and this says so in numbers rather than
    // in a comment that can go stale: a later retune that wanders out of the
    // family, or back onto `Brand.main`, fails here.
    const luteal = luminance(CyclePhaseColors.light.lutealAccent);

    expect(luteal).toBeGreaterThan(luminance(Colors.light.primary));
    expect(luteal).toBeLessThan(luminance(Brand.main));
  });
});
