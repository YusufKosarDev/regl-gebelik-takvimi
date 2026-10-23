import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  AVATAR_BACKGROUNDS,
  AVATAR_HAIR_COLORS,
  AVATAR_OUTFITS,
  AVATAR_SKIN_TONES,
} from '@/features/avatar/data/avatar-catalog';
import type { AvatarConfig } from '@/features/avatar/domain/avatar-config';
import {
  AVATAR_ACCESSORY_GOLD,
  resolveAvatarVisuals,
} from '@/features/avatar/presentation/avatar-visuals';

/**
 * Every colour the widget draws is the colour the app draws.
 *
 * ## Why this has to be a test
 *
 * The widget renders in the launcher's process, in Kotlin, so
 * `WidgetAvatarLook.kt` carries a second copy of the whole palette:
 * `SKIN_COLORS`, `HAIR_COLORS`, `OUTFIT_COLORS` and the accessory metal, all
 * written out again as `0xFFRRGGBB`. Nothing but a comment said the two were
 * copies of each other, and nothing at all checked it.
 *
 * They had already drifted. `skin-tone-1` was `#F7DFCE` here and `0xFFF6DFCE`
 * there — one step of red, invisible on a phone, and the thing worth noticing
 * about it is not the step but that it happened silently. The next one need
 * not be invisible: a hand-copied hex is one keystroke from being a different
 * colour on somebody's home screen than in their app, with no error anywhere.
 *
 * ## What is compared
 *
 * The app's side is read through `resolveAvatarVisuals` rather than by
 * exporting the tables, so what is checked is what the renderer actually
 * resolves for each catalogue id — which is the thing the widget has to agree
 * with. The Kotlin side is parsed out of the source, the way
 * `widget-snapshot-native-contract.test.ts` reads it for the same reason:
 * there is no type checker between the two.
 *
 * Shapes are not compared and could not be. The widget deliberately draws from
 * a six-value enum where the app has six numbers per style, and
 * `widget-avatar-shape-coverage.test.ts` holds that boundary instead. Colour is
 * the half that is supposed to be identical.
 */

const NATIVE_LOOK = join(
  __dirname,
  '../../../../../modules/widget-snapshot-bridge/android/src/main/java/expo/modules/widgetsnapshotbridge/WidgetAvatarLook.kt'
);

const kotlin = readFileSync(NATIVE_LOOK, 'utf8');

/** `0xFFE2B84B` as `#E2B84B`, which is how the app writes the same colour. */
function toHex(literal: string): string {
  return `#${literal.slice(4).toUpperCase()}`;
}

/** One `"id" to 0xFFRRGGBB` map, as the Kotlin declares it. */
function singleColourMap(name: string): Readonly<Record<string, string>> {
  const block = new RegExp(`private val ${name} = mapOf\\(([\\s\\S]*?)\\n\\)`).exec(kotlin);

  if (block === null) {
    throw new Error(`${name} was not found in WidgetAvatarLook.kt.`);
  }

  const entries = [...block[1].matchAll(/"([^"]+)"\s+to\s+(0x[0-9A-Fa-f]{8})\.toInt\(\)/g)];

  return Object.fromEntries(entries.map((entry) => [entry[1], toHex(entry[2])]));
}

/** The skin map, whose values are a `(base to shade)` pair. */
function skinColourMap(): Readonly<Record<string, readonly [string, string]>> {
  const block = /private val SKIN_COLORS = mapOf\(([\s\S]*?)\n\)/.exec(kotlin);

  if (block === null) {
    throw new Error('SKIN_COLORS was not found in WidgetAvatarLook.kt.');
  }

  const entries = [
    ...block[1].matchAll(
      /"([^"]+)"\s+to\s+\((0x[0-9A-Fa-f]{8})\.toInt\(\)\s+to\s+(0x[0-9A-Fa-f]{8})\.toInt\(\)\)/g
    ),
  ];

  return Object.fromEntries(
    entries.map((entry) => [entry[1], [toHex(entry[2]), toHex(entry[3])] as const])
  );
}

function config(overrides: Partial<AvatarConfig> = {}): AvatarConfig {
  return {
    skinToneId: 'skin-tone-1',
    hairStyleId: 'short',
    hairColorId: 'black',
    outfitId: 't-shirt',
    ...overrides,
  };
}

describe('the widget draws the skin tones in the app colours', () => {
  const kotlinSkin = skinColourMap();

  it('found the map to read', () => {
    expect(Object.keys(kotlinSkin).length).toBeGreaterThan(0);
  });

  it('carries exactly the catalogue tones, no more and no fewer', () => {
    expect(Object.keys(kotlinSkin).sort()).toEqual(
      AVATAR_SKIN_TONES.map((tone) => tone.id).sort()
    );
  });

  it.each(AVATAR_SKIN_TONES.map((tone) => tone.id))('%s matches', (id) => {
    const { skin } = resolveAvatarVisuals(config({ skinToneId: id }));

    expect([id, kotlinSkin[id]]).toEqual([id, [skin.base, skin.shade]]);
  });
});

describe('the widget draws the hair colours in the app colours', () => {
  const kotlinHair = singleColourMap('HAIR_COLORS');

  it('carries exactly the catalogue colours', () => {
    expect(Object.keys(kotlinHair).sort()).toEqual(
      AVATAR_HAIR_COLORS.map((colour) => colour.id).sort()
    );
  });

  /**
   * The base only. The widget draws the hair as one shape and has no second
   * tone to put behind it, so `shade` has no counterpart there — which is a
   * difference in what is drawn, not a drift in what colour it is.
   */
  it.each(AVATAR_HAIR_COLORS.map((colour) => colour.id))('%s matches', (id) => {
    const { hair } = resolveAvatarVisuals(config({ hairColorId: id }));

    expect([id, kotlinHair[id]]).toEqual([id, hair.base]);
  });
});

describe('the widget draws the garments in the app colours', () => {
  const kotlinOutfit = singleColourMap('OUTFIT_COLORS');

  it('carries exactly the catalogue garments', () => {
    expect(Object.keys(kotlinOutfit).sort()).toEqual(
      AVATAR_OUTFITS.map((outfit) => outfit.id).sort()
    );
  });

  it.each(AVATAR_OUTFITS.map((outfit) => outfit.id))('%s matches', (id) => {
    const { outfit } = resolveAvatarVisuals(config({ outfitId: id }));

    expect([id, kotlinOutfit[id]]).toEqual([id, outfit.base]);
  });
});

describe('the accessory metal is one colour in both', () => {
  it('matches', () => {
    const declared = /const val WIDGET_ACCESSORY_COLOR: Int = (0x[0-9A-Fa-f]{8})\.toInt\(\)/.exec(
      kotlin
    );

    expect(declared).not.toBeNull();
    expect(toHex(declared![1])).toBe(AVATAR_ACCESSORY_GOLD.toUpperCase());
  });
});

describe('the widget draws the backdrops in the app colours', () => {
  const kotlinBackground = singleColourMap('BACKGROUND_COLORS');

  it('carries exactly the catalogue backdrops', () => {
    expect(Object.keys(kotlinBackground).sort()).toEqual(
      AVATAR_BACKGROUNDS.map((background) => background.id).sort()
    );
  });

  it.each(AVATAR_BACKGROUNDS.map((background) => background.id))('%s matches', (id) => {
    const { background } = resolveAvatarVisuals(config({ backgroundId: id }));

    expect([id, kotlinBackground[id]]).toEqual([id, background!.base]);
  });
});

/**
 * The expression is not in this file, and that is the point.
 *
 * It crosses the boundary — the widget reads `expressionId` — and nothing on
 * the widget varies with it, because a 12x3 mouth cannot hold the difference
 * between a smile and a calm line. There is no colour to compare, and the
 * Kotlin side pins the deliberate ignoring in `WidgetAvatarLookTest`.
 */
describe('the expression has no colour to drift', () => {
  it('is not a palette on either side', () => {
    expect(kotlin).not.toContain('EXPRESSION_COLORS');
  });
});
