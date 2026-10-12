import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/theme';

import { ThemedText } from '../themed-text';

/**
 * A caller that computes a colour and gets nothing falls back to the theme.
 *
 * ## The defect
 *
 * `ThemedText` puts the themed colour first in its `StyleSheet.flatten` and
 * the caller's `style` last, so a caller wins by naming its own colour. That
 * is deliberate. What was not deliberate is that `flatten` keeps a key whose
 * value is `undefined`: `{ color: undefined }` did not fall through to the
 * theme, it overwrote it, and React Native drew the platform default - black.
 *
 * `cycle-calendar-legend.tsx` did exactly that. `swatchMarkerColour` returned
 * `undefined` for the predicted-period row and the result was spread into the
 * style array. On a light page black looked deliberate. On a dark page it was
 * black on near-black and the mark was invisible.
 *
 * ## Why no test saw it
 *
 * There was nothing wrong to see. The element tree was correct, the mark was
 * present, the accessibility label was right, and the colour was a real value
 * by the time it reached the renderer - the wrong one. It took a screenshot of
 * the legend in dark mode, measured pixel by pixel, to find it.
 *
 * So this asserts the one thing that is checkable from here: the colour a
 * `ThemedText` ends up with when a caller hands it nothing.
 */

/** The colour the rendered `Text` actually carries. */
function renderedColour(tree: unknown): string | undefined {
  const found: string[] = [];

  const walk = (current: any) => {
    if (Array.isArray(current)) return current.forEach(walk);
    if (current === null || typeof current !== 'object') return;

    if (current.type === 'Text') {
      const flat = StyleSheet.flatten(current.props?.style);
      if (typeof flat?.color === 'string') found.push(flat.color);
    }

    walk(current.children);
  };

  walk(tree);

  return found[0];
}

describe('a colour the caller could not work out', () => {
  it('falls through to the theme rather than to black', async () => {
    const screen = await render(
      <ThemedText style={{ color: undefined }}>Verilerini dışa aktar</ThemedText>
    );

    expect(renderedColour(screen.toJSON())).toBe(Colors.light.text);
  });

  it('falls through to the themeColor the caller asked for', async () => {
    // The legend's row is muted, like the squares it explains. Falling back to
    // the default ink would have been legible and still wrong.
    const screen = await render(
      <ThemedText themeColor="textSecondary" style={{ color: undefined }}>
        ≈
      </ThemedText>
    );

    expect(renderedColour(screen.toJSON())).toBe(Colors.light.textSecondary);
  });

  it('still lets a caller that names a real colour win', async () => {
    // The fallback must not become a veto. The hero names its own colour and
    // so does a filled button's label.
    const screen = await render(
      <ThemedText style={{ color: Colors.light.primary }}>Kaydet</ThemedText>
    );

    expect(renderedColour(screen.toJSON())).toBe(Colors.light.primary);
  });

  it('survives the colour arriving inside an array, which is how it arrived', async () => {
    // `[styles.marker, { color: maybeUndefined }]` is the shape that shipped.
    const styles = StyleSheet.create({ marker: { fontSize: 12 } });

    const screen = await render(
      <ThemedText themeColor="textSecondary" style={[styles.marker, { color: undefined }]}>
        ≈
      </ThemedText>
    );

    expect(renderedColour(screen.toJSON())).toBe(Colors.light.textSecondary);
  });
});
