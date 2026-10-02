import { FONT_ASSETS, fontFamilyFor } from '../fonts';
import { TEXT_SCALE, type TextType } from '../typography';

/**
 * Which font file a weight resolves to.
 *
 * ## Why this is worth a test
 *
 * Android does not synthesise across separately registered font files. Asking
 * for `fontWeight: 700` from a family that only loaded its medium gets a faked
 * bold or none at all, and the difference is invisible in a diff and obvious on
 * a phone. These assertions are the thing that notices a weight nobody loaded.
 */

describe('resolving a file', () => {
  it('gives the serif for a heading weight', () => {
    expect(fontFamilyFor('serif', 600)).toBe('Fraunces_600SemiBold');
    expect(fontFamilyFor('serif', 700)).toBe('Fraunces_700Bold');
  });

  it('gives the sans across the weights the app actually uses', () => {
    expect(fontFamilyFor('sans', 400)).toBe('Figtree_400Regular');
    expect(fontFamilyFor('sans', 500)).toBe('Figtree_500Medium');
    expect(fontFamilyFor('sans', 600)).toBe('Figtree_600SemiBold');
    expect(fontFamilyFor('sans', 700)).toBe('Figtree_700Bold');
  });

  it('reads a weight written as a string', () => {
    // Screen stylesheets write `fontWeight: '600'` as often as `600`.
    expect(fontFamilyFor('sans', '700')).toBe('Figtree_700Bold');
  });

  it('falls back to the system monospace for code', () => {
    // `code` has always been set in the platform's own monospace, and a code
    // sample should stay in one.
    expect(fontFamilyFor('mono', 700)).not.toMatch(/Figtree|Fraunces/);
  });
});

describe('weights nobody loaded', () => {
  it('uses the nearest file rather than nothing', () => {
    // A missing family name on Android does not fall back gracefully - it
    // renders in the system font, which next to Figtree looks like a bug.
    expect(fontFamilyFor('sans', 100)).toBe('Figtree_400Regular');
    expect(fontFamilyFor('sans', 900)).toBe('Figtree_700Bold');
    expect(fontFamilyFor('serif', 300)).toBe('Fraunces_600SemiBold');
  });

  it('treats an absent weight as regular', () => {
    // `link` and `linkPrimary` name no weight and never have. Giving them a
    // typeface should not also make them heavier.
    expect(fontFamilyFor('sans', undefined)).toBe('Figtree_400Regular');
  });

  it('treats a word weight as regular rather than breaking', () => {
    // 'bold' and 'normal' are legal in React Native and `Number()` makes them
    // NaN. Answering with the regular file is wrong-ish; answering with
    // `undefined` would silently drop the typeface.
    expect(fontFamilyFor('sans', 'bold')).toBe('Figtree_400Regular');
  });
});

describe('every weight the scale asks for is loaded', () => {
  it('has a file for each entry in the type scale', () => {
    // The assertion that actually prevents the bug: add a type at a weight
    // nobody loaded and this says so, rather than the phone saying it.
    const loaded = new Set(Object.keys(FONT_ASSETS));

    for (const type of Object.keys(TEXT_SCALE) as TextType[]) {
      const scale = TEXT_SCALE[type];

      if (scale.role === 'mono') {
        continue;
      }

      const family = fontFamilyFor(scale.role, scale.fontWeight);

      expect([type, loaded.has(family as string)]).toEqual([type, true]);
    }
  });

  it('has a file for every weight a screen stylesheet writes', () => {
    // Swept from `src/` when this was written: 500, 600 and 700. A screen that
    // starts writing 800 would render in the system font without this.
    const loaded = new Set(Object.keys(FONT_ASSETS));

    for (const weight of [500, 600, 700] as const) {
      expect([weight, loaded.has(fontFamilyFor('sans', weight) as string)]).toEqual([
        weight,
        true,
      ]);
    }
  });
});
