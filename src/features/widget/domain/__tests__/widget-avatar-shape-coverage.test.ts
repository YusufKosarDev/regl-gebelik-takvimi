import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { AVATAR_HAIR_STYLES } from '@/features/avatar/data/avatar-catalog';

/**
 * Every hair style has a widget shape, and the ones that share it say so.
 *
 * ## Why the widget needs its own guard
 *
 * The widget is drawn in Kotlin, in the launcher's process, from a five-value
 * enum — `CLOSE`, `MID`, `LONG`, `FULL`, `KNOT`. That is deliberate and written
 * down in `WidgetAvatarLook.kt`: "How the hair sits, which is all a
 * widget-sized drawing can say about style." The app's own renderer works from
 * five numbers; the widget works from one word.
 *
 * Two things follow, and neither is visible to `tsc`:
 *
 * 1. A style with no entry in the Kotlin map falls back to `CLOSE`. Nothing
 *    breaks, nothing logs — somebody's long hair is simply cropped on their
 *    home screen, and the only way to find out is to add the widget and look.
 * 2. Styles *will* share an entry, because five words cannot carry what will
 *    soon be a dozen styles. That is fine, and it is a decision rather than an
 *    accident, so the collisions are listed here. A new style that silently
 *    joins an existing group fails until somebody writes down that it should.
 *
 * The Kotlin is read as text. There is no type checker between the two sides,
 * and `widget-snapshot-native-contract.test.ts` pins the field names the same
 * way for the same reason.
 */

const NATIVE_LOOK = join(
  __dirname,
  '../../../../../modules/widget-snapshot-bridge/android/src/main/java/expo/modules/widgetsnapshotbridge/WidgetAvatarLook.kt'
);

const kotlin = readFileSync(NATIVE_LOOK, 'utf8');

/**
 * The `HAIR_SHAPES` map, as the Kotlin declares it.
 *
 * Parsed rather than duplicated: a copy of the table here would be a second
 * place to edit and the first one to drift.
 */
function widgetHairShapes(): Readonly<Record<string, string>> {
  const block = /private val HAIR_SHAPES = mapOf\(([\s\S]*?)\n\)/.exec(kotlin);

  if (block === null) {
    throw new Error('HAIR_SHAPES was not found in WidgetAvatarLook.kt.');
  }

  const entries = [...block[1].matchAll(/"([^"]+)"\s+to\s+WidgetHairShape\.([A-Z_]+)/g)];

  return Object.fromEntries(entries.map((entry) => [entry[1], entry[2]]));
}

/**
 * The styles that knowingly draw as the same widget shape.
 *
 * Each group is a decision: at widget size these are not tellable apart, and
 * pretending otherwise would mean inventing a sixth and seventh enum entry that
 * the drawing cannot express.
 */
const DECLARED_COLLISIONS: readonly (readonly string[])[] = [
  // Both fall past the shoulders; the wave is a corner radius, and the widget
  // draws one rounded rectangle.
  ['long', 'wavy'],

  // All three coverings. They differ by how they are tied — close, draped over
  // a shoulder, knotted at the back — and none of that survives at launcher
  // size. What survives, and what matters, is cloth round the face instead of
  // hair. Mapping the knotted one to `KNOT` to keep its knot would draw it as
  // a bun, which is hair, and that is the one thing it must not read as.
  ['headscarf-draped', 'headscarf-knotted', 'headscarf-plain'],
];

describe('the widget can draw every hair style', () => {
  const shapes = widgetHairShapes();

  it('found the Kotlin map to read', () => {
    // A regex that matched nothing would make every case below vacuous. Only
    // that, deliberately: how many entries there should be is what the
    // per-style cases below answer, and asserting a count here made one
    // missing entry fail twice for one reason.
    expect(Object.keys(shapes).length).toBeGreaterThan(0);
  });

  it.each(AVATAR_HAIR_STYLES.map((style) => style.id))('%s has a widget shape', (id) => {
    // The id is in the assertion so a failure names the style it is about
    // rather than only saying `undefined`.
    expect([id, shapes[id] ?? 'missing']).not.toEqual([id, 'missing']);
  });

  it('only shares a shape where that was written down', () => {
    const byShape = new Map<string, string[]>();

    for (const style of AVATAR_HAIR_STYLES) {
      const shape = shapes[style.id];

      if (shape === undefined) {
        continue;
      }

      byShape.set(shape, [...(byShape.get(shape) ?? []), style.id]);
    }

    const found = [...byShape.values()]
      .filter((group) => group.length > 1)
      .map((group) => [...group].sort().join('+'))
      .sort();

    const declared = DECLARED_COLLISIONS.map((group) => [...group].sort().join('+')).sort();

    expect(found).toEqual(declared);
  });
});
