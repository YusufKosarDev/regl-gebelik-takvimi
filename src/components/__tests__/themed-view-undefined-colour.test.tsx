import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/theme';

import { ThemedView } from '../themed-view';

/**
 * The same hardening as `themed-text`, on the component that lays the surface.
 *
 * No caller passes an undefined `backgroundColor` today, and
 * `undefined-colour-class.test.ts` says so on every run. This is here because
 * the shape was identical and a known instance left open is how an inventory
 * stops being true - not because anything was observed going wrong.
 *
 * It would be louder than the text one if it ever happened: an undefined
 * `backgroundColor` is transparent rather than black, so a surface would
 * vanish rather than change colour, and `borderColor` defaults to black.
 */

function backgroundOf(tree: unknown): string | undefined {
  let found: string | undefined;

  const walk = (current: any) => {
    if (found !== undefined) return;
    if (Array.isArray(current)) return current.forEach(walk);
    if (current === null || typeof current !== 'object') return;

    const flat = StyleSheet.flatten(current.props?.style);

    if (typeof flat?.backgroundColor === 'string') {
      found = flat.backgroundColor;

      return;
    }

    walk(current.children);
  };

  walk(tree);

  return found;
}

describe('a surface colour the caller could not work out', () => {
  it('falls through to the theme rather than to transparent', async () => {
    const screen = await render(<ThemedView style={{ backgroundColor: undefined }} />);

    expect(backgroundOf(screen.toJSON())).toBe(Colors.light.background);
  });

  it('falls through to the type the caller asked for', async () => {
    const screen = await render(
      <ThemedView type="backgroundElement" style={{ backgroundColor: undefined }} />
    );

    expect(backgroundOf(screen.toJSON())).toBe(Colors.light.backgroundElement);
  });

  it('still lets a caller that names a real colour win', async () => {
    const screen = await render(
      <ThemedView style={{ backgroundColor: Colors.light.primary }} />
    );

    expect(backgroundOf(screen.toJSON())).toBe(Colors.light.primary);
  });
});
